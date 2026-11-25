import postgres from "postgres";
import { migrateIngredients } from "./ingredients/normalize";

/**
 * The recipe library lives in a Postgres database (Neon, added through Vercel's Storage tab).
 * Vercel puts its address in DATABASE_URL automatically once the database is connected.
 */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null;
}

let client: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

export async function db(): Promise<postgres.Sql> {
  const url = databaseUrl();
  if (!url) throw new Error("No database connected yet. Add one in Vercel → Storage (see README).");
  if (!client) {
    // max 1 + prepare false: serverless functions are short-lived and Neon's pooler doesn't keep prepared statements.
    client = postgres(url, { max: 1, prepare: false, idle_timeout: 20, onnotice: () => {} });
  }
  // Create the tables the first time Thea talks to a fresh database. Safe to run again.
  if (!ready) ready = migrate(client).catch((e) => { ready = null; throw e; });
  await ready;
  return client;
}

async function migrate(sql: postgres.Sql) {
  await sql`
    create table if not exists recipes (
      id               uuid primary key default gen_random_uuid(),
      status           text not null default 'pending',  -- pending | ready | not_recipe | failed
      shared_url       text,                             -- exactly what the share sheet sent (null for pasted text)
      source_url       text,                             -- the video's full link once resolved
      platform         text not null,                    -- tiktok | instagram | manual
      video_id         text,
      author           text,
      duration_seconds int,
      caption          text,
      transcript       text,
      transcript_source text,
      title            text,
      servings         numeric,
      prep_minutes     int,
      cook_minutes     int,
      tags             text[] not null default '{}',
      recipe           jsonb,                            -- the full structured recipe from Claude
      model            text,
      warnings         text[] not null default '{}',
      error            text,
      times_shared     int not null default 1,
      created_at       timestamptz not null default now(),
      last_shared_at   timestamptz not null default now(),
      updated_at       timestamptz not null default now()
    )`;
  await sql`create unique index if not exists recipes_platform_video on recipes (platform, video_id) where video_id is not null`;
  await sql`create index if not exists recipes_created on recipes (created_at desc)`;
  // One row per ingredient so later milestones (pantry, planner, Instacart) can query them directly.
  await sql`
    create table if not exists recipe_ingredients (
      recipe_id     uuid not null references recipes(id) on delete cascade,
      position      int not null,
      name          text not null,
      quantity      numeric,
      unit          text,
      preparation   text,
      category      text not null,
      is_staple     boolean not null default false,
      uncertain     boolean not null default false,
      original_text text,
      primary key (recipe_id, position)
    )`;
  await sql`create index if not exists recipe_ingredients_name on recipe_ingredients (name)`;
  // Milestone 2b: the grocery dictionary (one name per item, freshness tiers) and its columns.
  await migrateIngredients(sql);
}
