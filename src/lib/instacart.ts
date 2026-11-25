import { createHash } from "node:crypto";
import type postgres from "postgres";
import { databaseUrl, db } from "./db";
import type { GroceryItem } from "./grocery/items";

/**
 * Instacart Developer Platform: "Create shopping list page".
 * We send Instacart a list of item names and amounts; it answers with a link to a page on
 * instacart.com where Wes picks a store, checks the matched products and checks out.
 * Docs: https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page
 *
 * Settings (Vercel → Settings → Environment Variables):
 *   INSTACART_API_KEY  the key from Instacart's developer dashboard (starts with "keys.")
 *   INSTACART_ENV      "development" (default, for a development key) or "production"
 */

const HOSTS = {
  development: "https://connect.dev.instacart.tools",
  production: "https://connect.instacart.com",
} as const;

/** Links last up to 365 days; we ask for 30 and make a fresh one after 25. */
const EXPIRES_IN_DAYS = 30;
const REUSE_FOR_DAYS = 25;

export class InstacartNotSetUpError extends Error {
  constructor() {
    super("Instacart isn't connected yet. Add INSTACART_API_KEY in Vercel (see the README).");
  }
}

export class InstacartError extends Error {}

type Env = keyof typeof HOSTS;

function settings(): { key: string; env: Env } {
  const key = process.env.INSTACART_API_KEY?.trim();
  if (!key) throw new InstacartNotSetUpError();
  const env: Env = process.env.INSTACART_ENV?.trim().toLowerCase() === "production" ? "production" : "development";
  return { key, env };
}

export function instacartConfigured(): boolean {
  return Boolean(process.env.INSTACART_API_KEY?.trim());
}

type Measurement = { quantity: number; unit: string };
export type LineItem = { name: string; display_text: string; line_item_measurements?: Measurement[] };

/**
 * Our units → units Instacart understands (from its units-of-measurement page).
 * Anything not listed is sent without an amount, and Instacart suggests a normal pack.
 */
const UNIT_MAP: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  cup: "cup",
  cups: "cup",
  oz: "oz",
  ounce: "oz",
  lb: "lb",
  pound: "lb",
  can: "can",
  cans: "can",
  bunch: "bunch",
  head: "head",
  package: "package",
  piece: "each",
  each: "each",
  large: "large",
  medium: "medium",
  small: "small",
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "green onion" → "Green onion" */
function label(name: string): string {
  const n = name.trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Instacart's measurement for one amount of an item, or null to let Instacart pick a pack. */
export function toMeasurement(name: string, quantity: number | null, unit: string | null): Measurement | null {
  const u = unit?.trim().toLowerCase() || null;
  // Garlic is sold by the head, not the clove.
  if (u === "clove" || u === "cloves") return /garlic/i.test(name) ? { quantity: 1, unit: "head" } : null;
  if (quantity == null || !(quantity > 0)) return null;
  // You can't buy half a lemon: round counted items up.
  if (u == null) return { quantity: Math.ceil(quantity), unit: "each" };
  const mapped = UNIT_MAP[u];
  if (!mapped) return null;
  return { quantity: mapped === "each" ? Math.ceil(quantity) : round(quantity), unit: mapped };
}

const CATEGORY_ORDER = ["produce", "herbs", "meat_seafood", "dairy_eggs", "bakery", "pantry", "spices", "frozen", "other"];

/**
 * Turn grocery items into Instacart line items: one per item name (the same item listed twice
 * is merged and its amounts added up when the units match), sorted by store section.
 */
export function toLineItems(items: GroceryItem[], { includeStaples = false } = {}): LineItem[] {
  const groups = new Map<string, { item: GroceryItem; measurements: (Measurement | null)[] }>();
  for (const item of items) {
    if (!includeStaples && item.isStaple) continue;
    const key = item.name.trim().toLowerCase();
    if (!key) continue;
    const m = toMeasurement(item.name, item.quantity, item.unit);
    const g = groups.get(key);
    if (g) g.measurements.push(m);
    else groups.set(key, { item, measurements: [m] });
  }

  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };

  return [...groups.values()]
    .sort((a, b) => rank(a.item.category) - rank(b.item.category))
    .map(({ item, measurements }) => {
      const line: LineItem = { name: item.name.trim().toLowerCase(), display_text: label(item.name) };
      // Only send an amount when every mention of the item had one in the same unit.
      const known = measurements.filter((m): m is Measurement => m != null);
      if (known.length === measurements.length && known.every((m) => m.unit === known[0].unit)) {
        // Garlic heads (from cloves) don't add up: one head covers a recipe's cloves.
        const total = known[0].unit === "head" && /garlic/i.test(item.name) ? 1 : known.reduce((s, m) => s + m.quantity, 0);
        line.line_item_measurements = [{ quantity: round(total), unit: known[0].unit }];
      }
      return line;
    });
}

type ListRequest = {
  title: string;
  items: GroceryItem[];
  includeStaples?: boolean;
  /** Where Instacart's page links back to (e.g. the recipe in Thea). */
  linkbackUrl?: string;
  instructions?: string[];
};

export type ListLink = { url: string; itemCount: number; environment: Env; reused: boolean };

let tableReady: Promise<void> | null = null;
function ensureTable(sql: postgres.Sql): Promise<void> {
  if (!tableReady) {
    tableReady = sql`
      create table if not exists instacart_links (
        content_hash text primary key,  -- same list content → same link (Instacart asks us to reuse links)
        url          text not null,
        environment  text not null,
        item_count   int not null,
        created_at   timestamptz not null default now()
      )`
      .then(() => undefined)
      .catch((e) => {
        tableReady = null;
        throw e;
      });
  }
  return tableReady;
}

/** Ask Instacart for a shopping list page. Reuses the previous link if the list hasn't changed. */
export async function createShoppingListLink(req: ListRequest): Promise<ListLink> {
  const { key, env } = settings();
  const lineItems = toLineItems(req.items, { includeStaples: req.includeStaples });
  if (!lineItems.length) throw new InstacartError("There's nothing to buy on this list.");

  const body = {
    title: req.title.slice(0, 200),
    link_type: "shopping_list",
    expires_in: EXPIRES_IN_DAYS,
    line_items: lineItems,
    ...(req.instructions?.length ? { instructions: req.instructions } : {}),
    ...(req.linkbackUrl ? { landing_page_configuration: { partner_linkback_url: req.linkbackUrl } } : {}),
  };
  const hash = createHash("sha256").update(env).update(JSON.stringify(body)).digest("hex");

  const sql = databaseUrl() ? await db() : null;
  if (sql) {
    await ensureTable(sql);
    const [cached] = await sql<{ url: string }[]>`
      select url from instacart_links
      where content_hash = ${hash} and created_at > now() - make_interval(days => ${REUSE_FOR_DAYS})`;
    if (cached) return { url: cached.url, itemCount: lineItems.length, environment: env, reused: true };
  }

  const base = process.env.INSTACART_API_URL?.trim() || HOSTS[env];
  let res: Response;
  try {
    res = await fetch(`${base}/idp/v1/products/products_link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error("[instacart] request failed", err);
    throw new InstacartError("Couldn't reach Instacart. Try again in a minute.");
  }

  const data = (await res.json().catch(() => null)) as { products_link_url?: string } | null;
  if (!res.ok || !data?.products_link_url) {
    console.error("[instacart]", res.status, JSON.stringify(data));
    if (res.status === 401 || res.status === 403)
      throw new InstacartError(
        `Instacart didn't accept the API key. Check INSTACART_API_KEY, and that INSTACART_ENV is "${env === "production" ? "development" : "production"}" if it's a ${env === "production" ? "development" : "production"} key.`,
      );
    if (res.status === 429) throw new InstacartError("Instacart is busy. Try again in a minute.");
    throw new InstacartError(`Instacart couldn't make the list (error ${res.status}).`);
  }

  const url = data.products_link_url;
  if (sql) {
    await sql`
      insert into instacart_links (content_hash, url, environment, item_count) values (${hash}, ${url}, ${env}, ${lineItems.length})
      on conflict (content_hash) do update set url = excluded.url, created_at = now()`;
  }
  return { url, itemCount: lineItems.length, environment: env, reused: false };
}

/**
 * Backup that needs no API key: a link to Instacart's search for one item at Wes's store.
 * INSTACART_STORE is the store's name in Instacart links (instacart.com/store/<this>), default Key Food.
 */
export function storeSearchUrl(name: string): string {
  const store = process.env.INSTACART_STORE?.trim() || "key-food";
  return `https://www.instacart.com/store/${encodeURIComponent(store)}/s?k=${encodeURIComponent(name)}`;
}

/** "2 tbsp", "1 head", "3" — the amount of a line item in words, or "" if none. */
export function amountText(line: LineItem): string {
  const m = line.line_item_measurements?.[0];
  if (!m) return "";
  return m.unit === "each" ? String(m.quantity) : `${m.quantity} ${m.unit}`;
}
