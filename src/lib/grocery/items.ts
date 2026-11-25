import { db } from "../db";

/**
 * One thing to buy. Everything that sends groceries somewhere (Instacart today) works from this
 * shape, so it doesn't matter whether the items came from one recipe or a whole week's plan.
 *
 * Names come from ingredient normalization (one name per grocery item, e.g. "scallions" ->
 * "green onion") when it has run, else the name Claude wrote. Amounts stay in the recipe's own
 * units, which read naturally on Instacart ("2 tbsp butter").
 */
export type GroceryItem = {
  /** What to search the store for, e.g. "green onion". */
  name: string;
  /** Amount needed, or null if the recipe didn't say. */
  quantity: number | null;
  /** Unit for the amount ("g", "cup", "clove"…), or null for plain counts ("3 eggs"). */
  unit: string | null;
  /** Store section, used to sort the list. */
  category: string;
  /** Salt, pepper, oil and other things most kitchens already have. */
  isStaple: boolean;
};

type IngredientRow = {
  name: string;
  quantity: string | number | null;
  unit: string | null;
  category: string;
  is_staple: boolean;
};

/** The ingredients of one saved recipe, as grocery items, in recipe order. */
export async function recipeGroceryItems(recipeId: string): Promise<GroceryItem[]> {
  if (!/^[0-9a-f-]{36}$/i.test(recipeId)) return [];
  const sql = await db();
  const rows = await sql<IngredientRow[]>`
    select coalesce(ri.item, ri.name) as name, ri.quantity, ri.unit,
           coalesce(i.category, ri.category) as category, coalesce(i.staple, ri.is_staple) as is_staple
    from recipe_ingredients ri left join ingredients i on i.name = ri.item
    where ri.recipe_id = ${recipeId} order by ri.position`;
  return rows.map((r) => ({
    name: r.name,
    // Postgres numeric comes back as a string.
    quantity: r.quantity == null ? null : Number(r.quantity),
    unit: r.unit,
    category: r.category,
    isStaple: r.is_staple,
  }));
}
