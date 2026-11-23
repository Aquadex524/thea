import { NextResponse } from "next/server";
import { extractRecipe } from "@/lib/extract";
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
 */
export async function POST(req: Request) {
  const token = process.env.THEA_SHARE_TOKEN;
  if (token) {
    if (req.headers.get("authorization") !== `Bearer ${token}`) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: { url?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON with a url or text field" }, { status: 400 });
  }

  const raw = (body.url ?? "").trim();
  const text = (body.text ?? "").trim();
  const url = raw ? findUrl(raw) ?? raw : null;

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
