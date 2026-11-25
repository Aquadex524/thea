import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { databaseUrl } from "@/lib/db";
import { extractRecipe } from "@/lib/extract";
import { BadLinkError, processRecipe, startManualSave, startSave, toImportResultWithItems } from "@/lib/library";
import type { ImportResult, VideoSource } from "@/lib/recipe";
import { fetchVideoSource, findUrl } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/import
 * { url: string }   -> fetch caption + transcript from the video, then extract a recipe
 * { text: string }  -> manual fallback: pasted caption or recipe text (a URL inside is used if present)
 *
 * When THEA_SHARE_TOKEN is set, requests must send it as `Authorization: Bearer <token>`
 * (the iOS Shortcut and the web app both do this).
 *
 * Once a database is connected, every import is also saved to the recipe library and the
 * answer includes `recipeId`.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  let body: { url?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with a url or text field" }, { status: 400 });
  }

  const raw = (body.url ?? "").trim();
  const text = (body.text ?? "").trim();
  const url = raw ? findUrl(raw) ?? raw : null;
  if (!url && !text) return NextResponse.json({ error: "Send a video link or some recipe text" }, { status: 400 });

  if (databaseUrl()) return importAndSave(url, text);

  try {
    let source: VideoSource;
    let warnings: string[] = [];
    if (url) {
      ({ source, warnings } = await fetchVideoSource(url));
    } else if (text) {
      source = {
        platform: "manual",
        url: findUrl(text),
        videoId: null,
        author: null,
        caption: text,
        transcript: null,
        transcriptSource: null,
        thumbnailUrl: null,
        durationSeconds: null,
      };
    } else {
      return NextResponse.json({ error: "Send a video link or some recipe text" }, { status: 400 });
    }

    const { recipe, model } = await extractRecipe(source);
    const result: ImportResult = { source, recipe, model, warnings };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[import]", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Same as above, but stored in the library (and an already-saved link comes straight back). */
async function importAndSave(url: string | null, text: string) {
  try {
    let row;
    if (url) {
      const { row: saved, alreadySaved } = await startSave(url);
      row = alreadySaved && saved.recipe ? saved : await processRecipe(saved.id);
    } else {
      row = await processRecipe((await startManualSave(text)).id);
    }
    const result = await toImportResultWithItems(row);
    if (!result) return NextResponse.json({ error: row.error ?? "Import failed", recipeId: row.id }, { status: 502 });
    return NextResponse.json({ ...result, recipeId: row.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    console.error("[import]", err);
    return NextResponse.json({ error: message }, { status: err instanceof BadLinkError ? 400 : 502 });
  }
}
