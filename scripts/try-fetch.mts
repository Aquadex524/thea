// Usage: npx tsx scripts/try-fetch.mts <tiktok url> [--extract]
import { fetchVideoSource } from "../src/lib/sources";
import { extractRecipe } from "../src/lib/extract";

const url = process.argv[2];
if (!url) throw new Error("Pass a TikTok URL");
const { source, warnings } = await fetchVideoSource(url);
console.log(JSON.stringify({ ...source, caption: source.caption.slice(0, 300), transcript: source.transcript?.slice(0, 300) }, null, 2));
if (warnings.length) console.log("warnings:", warnings);
if (process.argv.includes("--extract")) console.log(JSON.stringify(await extractRecipe(source), null, 2));
