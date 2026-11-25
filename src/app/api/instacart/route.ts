import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { recipeGroceryItems } from "@/lib/grocery/items";
import {
  amountText,
  createShoppingListLink,
  instacartConfigured,
  InstacartError,
  InstacartNotSetUpError,
  storeSearchUrl,
  toLineItems,
} from "@/lib/instacart";
import { getRecipe } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/instacart?recipeId=...&includeStaples=1
 *   -> { configured, items: [{ name, label, amount, searchUrl }] }
 * The shopping list item by item, each with a link to search for it on Instacart at Wes's store.
 * Works without an Instacart API key.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const recipe = await getRecipe(params.get("recipeId") ?? "");
  if (!recipe || recipe.status !== "ready") return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  const lines = toLineItems(await recipeGroceryItems(recipe.id), { includeStaples: params.get("includeStaples") === "1" });
  return NextResponse.json({
    configured: instacartConfigured(),
    items: lines.map((l) => ({ name: l.name, label: l.display_text, amount: amountText(l), searchUrl: storeSearchUrl(l.name) })),
  });
}

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
