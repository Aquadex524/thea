import type postgres from "postgres";
import { db } from "./db";
import { extractRecipe } from "./extract";
import { normalizedLines, normalizeRecipe } from "./ingredients/normalize";
import type { ImportResult, Recipe, VideoSource } from "./recipe";
import { fetchVideoSource, findUrl, isInstagramUrl } from "./sources";
import { isTikTokUrl } from "./sources/tiktok";

/** One saved import, as stored in the `recipes` table. */
export type RecipeRow = {
  id: string;
  status: "pending" | "ready" | "not_recipe" | "failed";
  shared_url: string | null;
  source_url: string | null;
  platform: VideoSource["platform"];
  video_id: string | null;
  author: string | null;
  duration_seconds: number | null;
  caption: string | null;
  transcript: string | null;
  transcript_source: VideoSource["transcriptSource"];
  title: string | null;
  tags: string[];
  recipe: Recipe | null;
  model: string | null;
  warnings: string[];
  error: string | null;
  times_shared: number;
  created_at: Date;
  last_shared_at: Date;
};

/** The short version the library list needs. */
export type RecipeSummary = Pick<
  RecipeRow,
  "id" | "status" | "platform" | "author" | "title" | "tags" | "error" | "times_shared" | "created_at" | "last_shared_at"
> & {
  source_url: string | null;
  total_minutes: number | null;
  item_count: number | null;
  /** Grocery items this recipe uses (normalized names), for search. */
  items: string[];
  /** The ones that only keep 2–3 days. */
  fresh_items: string[];
};

export type SaveOutcome = { row: RecipeRow; alreadySaved: boolean };

export class BadLinkError extends Error {}

function platformOf(url: string): VideoSource["platform"] {
  if (isTikTokUrl(url)) return "tiktok";
  if (isInstagramUrl(url)) return "instagram";
  throw new BadLinkError("That link isn't a TikTok or Instagram video.");
}

async function bump(sql: postgres.Sql, id: string): Promise<RecipeRow> {
  const [row] = await sql<RecipeRow[]>`
    update recipes set times_shared = times_shared + 1, last_shared_at = now(), updated_at = now()
    where id = ${id} returning *`;
  return row;
}

/**
 * Step 1 of saving a shared link: record it straight away (status "pending").
 * If this exact link was already saved, just note that it was shared again.
 */
export async function startSave(shared: string): Promise<SaveOutcome> {
  const url = findUrl(shared) ?? shared.trim();
  const platform = platformOf(url);
  const sql = await db();

  const [existing] = await sql<RecipeRow[]>`
    select *, (status = 'pending' and updated_at > now() - interval '3 minutes') as busy from recipes
    where shared_url = ${url} or source_url = ${url}
    order by created_at desc limit 1`;
  if (existing) {
    const done = existing.status === "ready" || existing.status === "not_recipe";
    if (done || (existing as RecipeRow & { busy: boolean }).busy) return { row: await bump(sql, existing.id), alreadySaved: true };
    // It failed (or got stuck) last time: reuse that entry and try again.
    const [row] = await sql<RecipeRow[]>`
      update recipes set status = 'pending', error = null, times_shared = times_shared + 1,
        last_shared_at = now(), updated_at = now()
      where id = ${existing.id} returning *`;
    return { row, alreadySaved: false };
  }

  const [row] = await sql<RecipeRow[]>`
    insert into recipes (shared_url, platform) values (${url}, ${platform}) returning *`;
  return { row, alreadySaved: false };
}

/** Save pasted caption/recipe text (the "Paste text" tab). */
export async function startManualSave(text: string): Promise<RecipeRow> {
  const sql = await db();
  const [row] = await sql<RecipeRow[]>`
    insert into recipes (shared_url, platform, caption) values (${findUrl(text)}, 'manual', ${text}) returning *`;
  return row;
}

/**
 * Step 2: read the video and have Claude write the recipe, then store it.
 * Returns the row that holds the recipe; that can be an older row if this turns out to be
 * a video already in the library under a different link (e.g. a short vm.tiktok.com link).
 */
export async function processRecipe(id: string): Promise<RecipeRow> {
  const sql = await db();
  const [row] = await sql<RecipeRow[]>`select * from recipes where id = ${id}`;
  if (!row) throw new Error("Recipe not found");

  try {
    let source: VideoSource;
    let warnings: string[] = [];
    if (row.platform === "manual") {
      source = {
        platform: "manual",
        url: row.shared_url,
        videoId: null,
        author: null,
        caption: row.caption ?? "",
        transcript: null,
        transcriptSource: null,
        thumbnailUrl: null,
        durationSeconds: null,
      };
    } else {
      ({ source, warnings } = await fetchVideoSource(row.shared_url ?? ""));
    }

    if (source.videoId) {
      const [dupe] = await sql<RecipeRow[]>`
        select * from recipes
        where platform = ${source.platform} and video_id = ${source.videoId} and id <> ${id}`;
      if (dupe && (dupe.status === "ready" || dupe.status === "not_recipe")) {
        // Already in the library: keep the older one and forget this copy.
        await sql`delete from recipes where id = ${id}`;
        return bump(sql, dupe.id);
      }
      if (dupe) await sql`delete from recipes where id = ${dupe.id}`; // an earlier failed try
    }

    // Store what we read before calling Claude, so a failure later still keeps the caption.
    await sql`
      update recipes set
        source_url = ${source.url}, video_id = ${source.videoId}, author = ${source.author},
        duration_seconds = ${source.durationSeconds}, caption = ${source.caption},
        transcript = ${source.transcript}, transcript_source = ${source.transcriptSource},
        warnings = ${warnings}, updated_at = now()
      where id = ${id}`;

    const { recipe, model } = await extractRecipe(source);

    const saved = await sql.begin(async (tx) => {
      const [saved] = await tx<RecipeRow[]>`
        update recipes set
          status = ${recipe.is_recipe ? "ready" : "not_recipe"},
          title = ${recipe.title}, servings = ${recipe.servings},
          prep_minutes = ${recipe.prep_minutes}, cook_minutes = ${recipe.cook_minutes},
          tags = ${recipe.tags}, recipe = ${tx.json(recipe as unknown as postgres.JSONValue)},
          model = ${model}, error = null, updated_at = now()
        where id = ${id} returning *`;
      await tx`delete from recipe_ingredients where recipe_id = ${id}`;
      if (recipe.is_recipe && recipe.ingredients.length) {
        await tx`insert into recipe_ingredients ${tx(
          recipe.ingredients.map((i, position) => ({
            recipe_id: id,
            position,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            preparation: i.preparation,
            category: i.category,
            is_staple: i.is_staple,
            uncertain: i.uncertain,
            original_text: i.original_text,
          })),
        )}`;
      }
      return saved;
    });
    // Match each ingredient to its grocery item, standard unit and freshness tier.
    // If this fails the recipe is still saved; the library catches up on its next load.
    await normalizeRecipe(sql, id).catch((e) => console.error("[library] normalizing", id, e));
    return saved;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[library] processing", id, err);
    const [failed] = await sql<RecipeRow[]>`
      update recipes set status = 'failed', error = ${message}, updated_at = now() where id = ${id} returning *`;
    return failed ?? row;
  }
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const sql = await db();
  return sql<RecipeSummary[]>`
    select r.id, r.status, r.platform, r.author, r.title, r.tags, r.error, r.times_shared,
           r.created_at, r.last_shared_at, coalesce(r.source_url, r.shared_url) as source_url,
           nullif(coalesce(r.prep_minutes, 0) + coalesce(r.cook_minutes, 0), 0) as total_minutes,
           (select count(*)::int from recipe_ingredients i where i.recipe_id = r.id and not i.is_staple) as item_count,
           array(select distinct ri.item from recipe_ingredients ri
                 where ri.recipe_id = r.id and ri.item is not null) as items,
           array(select distinct ri.item from recipe_ingredients ri join ingredients g on g.name = ri.item
                 where ri.recipe_id = r.id and g.tier = 'days' and not ri.is_staple) as fresh_items
    from recipes r
    order by r.last_shared_at desc
    limit 500`;
}

export async function getRecipe(id: string): Promise<RecipeRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await db();
  const [row] = await sql<RecipeRow[]>`select * from recipes where id = ${id}`;
  return row ?? null;
}

export async function deleteRecipe(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const sql = await db();
  await sql`delete from recipes where id = ${id}`;
}

/** Shape a saved row like the old /api/import answer so the recipe card can show it. */
export function toImportResult(row: RecipeRow): ImportResult | null {
  if (!row.recipe) return null;
  return {
    source: {
      platform: row.platform,
      url: row.source_url ?? row.shared_url,
      videoId: row.video_id,
      author: row.author,
      caption: row.caption ?? "",
      transcript: row.transcript,
      transcriptSource: row.transcript_source,
      thumbnailUrl: null,
      durationSeconds: row.duration_seconds,
    },
    recipe: row.recipe,
    model: row.model ?? "",
    warnings: row.warnings,
  };
}

/** Same as toImportResult, plus each ingredient's grocery item and freshness from the database. */
export async function toImportResultWithItems(row: RecipeRow): Promise<ImportResult | null> {
  const result = toImportResult(row);
  if (!result) return null;
  try {
    result.normalized = await normalizedLines(await db(), row.id);
  } catch (err) {
    console.error("[library] reading normalized ingredients", err);
  }
  return result;
}
