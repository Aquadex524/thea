import { after, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { BadLinkError, processRecipe, startSave } from "@/lib/library";

export const runtime = "nodejs";
// Reading the video + Claude can take a minute; this is how long the background part may run.
export const maxDuration = 120;

/**
 * POST /api/save  { url: "<shared link or share-sheet text>" }
 *
 * For the iOS Shortcut's background save: records the link right away and answers in about a
 * second with { message } for the notification. Reading the video and writing the recipe keeps
 * going on the server after the answer is sent; the result shows up in /library.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized", message: "Thea: wrong access code" }, { status: 401 });

  let shared = "";
  try {
    const raw = await req.text();
    try {
      const body = JSON.parse(raw);
      shared = String(body.url ?? body.text ?? "");
    } catch {
      shared = raw; // plain text body is fine too
    }
  } catch {}
  shared = shared.trim();
  if (!shared) return NextResponse.json({ error: "No link", message: "Thea didn't get a link" }, { status: 400 });

  try {
    const { row, alreadySaved } = await startSave(shared);
    if (alreadySaved) {
      return NextResponse.json({
        id: row.id,
        status: row.status,
        alreadySaved: true,
        message: row.title ? `Already in your library: ${row.title}` : "Already saved, Thea is still reading it",
      });
    }
    after(() => processRecipe(row.id).then(() => undefined));
    return NextResponse.json({
      id: row.id,
      status: row.status,
      alreadySaved: false,
      message: "Saved to Thea. The recipe will be in your library in about a minute.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[save]", err);
    return NextResponse.json({ error: message, message: `Thea couldn't save it: ${message}` }, { status: err instanceof BadLinkError ? 400 : 500 });
  }
}
