import type { VideoSource } from "../recipe";
import { fetchSupadataTranscript } from "./supadata";
import { fetchTikTok, isTikTokUrl } from "./tiktok";

export function isInstagramUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

/** Pull the first http(s) URL out of whatever the share sheet handed us. */
export function findUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'<>]+/);
  return m ? m[0] : null;
}

export async function fetchVideoSource(url: string): Promise<{ source: VideoSource; warnings: string[] }> {
  const warnings: string[] = [];

  if (isTikTokUrl(url)) {
    const source = await fetchTikTok(url);
    if (!source.transcript) {
      const t = await fetchSupadataTranscript(source.url ?? url);
      if (t) {
        source.transcript = t;
        source.transcriptSource = "supadata";
      } else {
        warnings.push("No spoken transcript was available, so this came from the caption only.");
      }
    }
    return { source, warnings };
  }

  if (isInstagramUrl(url)) {
    const transcript = await fetchSupadataTranscript(url);
    if (!transcript) {
      throw new Error(
        "Instagram isn't supported yet without a transcript service. Paste the caption or recipe text instead.",
      );
    }
    return {
      source: {
        platform: "instagram",
        url,
        videoId: null,
        author: null,
        caption: "",
        transcript,
        transcriptSource: "supadata",
        thumbnailUrl: null,
        durationSeconds: null,
      },
      warnings: ["Instagram captions aren't pulled yet, only the spoken transcript."],
    };
  }

  throw new Error("That link isn't a TikTok or Instagram video.");
}
