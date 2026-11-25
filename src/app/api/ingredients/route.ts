import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { databaseUrl, db } from "@/lib/db";
import { itemUsage, normalizePending } from "@/lib/ingredients/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/ingredients -> { items: ItemUsage[] }
 * Every grocery item the saved recipes use, with its freshness tier and the names recipes used for it.
 * Catches up on any ingredients not normalized yet first.
 */
export async function GET(req: Request) {
  return respond(req, false);
}

/** POST /api/ingredients { action: "recheck" } -> re-matches every saved ingredient, then same as GET. */
export async function POST(req: Request) {
  return respond(req, true);
}

async function respond(req: Request, all: boolean) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!databaseUrl()) return NextResponse.json({ error: "No database connected yet", noDatabase: true }, { status: 503 });
  try {
    const sql = await db();
    await normalizePending(sql, { all });
    return NextResponse.json({ items: await itemUsage(sql) });
  } catch (err) {
    console.error("[ingredients]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load ingredients" }, { status: 500 });
  }
}
