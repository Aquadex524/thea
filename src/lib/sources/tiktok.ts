import type { VideoSource } from "../recipe";
import { vttToText } from "./vtt";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.tiktok.com/",
};

export function isTikTokUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "tiktok.com" || host.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

/** Short links (vm./vt.tiktok.com, /t/...) redirect to the canonical /@user/video/<id> page. */
async function resolveUrl(url: string): Promise<string> {
  if (/\/video\/\d+/.test(url)) return url;
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  return res.url;
}

type SubtitleInfo = { Url: string; LanguageCodeName?: string; Format?: string; Source?: string };
type CaptionInfo = { url: string; language?: string; languageCode?: string; isAutoGen?: boolean };

function pickEnglish<T>(items: T[], lang: (t: T) => string | undefined): T | undefined {
  return items.find((i) => (lang(i) ?? "").toLowerCase().startsWith("en")) ?? items[0];
}

export async function fetchTikTok(inputUrl: string): Promise<VideoSource> {
  const url = await resolveUrl(inputUrl);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`TikTok returned ${res.status} for the video page`);
  const html = await res.text();

  const m = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error("TikTok page did not include video data (it may be blocking us)");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = JSON.parse(m[1]);
  const detail = data?.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  const item = detail?.itemInfo?.itemStruct;
  if (!item) {
    throw new Error(
      `TikTok had no video details (status ${detail?.statusCode ?? "?"} ${detail?.statusMsg ?? ""})`.trim(),
    );
  }

  const video = item.video ?? {};
  const subs: SubtitleInfo[] = video.subtitleInfos ?? [];
  const caps: CaptionInfo[] = video.claInfo?.captionInfos ?? [];
  const sub = pickEnglish(
    subs.filter((s) => (s.Format ?? "webvtt") === "webvtt"),
    (s) => s.LanguageCodeName,
  );
  const cap = pickEnglish(caps, (c) => c.languageCode ?? c.language);
  const vttUrl = sub?.Url ?? cap?.url;

  let transcript: string | null = null;
  if (vttUrl) {
    try {
      const vttRes = await fetch(vttUrl, { headers: HEADERS });
      if (vttRes.ok) transcript = vttToText(await vttRes.text()) || null;
    } catch {
      transcript = null;
    }
  }

  return {
    platform: "tiktok",
    url,
    videoId: item.id ?? null,
    author: item.author?.uniqueId ?? null,
    caption: item.desc ?? "",
    transcript,
    transcriptSource: transcript ? "tiktok" : null,
    thumbnailUrl: video.cover ?? null,
    durationSeconds: typeof video.duration === "number" ? video.duration : null,
  };
}
