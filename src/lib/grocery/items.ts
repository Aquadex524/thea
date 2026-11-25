import { db } from "../db";

/**
 * One thing to buy. Everything that sends groceries somewhere (Instacart today) works from this
 * shape, so it doesn't matter whether the items came from one recipe or a whole week's plan.
 *
 * When ingredient normalization lands, only the functions in this file need to change
 * (e.g. read normalized item names and units instead of the raw recipe ones).
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
    select name, quantity, unit, category, is_staple
    from recipe_ingredients where recipe_id = ${recipeId} order by position`;
  return rows.map((r) => ({
    name: r.name,
    // Postgres numeric comes back as a string.
    quantity: r.quantity == null ? null : Number(r.quantity),
    unit: r.unit,
    category: r.category,
    isStaple: r.is_staple,
  }));
}
