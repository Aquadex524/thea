import { after, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { databaseUrl, db } from "@/lib/db";
import { normalizePending } from "@/lib/ingredients/normalize";
import { listRecipes } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/recipes -> { recipes: RecipeSummary[] }, newest share first. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!databaseUrl()) return NextResponse.json({ error: "No database connected yet", noDatabase: true }, { status: 503 });
  try {
    const recipes = await listRecipes();
    // Quietly catch up on any ingredients not matched to grocery items yet (e.g. older recipes).
    after(async () => {
      await normalizePending(await db()).catch((e) => console.error("[recipes] normalizing", e));
    });
    return NextResponse.json({ recipes });
  } catch (err) {
    console.error("[recipes]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load the library" }, { status: 500 });
  }
}
