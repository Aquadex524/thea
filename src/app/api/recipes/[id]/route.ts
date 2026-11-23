import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { deleteRecipe, getRecipe, processRecipe, toImportResult } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

function payload(row: NonNullable<Awaited<ReturnType<typeof getRecipe>>>) {
  return { recipe: row, result: toImportResult(row) };
}

/** GET /api/recipes/:id -> { recipe: RecipeRow, result: ImportResult | null } */
export async function GET(req: Request, { params }: Ctx) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const row = await getRecipe((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payload(row));
}

/** POST /api/recipes/:id  { action: "retry" } -> reads the video again and rewrites the recipe. */
export async function POST(req: Request, { params }: Ctx) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  const row = await getRecipe((await params).id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await processRecipe(row.id);
  return NextResponse.json(payload(updated));
}

/** DELETE /api/recipes/:id -> removes it from the library. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  await deleteRecipe((await params).id);
  return NextResponse.json({ ok: true });
}
