import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { planWeek } from "@/lib/plan/optimizer";
import { loadPlanRecipes, loadPlanSettings, savePlanSettings } from "@/lib/plan/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function respond(save?: unknown) {
  const settings = save === undefined ? await loadPlanSettings() : await savePlanSettings(save);
  const recipes = await loadPlanRecipes();
  return NextResponse.json({
    plan: planWeek(recipes, settings),
    library: recipes.map((r) => ({ id: r.id, title: r.title })),
  });
}

function guard(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!databaseUrl()) return NextResponse.json({ error: "No database connected yet", noDatabase: true }, { status: 503 });
  return null;
}

/** GET /api/plan -> this week's suggested plans (2–3 options) using the saved settings. */
export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    return await respond();
  } catch (err) {
    console.error("[plan]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't plan the week" }, { status: 500 });
  }
}

/** PUT /api/plan { settings } -> saves the settings, then answers like GET. */
export async function PUT(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    return await respond(body.settings ?? {});
  } catch (err) {
    console.error("[plan]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't save settings" }, { status: 500 });
  }
}
