import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { listRecipes } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/recipes -> { recipes: RecipeSummary[] }, newest share first. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!databaseUrl()) return NextResponse.json({ error: "No database connected yet", noDatabase: true }, { status: 503 });
  try {
    return NextResponse.json({ recipes: await listRecipes() });
  } catch (err) {
    console.error("[recipes]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load the library" }, { status: 500 });
  }
}
