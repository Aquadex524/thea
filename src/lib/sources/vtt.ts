/** Turn a WebVTT caption file into plain spoken text, dropping timings and repeats. */
export function vttToText(vtt: string): string {
  const lines: string[] = [];
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "WEBVTT" || line.startsWith("NOTE") || line.includes("-->")) continue;
    if (/^\d+$/.test(line)) continue; // cue numbers
    const clean = line.replace(/<[^>]+>/g, "").trim();
    if (clean && clean !== lines[lines.length - 1]) lines.push(clean);
  }
  return lines.join(" ").replace(/\s+/g, " ").trim();
}
