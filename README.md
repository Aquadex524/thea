# Thea

Personal app that turns TikTok / Instagram cooking videos into structured recipes, then (later milestones) a weekly meal plan and an Instacart order.

**Milestone 1:** share or paste one TikTok link → Thea pulls the caption and the spoken transcript → Claude turns them into a structured recipe (ingredients normalized for shopping, steps, things to double-check).

**Milestone 2:** every link you send Thea is saved to a **recipe library** (`/library`), with the link, the recipe and the date. A second iOS Shortcut, **Save to Thea**, saves in the background without opening Safari and just shows a notification.

**Milestone 2b, ingredient normalization:** every ingredient in every saved recipe is matched to one grocery item ("scallions", "spring onions" and "green onions" are all **green onion**), its amount is put in a standard unit, and it gets a freshness tier saying how fast it goes off. The **Items** page (`/ingredients`) lists them all; recipe pages show a "cook this early in the week" note when something keeps only 2–3 days.

**Milestone 3 (part 1):** the **Week** tab (`/week`) recommends which saved recipes to cook this week. It offers three plans (Most efficient, Newest, Wildcard), puts them on your cook days, and shows which fresh items get shared and which might go to waste.

### How the weekly optimizer picks recipes

`src/lib/plan/optimizer.ts` is plain math, no AI call, so it's instant and free:

1. Every fresh item counts by how fast it spoils (from the ingredient dictionary): herbs, greens and meat count the most, pantry items barely, staples (salt, oil) not at all.
2. It tries every combination of saved recipes (one per cook day) and scores each one: points for fresh items that two or more meals share, a penalty for fresh items only one meal uses, a small penalty per item to buy, and a small bonus for recently saved recipes.
3. It puts the chosen meals on your cook days so the quickest-spoiling ingredients are cooked first.
4. For a fresh item only one meal uses, it looks for another saved recipe that uses it ("Use it up: add …").

Settings (saved in the `app_settings` table): cook days (default Sun, Mon, Tue), portions per recipe (2; leftovers 2 days later), ingredients to avoid, pinned recipes (always in) and "not this week" recipes. `GET /api/plan` returns the plans; `PUT /api/plan { settings }` saves settings and re-plans. Check the logic with `npx tsx scripts/test-optimizer.mts`.

## How it works

1. `src/lib/sources/tiktok.ts` loads the TikTok video page, reads the embedded video data (caption, creator, length) and downloads TikTok's own subtitle file (WebVTT) for the spoken transcript. No TikTok account or paid service needed.
2. If TikTok has no subtitles for a video (music-only videos, for example) and `SUPADATA_API_KEY` is set, `supadata.ts` asks Supadata for an AI transcript. Otherwise Thea works from the caption alone and says so.
3. Instagram links currently need `SUPADATA_API_KEY`; without it, use **Paste text**.
4. `src/lib/extract.ts` sends caption + transcript to Claude (`claude-opus-5-5`, structured output validated by the Zod schema in `src/lib/recipe.ts`).
5. `POST /api/import` with `{ "url": "..." }` or `{ "text": "..." }` returns `{ source, recipe, warnings, recipeId }` and saves it to the library.
6. `POST /api/save` with `{ "url": "..." }` saves the link straight away and answers in about a second with `{ message }`; reading the video and writing the recipe carries on in the background (Next.js `after()`). Sharing the same video twice doesn't make a second copy, it just counts the share.
7. `GET /api/recipes` lists the library; `GET/POST/DELETE /api/recipes/:id` shows one recipe, re-reads its video, or deletes it.

## The recipe library (database)

Recipes are stored in a free **Neon Postgres** database connected through Vercel. Thea creates its tables on its own the first time it runs (`src/lib/db.ts`), so there's nothing to set up beyond connecting it. Without a database Thea still works, it just doesn't save anything.

- `recipes`: one row per saved video: the link you shared, the video's real link and ID, creator, caption, transcript, the full recipe from Claude (as JSON), title/servings/times/tags as their own columns, `status` (`pending` → `ready`, or `failed` / `not_recipe`), `times_shared`, `created_at`, `last_shared_at`.
- `recipe_ingredients`: one row per ingredient (name, quantity, unit, store category, staple or not, plus the normalized `item`, `amount`, `std_unit`). Later milestones (pantry, weekly planner, Instacart list) read these directly.
- `ingredients`, `ingredient_aliases`, `thea_meta`: the grocery dictionary (see below).

### Ingredient normalization (`src/lib/ingredients/`)

- `catalog.ts`: the built-in grocery dictionary, about 300 common items, each with the other names recipes use for it, its store section and freshness. Add a line there to teach Thea a new item; plurals are handled automatically.
- `tiers.ts`: the four freshness tiers. `days` (use within 2–3 days: soft herbs, leafy greens, berries, fresh meat and fish), `week` (about a week: most vegetables, soft dairy, bread), `weeks` (1–2 weeks or more: root vegetables, onions, garlic, hard cheese, eggs), `pantry` (months). Each item also has its own `shelf_days`.
- `units.ts`: volumes become ml, weights become grams, countable things keep one spelling (`clove`, `can`, `bunch`, `each`…).
- `normalize.ts`: looks a name up in the dictionary first; anything new is classified once by Claude (one small call for all new names together) and remembered, so it's never asked twice.

Database: `recipe_ingredients` gets `item` (the grocery item), `amount` and `std_unit`; the new `ingredients` table holds one row per item (`tier`, `shelf_days`, `category`, `staple`, and `source`: catalog, claude, or guess); `ingredient_aliases` remembers which names Claude matched to which item.

Older recipes are caught up automatically the next time the Library or Items page loads. When the dictionary changes, everything is re-matched once on its own. **Items → Re-check all ingredients** does it on demand.

Check the matching without a database: `npx tsx scripts/check-ingredients.mts`.

### Connect the database in Vercel (one time)

1. Go to vercel.com, open the **thea** project.
2. Click the **Storage** tab at the top → **Create Database** (or **Connect Database** → **Create New**).
3. Pick **Neon** (Serverless Postgres) → **Continue**.
4. Region: **Washington, D.C. (iad1)** is fine. Plan: **Free**. Name it `thea-db` → **Create**.
5. When it asks which project to connect, choose **thea** and leave all environments ticked → **Connect**. Vercel adds `DATABASE_URL` (and a few related variables) to the project for you. You never need to copy or paste it.
6. Redeploy so the site picks it up: **Deployments** tab → the top one → **⋯** → **Redeploy**. (Merging new code to `main` also redeploys.)

Check: open `https://thea-beta.vercel.app/library`. It should say "Nothing saved yet" instead of "No database connected yet".

For local development, `vercel env pull .env.local` copies the same variables to your computer, or point `DATABASE_URL` at any Postgres.

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

In TikTok: **Share → More (…) → Thea**. Safari opens Thea and it starts reading the video. The `#token=` part never leaves your phone; Thea stores it and removes it from the address bar. The recipe is saved to the library too.

## iOS Shortcut: save to the library without opening Safari

A second Shortcut, for when you just want to save the video and keep scrolling.

1. Shortcuts app → **+** → name it **Save to Thea**.
2. Tap **ⓘ** → turn on **Show in Share Sheet** → under "Receive", allow **URLs** and **Text**.
3. Add action **Get Contents of URL**. Set the URL to `https://thea-beta.vercel.app/api/save`. Tap the arrow (**Show More**) and set:
   - **Method**: `POST`
   - **Headers** → **Add new header**: key `Authorization`, value `Bearer ` (with a space) followed by your `THEA_SHARE_TOKEN`
   - **Request Body**: `JSON` → **Add new field** → **Text**: key `url`, value *Shortcut Input*
4. Add action **Get Dictionary Value**: get **Value** for key `message` in *Contents of URL*.
5. Add action **Show Notification** with *Dictionary Value*.

In TikTok: **Share → More (…) → Save to Thea**. After a second you get "Saved to Thea…"; the recipe appears in **Library** about a minute later. If a video can't be read, it shows as **Failed** in the library with a **Try again** button.

## Notes

- TikTok can change its page format or block server IPs at any time. If imports start failing with "did not include video data", that's the cause; the Supadata path and **Paste text** are the fallbacks.
- Cloud dev containers that route through an HTTP proxy need `NODE_USE_ENV_PROXY=1` for Node's `fetch` to reach TikTok. Vercel doesn't.
