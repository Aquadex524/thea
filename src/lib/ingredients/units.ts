/**
 * Units: turn whatever unit a recipe used into one standard unit, so amounts from different
 * recipes can be added up later.
 *
 * - Volumes (tsp, tbsp, cup, fl oz, l…) become millilitres ("ml").
 * - Weights (oz, lb, kg…) become grams ("g").
 * - Things you count keep a single spelling: "clove", "can", "bunch", "each" (for "2 lemons")…
 *
 * Converting between kinds (a cup of flour into grams) needs to know the ingredient; the
 * grocery-list step (milestone 3) will do that when it rounds to real pack sizes.
 */

export type UnitKind = "volume" | "weight" | "count";
export type StdAmount = { amount: number | null; unit: string | null; kind: UnitKind | null };

const VOLUME_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  "fl oz": 29.5735,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
};

const WEIGHT_G: Record<string, number> = { mg: 0.001, g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

/** Every spelling we've seen, pointing to one standard spelling. */
const SPELLINGS: Record<string, string> = {
  // volume
  milliliter: "ml", millilitre: "ml", mls: "ml", cc: "ml",
  liter: "l", litre: "l", liters: "l", litres: "l", ltr: "l",
  teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp", t: "tsp", "tsp.": "tsp",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbl: "tbsp", "tbsp.": "tbsp",
  cups: "cup", c: "cup",
  "fluid ounce": "fl oz", "fluid ounces": "fl oz", "fl. oz": "fl oz", "fl oz.": "fl oz", floz: "fl oz",
  pints: "pint", pt: "pint",
  quarts: "quart", qt: "quart",
  gallons: "gallon", gal: "gallon",
  // weight
  milligram: "mg", milligrams: "mg",
  gram: "g", grams: "g", gr: "g", grs: "g", gm: "g",
  kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg", kgs: "kg",
  ounce: "oz", ounces: "oz", "oz.": "oz",
  pound: "lb", pounds: "lb", lbs: "lb", "lb.": "lb", "lbs.": "lb",
  // count
  piece: "each", pieces: "each", pc: "each", pcs: "each", whole: "each", each: "each", ea: "each", unit: "each", units: "each", item: "each",
  clove: "clove", cloves: "clove",
  can: "can", cans: "can", tin: "can", tins: "can",
  jar: "jar", jars: "jar",
  bottle: "bottle", bottles: "bottle",
  bunch: "bunch", bunches: "bunch",
  head: "head", heads: "head",
  stalk: "stalk", stalks: "stalk", rib: "stalk", ribs: "stalk",
  sprig: "sprig", sprigs: "sprig",
  leaf: "leaf", leaves: "leaf",
  slice: "slice", slices: "slice",
  fillet: "fillet", fillets: "fillet", filet: "fillet", filets: "fillet",
  stick: "stick", sticks: "stick",
  sheet: "sheet", sheets: "sheet",
  cube: "cube", cubes: "cube",
  package: "package", packages: "package", pkg: "package", packet: "package", packets: "package", pack: "package", packs: "package",
  bag: "bag", bags: "bag",
  box: "box", boxes: "box",
  block: "block", blocks: "block",
  ear: "ear", ears: "ear",
  knob: "knob", knobs: "knob",
  inch: "inch", inches: "inch", '"': "inch",
  handful: "handful", handfuls: "handful",
  pinch: "pinch", pinches: "pinch",
  dash: "dash", dashes: "dash",
  splash: "splash", splashes: "splash",
  drizzle: "drizzle",
  scoop: "scoop", scoops: "scoop",
  serving: "serving", servings: "serving",
};

/** Standard spelling of a unit, or null if there's no unit (e.g. "2 lemons"). */
export function standardUnit(unit: string | null | undefined): string | null {
  if (unit == null) return null;
  const raw = unit.trim();
  if (!raw) return null;
  if (raw === "T") return "tbsp"; // capital T is tablespoon, small t is teaspoon
  const u = raw.toLowerCase().replace(/\s+/g, " ");
  if (u in VOLUME_ML || u in WEIGHT_G) return u;
  return SPELLINGS[u] ?? SPELLINGS[u.replace(/\.$/, "")] ?? u.replace(/\.$/, "");
}

/** Convert an amount to the standard unit for its kind (ml, g, or a count unit). */
export function toStandard(quantity: number | null | undefined, unit: string | null | undefined): StdAmount {
  const u = standardUnit(unit);
  const q = quantity == null || !Number.isFinite(quantity) ? null : Number(quantity);
  if (u && u in VOLUME_ML) return { amount: q == null ? null : round(q * VOLUME_ML[u]), unit: "ml", kind: "volume" };
  if (u && u in WEIGHT_G) return { amount: q == null ? null : round(q * WEIGHT_G[u]), unit: "g", kind: "weight" };
  return { amount: q, unit: u ?? "each", kind: "count" };
}

function round(n: number): number {
  return n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
}
