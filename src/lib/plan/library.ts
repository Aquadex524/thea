import type postgres from "postgres";
import { db } from "../db";
import { DAYS, DEFAULT_SETTINGS, type DayName, type PlanIngredient, type PlanRecipe, type PlanSettings } from "./optimizer";

/**
 * Reads the saved recipes in the shape the optimizer needs.
 *
 * Ingredient names and freshness come from the ingredient dictionary (the `ingredients` table and
 * the `item` column on recipe_ingredients). If that hasn't been set up yet, it falls back to the raw
 * ingredient name and a rough guess from the store section, so the planner works either way.
 */
export async function loadPlanRecipes(): Promise<PlanRecipe[]> {
  const sql = await db();
  const [{ normalized }] = await sql<{ normalized: boolean }[]>`
    select to_regclass('ingredients') is not null
       and exists (select 1 from information_schema.columns
                   where table_name = 'recipe_ingredients' and column_name = 'item') as normalized`;

  const rows = normalized
    ? await sql<Row[]>`
        select r.id, r.title, r.prep_minutes, r.cook_minutes, r.servings, r.last_shared_at,
               ri.name, ri.category, ri.is_staple, ri.item, i.shelf_days, i.staple
        from recipes r
        join recipe_ingredients ri on ri.recipe_id = r.id
        left join ingredients i on i.name = ri.item
        where r.status = 'ready'
        order by r.last_shared_at desc, ri.position`
    : await sql<Row[]>`
        select r.id, r.title, r.prep_minutes, r.cook_minutes, r.servings, r.last_shared_at,
               ri.name, ri.category, ri.is_staple, null as item, null::int as shelf_days, null::boolean as staple
        from recipes r
        join recipe_ingredients ri on ri.recipe_id = r.id
        where r.status = 'ready'
        order by r.last_shared_at desc, ri.position`;

  const byId = new Map<string, PlanRecipe>();
  for (const row of rows) {
    let recipe = byId.get(row.id);
    if (!recipe) {
      recipe = {
        id: row.id,
        title: row.title ?? "Untitled",
        prepMinutes: row.prep_minutes,
        cookMinutes: row.cook_minutes,
        servings: row.servings == null ? null : Number(row.servings),
        savedAt: new Date(row.last_shared_at),
        ingredients: [],
      };
      byId.set(row.id, recipe);
    }
    recipe.ingredients.push(toPlanIngredient(row));
  }
  return [...byId.values()];
}

type Row = {
  id: string;
  title: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: string | number | null;
  last_shared_at: Date;
  name: string;
  category: string;
  is_staple: boolean;
  item: string | null;
  shelf_days: number | null;
  staple: boolean | null;
};

function toPlanIngredient(row: Row): PlanIngredient {
  const key = (row.item ?? row.name).trim().toLowerCase();
  return {
    key,
    label: key,
    shelfDays: row.shelf_days ?? guessShelfDays(key, row.category),
    staple: row.staple ?? row.is_staple,
  };
}

/** Rough fallback only, used until the ingredient dictionary has an entry for an item. */
export function guessShelfDays(name: string, category: string): number {
  const has = (...words: string[]) => words.some((w) => name.includes(w));
  switch (category) {
    case "herbs":
      return 3;
    case "meat_seafood":
      return 2;
    case "produce":
      if (has("lettuce", "spinach", "arugula", "greens", "berr", "sprout", "basil", "cilantro", "mint", "parsley"))
        return 3;
      if (has("onion", "garlic", "shallot", "potato", "carrot", "ginger", "lemon", "lime", "cabbage", "squash"))
        return 14;
      return 6;
    case "dairy_eggs":
      if (has("egg", "parmesan", "pecorino", "cheddar")) return 21;
      return 6;
    case "bakery":
      return 4;
    default:
      return 180;
  }
}

// ---------- saved settings ----------

async function settingsTable(sql: postgres.Sql) {
  await sql`create table if not exists app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now())`;
}

export async function loadPlanSettings(): Promise<PlanSettings> {
  const sql = await db();
  await settingsTable(sql);
  const [row] = await sql<{ value: Partial<PlanSettings> }[]>`select value from app_settings where key = 'plan'`;
  return cleanSettings(row?.value ?? {});
}

export async function savePlanSettings(input: unknown): Promise<PlanSettings> {
  const settings = cleanSettings(input);
  const sql = await db();
  await settingsTable(sql);
  await sql`
    insert into app_settings (key, value) values ('plan', ${sql.json(settings as unknown as postgres.JSONValue)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return settings;
}

/** Keep only valid values, so a bad request can't break the planner. */
export function cleanSettings(input: unknown): PlanSettings {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const strings = (x: unknown) =>
    Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean))].slice(0, 100) : [];
  const num = (x: unknown, lo: number, hi: number, d: number) =>
    typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d;
  const days = strings(v.cookDays).filter((d): d is DayName => (DAYS as string[]).includes(d));
  return {
    cookDays: days.length ? DAYS.filter((d) => days.includes(d)) : DEFAULT_SETTINGS.cookDays,
    servingsPerRecipe: num(v.servingsPerRecipe, 1, 8, DEFAULT_SETTINGS.servingsPerRecipe),
    leftoverGapDays: num(v.leftoverGapDays, 1, 4, DEFAULT_SETTINGS.leftoverGapDays),
    pinned: strings(v.pinned),
    skipped: strings(v.skipped),
    avoid: strings(v.avoid).map((s) => s.toLowerCase()),
  };
}
