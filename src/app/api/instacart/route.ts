import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { recipeGroceryItems } from "@/lib/grocery/items";
import { createShoppingListLink, InstacartError, InstacartNotSetUpError } from "@/lib/instacart";
import { getRecipe } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/instacart  { recipeId, includeStaples? }
 *   -> { url, itemCount, reused }  a link to an Instacart shopping list for that recipe.
 * Later the weekly grocery list will call createShoppingListLink() the same way.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { recipeId?: unknown; includeStaples?: unknown };
  if (typeof body.recipeId !== "string") return NextResponse.json({ error: "recipeId is required" }, { status: 400 });

  try {
    const recipe = await getRecipe(body.recipeId);
    if (!recipe || recipe.status !== "ready") return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    const items = await recipeGroceryItems(recipe.id);
    const link = await createShoppingListLink({
      title: recipe.title ?? "Thea recipe",
      items,
      includeStaples: body.includeStaples === true,
      linkbackUrl: new URL(`/recipes/${recipe.id}`, req.url).toString(),
    });
    return NextResponse.json(link);
  } catch (err) {
    if (err instanceof InstacartNotSetUpError) return NextResponse.json({ error: err.message, setup: true }, { status: 503 });
    if (err instanceof InstacartError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error("[api/instacart]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Something went wrong" }, { status: 500 });
  }
}
