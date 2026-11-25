import { CATALOG, type CatalogItem } from "./catalog";

/**
 * Matching an ingredient name to the built-in dictionary. Pure code, no database or AI,
 * so it is instant and free. Anything it can't match goes to Claude once (normalize.ts).
 */

/** Lowercase, drop brackets and stray punctuation, squash spaces. */
export function cleanName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'àâçéèêëîïôûùüÿñæœ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "tomatoes" -> "tomato", "berries" -> "berry", "leaves" -> "leaf". Only touches the last word. */
export function singular(name: string): string {
  const words = name.split(" ");
  const last = words.pop() ?? "";
  let s = last;
  if (/(ss|us|is)$/.test(last) || last.length <= 3) s = last;
  else if (/ies$/.test(last)) s = last.slice(0, -3) + "y";
  else if (/(leaves|halves|loaves)$/.test(last)) s = last.slice(0, -3) + "f";
  else if (/(oes|ches|shes|xes|sses)$/.test(last)) s = last.slice(0, -2);
  else if (/s$/.test(last)) s = last.slice(0, -1);
  return [...words, s].join(" ");
}

// Words that describe the state of an item rather than which item it is.
const DESCRIPTORS =
  /\b(fresh|freshly|organic|large|small|medium|extra|jumbo|ripe|raw|whole|good|good quality|high quality|store-bought|homemade|chopped|minced|diced|sliced|grated|shredded|crushed|ground|softened|melted|cold|room temperature|boneless|skinless|peeled|thinly|finely|roughly|of|some|a|an|the)\b/g;

function stripDescriptors(name: string): string {
  return name.replace(DESCRIPTORS, " ").replace(/\s+/g, " ").trim();
}

const INDEX = (() => {
  const map = new Map<string, CatalogItem>();
  const add = (key: string, item: CatalogItem) => {
    const k = cleanName(key);
    if (!k) return;
    if (!map.has(k)) map.set(k, item);
    const s = singular(k);
    if (!map.has(s)) map.set(s, item);
  };
  // Canonical names first so they always win over another item's alias.
  for (const item of CATALOG) add(item.name, item);
  for (const item of CATALOG) for (const a of item.aliases) add(a, item);
  return map;
})();

/** The forms of a name worth looking up, most specific first. */
export function lookupKeys(name: string): string[] {
  const c = cleanName(name);
  const keys = [c, singular(c)];
  const stripped = stripDescriptors(c);
  if (stripped && stripped !== c) keys.push(stripped, singular(stripped));
  return [...new Set(keys.filter(Boolean))];
}

/** The dictionary item for this name, or null if it isn't one we know. */
export function matchCatalog(name: string): CatalogItem | null {
  for (const k of lookupKeys(name)) {
    const hit = INDEX.get(k);
    if (hit) return hit;
  }
  return null;
}

/** The key we remember an unknown ingredient under (so "Gochujang Paste" and "gochujang paste" are one). */
export function aliasKey(name: string): string {
  return singular(cleanName(name));
}
