import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";
import { CATALOG, CATALOG_BY_NAME, TIERS, type Category, type Tier } from "./catalog";
import { aliasKey, matchCatalog } from "./match";
import type { NormalizedLine } from "../recipe";
import { toStandard } from "./units";

/**
 * Ingredient normalization: for every ingredient line in a saved recipe, work out
 *   - which grocery item it is ("scallions" -> "green onion"),
 *   - its amount in a standard unit (3 tbsp -> 44.4 ml),
 *   - how fast it goes off (freshness tier + days).
 *
 * Order of lookups: the built-in dictionary (catalog.ts), then items Claude classified
 * before (the ingredient_aliases table), then a single Claude call for anything new.
 */

export type Item = { name: string; category: Category; tier: Tier; shelf_days: number; staple: boolean };
type Line = { name: string; category: string; is_staple: boolean };

const CATEGORIES = ["produce", "herbs", "meat_seafood", "dairy_eggs", "bakery", "pantry", "spices", "frozen", "other"] as const;
const TIER_NAMES = ["days", "week", "weeks", "pantry"] as const;

/** Bump when the matching rules change, so saved recipes are re-checked. The catalog itself is hashed in. */
const RULES_VERSION = 1;
export const NORMALIZER_VERSION = createHash("sha1")
  .update(JSON.stringify({ RULES_VERSION, CATALOG }))
  .digest("hex")
  .slice(0, 12);

export async function migrateIngredients(sql: postgres.Sql) {
  await sql`
    create table if not exists ingredients (
      name        text primary key,          -- the one canonical grocery item, e.g. 'green onion'
      category    text not null,             -- store section
      tier        text not null,             -- days | week | weeks | pantry (how fast it goes off)
      shelf_days  int not null,              -- rough days it keeps in the fridge/pantry once bought
      staple      boolean not null default false,
      source      text not null,             -- catalog (built in) | claude (classified once) | guess (no AI available)
      updated_at  timestamptz not null default now()
    )`;
  await sql`
    create table if not exists ingredient_aliases (
      alias  text primary key,               -- a name as recipes wrote it, cleaned up
      item   text not null references ingredients(name) on update cascade on delete cascade,
      source text not null
    )`;
  await sql`create table if not exists thea_meta (key text primary key, value text not null)`;
  await sql`alter table recipe_ingredients add column if not exists item text`;
  await sql`alter table recipe_ingredients add column if not exists amount numeric`;
  await sql`alter table recipe_ingredients add column if not exists std_unit text`;
  await sql`create index if not exists recipe_ingredients_item on recipe_ingredients (item)`;

  // Keep the built-in dictionary in the database too, so later steps can query it with SQL.
  const [meta] = await sql<{ value: string }[]>`select value from thea_meta where key = 'catalog_synced'`;
  if (meta?.value !== NORMALIZER_VERSION) {
    await sql`
      insert into ingredients ${sql(
        CATALOG.map((i) => ({
          name: i.name,
          category: i.category,
          tier: i.tier,
          shelf_days: i.shelfDays,
          staple: i.staple,
          source: "catalog",
        })),
      )}
      on conflict (name) do update set
        category = excluded.category, tier = excluded.tier, shelf_days = excluded.shelf_days,
        staple = excluded.staple, source = 'catalog', updated_at = now()`;
    await sql`
      insert into thea_meta (key, value) values ('catalog_synced', ${NORMALIZER_VERSION})
      on conflict (key) do update set value = excluded.value`;
  }
}

function fromCatalog(name: string): Item | null {
  const hit = matchCatalog(name);
  return hit ? { name: hit.name, category: hit.category, tier: hit.tier, shelf_days: hit.shelfDays, staple: hit.staple } : null;
}

/** Best guess when Claude isn't available: the recipe's own store section decides the tier. */
function guess(line: Line): Item {
  const category = (CATEGORIES as readonly string[]).includes(line.category) ? (line.category as Category) : "other";
  const tier: Tier =
    category === "herbs" || category === "meat_seafood"
      ? "days"
      : category === "produce" || category === "dairy_eggs" || category === "bakery"
        ? "week"
        : "pantry";
  return { name: aliasKey(line.name), category, tier, shelf_days: TIERS[tier].shelfDays, staple: line.is_staple };
}

const ClassifySchema = z.object({
  items: z.array(
    z.object({
      input: z.string().describe("The ingredient name exactly as given."),
      canonical_name: z
        .string()
        .describe(
          "The grocery item to buy, lowercase and singular. Reuse a name from the known list when it is the same product; otherwise a short generic name.",
        ),
      category: z.enum(CATEGORIES).describe("Store section."),
      tier: z.enum(TIER_NAMES).describe("How fast it goes off once bought."),
      shelf_days: z.number().describe("Rough number of days it keeps once bought, stored normally."),
      is_staple: z.boolean().describe("True for things most kitchens always have (salt, oil, basic spices)."),
    }),
  ),
});

/** One Claude call for all the new names at once. */
async function classifyWithClaude(lines: Line[], known: string[]): Promise<Map<string, Item>> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ClassifySchema) },
    system: `You help Thea, a meal-planning app, keep one clean name per grocery item and know how long each keeps.

For each ingredient name, give the grocery item someone would actually buy for it:
- If it is the same product as a name in the known list, use that exact name (e.g. "spring onions" -> "green onion").
- Otherwise use a short, generic, lowercase, singular name ("gochujang paste" -> "gochujang"). Drop prep words and brands.
- Different products stay different ("smoked paprika" is not "paprika"; "fresh mozzarella" is not "mozzarella").

Freshness tiers (from when it's bought, stored normally):
- days: use within 2–3 days (soft herbs, leafy greens, berries, fresh meat and fish)
- week: about a week (most fresh vegetables, soft cheese, cream, bread)
- weeks: one to several weeks (root vegetables, onions, garlic, hard cheese, eggs, citrus)
- pantry: months (dry goods, cans, jars, sauces, spices, oils, frozen items)`,
    messages: [
      {
        role: "user",
        content: `Known items:\n${known.join(", ")}\n\nClassify these (name | store section the recipe used):\n${lines
          .map((l) => `- ${l.name} | ${l.category}`)
          .join("\n")}`,
      },
    ],
  });
  const out = new Map<string, Item>();
  for (const r of response.parsed_output?.items ?? []) {
    const known = fromCatalog(r.canonical_name);
    out.set(
      aliasKey(r.input),
      known ?? {
        name: aliasKey(r.canonical_name) || aliasKey(r.input),
        category: r.category,
        tier: r.tier,
        shelf_days: Math.max(1, Math.round(r.shelf_days)),
        staple: r.is_staple,
      },
    );
  }
  return out;
}

/** Work out the grocery item for each name. Remembers anything new so it's only classified once. */
export async function resolveItems(sql: postgres.Sql, lines: Line[]): Promise<Map<string, Item>> {
  const result = new Map<string, Item>(); // keyed by aliasKey(name)
  const unknown = new Map<string, Line>();

  for (const line of lines) {
    const key = aliasKey(line.name);
    if (!key || result.has(key)) continue;
    const hit = fromCatalog(line.name);
    if (hit) result.set(key, hit);
    else unknown.set(key, line);
  }
  if (!unknown.size) return result;

  // Learned before?
  const canClassify = Boolean(process.env.ANTHROPIC_API_KEY);
  const learned = await sql<(Item & { alias: string; alias_source: string })[]>`
    select a.alias, a.source as alias_source, i.name, i.category, i.tier, i.shelf_days, i.staple
    from ingredient_aliases a join ingredients i on i.name = a.item
    where a.alias in ${sql([...unknown.keys()])}`;
  for (const l of learned) {
    if (l.alias_source === "guess" && canClassify) continue; // try Claude this time
    result.set(l.alias, { name: l.name, category: l.category, tier: l.tier, shelf_days: l.shelf_days, staple: l.staple });
    unknown.delete(l.alias);
  }
  if (!unknown.size) return result;

  let found = new Map<string, Item>();
  if (canClassify) {
    try {
      const known = await sql<{ name: string }[]>`select name from ingredients order by name`;
      found = await classifyWithClaude([...unknown.values()], known.map((k) => k.name));
    } catch (err) {
      console.error("[ingredients] Claude classification failed, guessing for now", err);
    }
  }
  const items: Item[] = [];
  const aliases: { alias: string; item: string; source: string }[] = [];
  for (const [key, line] of unknown) {
    const fromClaude = found.get(key);
    const item = fromClaude ?? guess(line);
    result.set(key, item);
    if (!CATALOG_BY_NAME.has(item.name)) items.push(item);
    aliases.push({ alias: key, item: item.name, source: fromClaude ? "claude" : "guess" });
  }

  if (items.length) {
    const unique = [...new Map(items.map((i) => [i.name, i])).values()];
    await sql`
      insert into ingredients ${sql(
        unique.map((i) => ({ ...i, source: aliases.find((a) => a.item === i.name)?.source ?? "guess" })),
        "name", "category", "tier", "shelf_days", "staple", "source",
      )}
      on conflict (name) do update set
        category = excluded.category, tier = excluded.tier, shelf_days = excluded.shelf_days,
        staple = excluded.staple, source = excluded.source, updated_at = now()
      where ingredients.source <> 'catalog' and (ingredients.source = 'guess' or excluded.source = 'claude')`;
  }
  await sql`
    insert into ingredient_aliases ${sql(aliases)}
    on conflict (alias) do update set item = excluded.item, source = excluded.source
    where ingredient_aliases.source = 'guess'`;
  return result;
}

type IngredientRow = {
  recipe_id: string;
  position: number;
  name: string;
  quantity: string | null; // numeric comes back as a string
  unit: string | null;
  category: string;
  is_staple: boolean;
};

async function normalizeRows(sql: postgres.Sql, rows: IngredientRow[]): Promise<number> {
  if (!rows.length) return 0;
  const items = await resolveItems(sql, rows);
  const updates = rows.map((r) => {
    const item = items.get(aliasKey(r.name));
    const std = toStandard(r.quantity == null ? null : Number(r.quantity), r.unit);
    return [r.recipe_id, r.position, item?.name ?? aliasKey(r.name), std.amount, std.unit];
  });
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    await sql`
      update recipe_ingredients r set item = v.item, amount = v.amount::numeric, std_unit = v.std_unit
      from (values ${sql(chunk as never)}) as v(recipe_id, position, item, amount, std_unit)
      where r.recipe_id = v.recipe_id::uuid and r.position = v.position::int`;
  }
  return rows.length;
}

/** Normalize one recipe's ingredients (called right after a recipe is saved). */
export async function normalizeRecipe(sql: postgres.Sql, recipeId: string): Promise<number> {
  const rows = await sql<IngredientRow[]>`
    select recipe_id, position, name, quantity, unit, category, is_staple
    from recipe_ingredients where recipe_id = ${recipeId}`;
  return normalizeRows(sql, rows);
}

let running: Promise<number> | null = null;

/**
 * Catch up on everything not normalized yet: recipes saved before this feature existed, or
 * all of them again when the dictionary or rules changed. Cheap when there's nothing to do.
 */
export function normalizePending(sql: postgres.Sql, opts: { all?: boolean } = {}): Promise<number> {
  if (running && !opts.all) return running;
  const run = (async () => {
    const [meta] = await sql<{ value: string }[]>`select value from thea_meta where key = 'normalized_with'`;
    const all = opts.all || meta?.value !== NORMALIZER_VERSION;
    const rows = await sql<IngredientRow[]>`
      select recipe_id, position, name, quantity, unit, category, is_staple
      from recipe_ingredients ${all ? sql`` : sql`where item is null`}`;
    const n = await normalizeRows(sql, rows);
    if (all) {
      await sql`
        insert into thea_meta (key, value) values ('normalized_with', ${NORMALIZER_VERSION})
        on conflict (key) do update set value = excluded.value`;
    }
    return n;
  })().finally(() => {
    if (running === run) running = null;
  });
  running = run;
  return run;
}

export async function normalizedLines(sql: postgres.Sql, recipeId: string): Promise<NormalizedLine[]> {
  const rows = await sql<(Omit<NormalizedLine, "amount"> & { amount: string | null })[]>`
    select ri.position, ri.item, ri.amount, ri.std_unit, i.tier, i.shelf_days
    from recipe_ingredients ri left join ingredients i on i.name = ri.item
    where ri.recipe_id = ${recipeId} and ri.item is not null
    order by ri.position`;
  return rows.map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount) }));
}

/** For the Ingredients page: every item used across the library. */
export type ItemUsage = Item & { source: string; recipes: number; seen_as: string[] };

export async function itemUsage(sql: postgres.Sql): Promise<ItemUsage[]> {
  return sql<ItemUsage[]>`
    select i.name, i.category, i.tier, i.shelf_days, i.staple, i.source,
           count(distinct ri.recipe_id)::int as recipes,
           array_agg(distinct lower(ri.name)) as seen_as
    from recipe_ingredients ri
    join recipes r on r.id = ri.recipe_id and r.status = 'ready'
    join ingredients i on i.name = ri.item
    group by i.name
    order by array_position(array['days','week','weeks','pantry'], i.tier), count(distinct ri.recipe_id) desc, i.name`;
}
