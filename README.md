# Thea

Personal app that turns TikTok / Instagram cooking videos into structured recipes, then (later milestones) a weekly meal plan and an Instacart order.

**Milestone 1 (this code):** share or paste one TikTok link → Thea pulls the caption and the spoken transcript → Claude turns them into a structured recipe (ingredients normalized for shopping, steps, things to double-check).

## How it works

1. `src/lib/sources/tiktok.ts` loads the TikTok video page, reads the embedded video data (caption, creator, length) and downloads TikTok's own subtitle file (WebVTT) for the spoken transcript. No TikTok account or paid service needed.
2. If TikTok has no subtitles for a video (music-only videos, for example) and `SUPADATA_API_KEY` is set, `supadata.ts` asks Supadata for an AI transcript. Otherwise Thea works from the caption alone and says so.
3. Instagram links currently need `SUPADATA_API_KEY`; without it, use **Paste text**.
4. `src/lib/extract.ts` sends caption + transcript to Claude (`claude-opus-5-5`, structured output validated by the Zod schema in `src/lib/recipe.ts`).
5. `POST /api/import` with `{ "url": "..." }` or `{ "text": "..." }` returns `{ source, recipe, warnings }`.

## Run locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Quick check of the TikTok half without the UI:

```bash
npx tsx scripts/try-fetch.mts "https://www.tiktok.com/@user/video/123"            # caption + transcript
npx tsx scripts/try-fetch.mts "https://www.tiktok.com/@user/video/123" --extract  # + Claude recipe
```

## Environment variables

| Name | Required | What it's for |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude recipe extraction |
| `THEA_SHARE_TOKEN` | recommended once deployed | Any long random string. Keeps strangers from using your Claude credits. The app asks for it once; the Shortcut sends it as `Authorization: Bearer …` |
| `SUPADATA_API_KEY` | optional | Transcripts for TikToks without subtitles, and for Instagram. Free tier: 100 credits/month |

## Deploy (Vercel)

Import the GitHub repo at vercel.com/new, add the env vars above, deploy. Then on the iPhone open the site in Safari → Share → **Add to Home Screen**.

## iOS Shortcut: share a TikTok into Thea

1. Shortcuts app → **+** → name it **Thea**.
2. Tap the **ⓘ** (or the down-arrow next to the name) → turn on **Show in Share Sheet** → under "Receive", allow **URLs** and **Text**.
3. Add action **URL Encode**. Its input should be *Shortcut Input*.
4. Add action **Text** containing: `https://thea-beta.vercel.app/?url=` then the *URL Encoded Text* variable, then `#token=` followed by your `THEA_SHARE_TOKEN`.
5. Add action **Open URLs** (input: the *Text* from step 4).

In TikTok: **Share → More (…) → Thea**. Safari opens Thea and it starts reading the video. The `#token=` part never leaves your phone; Thea stores it and removes it from the address bar.

(Milestone 2 changes this so the Shortcut saves straight to your recipe library in the background and just shows a "Saved" notification.)

## Notes

- TikTok can change its page format or block server IPs at any time. If imports start failing with "did not include video data", that's the cause; the Supadata path and **Paste text** are the fallbacks.
- Cloud dev containers that route through an HTTP proxy need `NODE_USE_ENV_PROXY=1` for Node's `fetch` to reach TikTok. Vercel doesn't.
