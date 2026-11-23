/**
 * Optional transcript fallback via Supadata (covers TikTok and Instagram, and can
 * generate an AI transcript when a video has no captions). Only used when
 * SUPADATA_API_KEY is set. Docs: https://supadata.ai
 */
export async function fetchSupadataTranscript(url: string): Promise<string | null> {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return null;
  const endpoint = new URL("https://api.supadata.ai/v1/transcript");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("mode", "auto");
  endpoint.searchParams.set("text", "true");
  const res = await fetch(endpoint, { headers: { "x-api-key": key } });
  if (res.status !== 200) return null; // 206 = no transcript, 202 = async job (long videos only)
  const body = (await res.json()) as { content?: unknown };
  return typeof body.content === "string" && body.content.trim() ? body.content.trim() : null;
}
