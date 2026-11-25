/**
 * The weekly optimizer: picks which saved recipes to cook this week and on which day.
 *
 * Plain-English version of the rules (from the project brief):
 *  - Buy as little as possible that only gets used once. Fresh things (herbs, greens, cream, meat)
 *    count the most, because a half-used bunch of cilantro goes in the bin.
 *  - Share fresh ingredients across meals, so one bunch / carton gets used up.
 *  - Cook the meals with the most delicate ingredients first (Sunday), sturdier ones later.
 *  - Newly saved recipes get a small boost.
 *  - Pinned recipes are always in; skipped ones never are.
 *
 * Everything here is plain math on the recipe list, no AI call, so it is instant and free.
 */

export type PlanIngredient = {
  /** One name per grocery item, e.g. "green onion" for scallions too. */
  key: string;
  /** What to show Wes. */
  label: string;
  /** About how many days it keeps after the Sunday delivery. */
  shelfDays: number;
  /** Salt, oil, etc.: assumed to be at home, ignored by the optimizer. */
  staple: boolean;
};

export type PlanRecipe = {
  id: string;
  title: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  /** When it was last shared to Thea (newer = small boost). */
  savedAt: Date;
  ingredients: PlanIngredient[];
};

export type DayName = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const DAYS: DayName[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type PlanSettings = {
  /** Days Wes cooks. Brief: Sun, Mon, Tue; Wed optional; never Thu/Fri. */
  cookDays: DayName[];
  /** Portions to make per recipe (one now, one as leftovers). */
  servingsPerRecipe: number;
  /** Leftovers get eaten this many days after cooking (brief: 2, not the next day). */
  leftoverGapDays: number;
  /** Recipe ids that must be in this week's plan. */
  pinned: string[];
  /** Recipe ids to leave out this week. */
  skipped: string[];
  /** Ingredients to avoid entirely: any recipe using one is left out. */
  avoid: string[];
};

export const DEFAULT_SETTINGS: PlanSettings = {
  cookDays: ["sun", "mon", "tue"],
  servingsPerRecipe: 2,
  leftoverGapDays: 2,
  pinned: [],
  skipped: [],
  avoid: [],
};

export type PlannedMeal = {
  day: DayName;
  /** Days after delivery (Sunday = 0). */
  offset: number;
  leftoverDay: DayName | null;
  recipe: { id: string; title: string; prepMinutes: number | null; cookMinutes: number | null; servings: number | null };
  pinned: boolean;
  /** Fresh items this meal shares with another meal in the plan. */
  shared: string[];
};

export type PlanOption = {
  kind: "efficient" | "newest" | "wildcard";
  name: string;
  tagline: string;
  meals: PlannedMeal[];
  /** Fresh items used by two or more meals, most-shared first. */
  sharedFresh: { item: string; meals: number; shelfDays: number }[];
  /** Fresh items only one meal uses: likely leftovers, with a library recipe that could use them up. */
  atRisk: { item: string; shelfDays: number; useUpWith: { id: string; title: string } | null }[];
  /** Items that would spoil before the meal that needs them. */
  spoilsFirst: { item: string; shelfDays: number; day: DayName }[];
  /** How many different things to buy (staples excluded). */
  itemsToBuy: number;
  /** Share (0–100) of the fresh items bought that more than one meal uses. */
  freshShared: number;
};

export type PlanResult = {
  options: PlanOption[];
  /** Recipes that could be used (not skipped, not avoided, have ingredients). */
  candidates: number;
  excluded: { id: string; title: string; reason: string }[];
  settings: PlanSettings;
  note: string | null;
};

// ---------- scoring ----------

/** How much it matters if an item is left over: fresh things matter most, pantry things barely. */
export function freshWeight(shelfDays: number): number {
  if (shelfDays <= 3) return 3;
  if (shelfDays <= 7) return 2;
  if (shelfDays <= 21) return 0.7;
  return 0.15;
}

/** Items that count as "fresh" in what we show Wes. */
const isFresh = (shelfDays: number) => shelfDays <= 21;

type Item = { label: string; shelfDays: number; weight: number };
type Prepared = { recipe: PlanRecipe; items: Map<string, Item>; recency: number };

function prepare(recipes: PlanRecipe[], now: Date): Prepared[] {
  return recipes.map((recipe) => {
    const items = new Map<string, Item>();
    for (const i of recipe.ingredients) {
      if (i.staple || !i.key) continue;
      const prev = items.get(i.key);
      const shelfDays = Math.min(prev?.shelfDays ?? Infinity, i.shelfDays);
      items.set(i.key, { label: prev?.label ?? i.label, shelfDays, weight: freshWeight(shelfDays) });
    }
    const ageDays = Math.max(0, (now.getTime() - recipe.savedAt.getTime()) / 86_400_000);
    return { recipe, items, recency: Math.exp(-ageDays / 14) };
  });
}

type SetScore = { value: number };

function scoreSet(set: Prepared[], recencyWeight: number): SetScore {
  const uses = new Map<string, { n: number; w: number }>();
  for (const p of set)
    for (const [k, it] of p.items) {
      const u = uses.get(k);
      if (u) u.n++;
      else uses.set(k, { n: 1, w: it.weight });
    }
  let overlap = 0;
  let orphans = 0;
  for (const { n, w } of uses.values()) {
    if (n > 1) overlap += w * (n - 1);
    else orphans += w;
  }
  const recency = set.reduce((s, p) => s + p.recency, 0);
  const value = 2 * overlap - 1.5 * orphans - 0.15 * uses.size + recencyWeight * recency;
  return { value };
}

// ---------- choosing ----------

function* combinations<T>(pool: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= pool.length - (k - acc.length); i++) {
    acc.push(pool[i]);
    yield* combinations(pool, k, i + 1, acc);
    acc.pop();
  }
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

const MAX_COMBOS = 120_000;

/** Best set of `k` recipes that contains all of `must`, optionally with an extra condition. */
function bestSet(
  must: Prepared[],
  pool: Prepared[],
  k: number,
  recencyWeight: number,
  accept: (set: Prepared[]) => boolean = () => true,
): Prepared[] | null {
  const free = k - must.length;
  if (free <= 0) return accept(must) ? must.slice(0, Math.max(k, must.length)) : null;
  // With a big library, look only at the recipes that share the most fresh items with others (plus the newest).
  let candidates = pool;
  if (choose(pool.length, free) > MAX_COMBOS) {
    const keys = new Map<string, number>();
    for (const p of pool) for (const [key, it] of p.items) keys.set(key, (keys.get(key) ?? 0) + it.weight);
    const connect = (p: Prepared) =>
      [...p.items].reduce((s, [key, it]) => s + (keys.get(key)! - it.weight), 0) + 5 * p.recency;
    candidates = [...pool].sort((a, b) => connect(b) - connect(a));
    while (candidates.length > free && choose(candidates.length, free) > MAX_COMBOS) candidates.pop();
  }
  let best: Prepared[] | null = null;
  let bestValue = -Infinity;
  for (const extra of combinations(candidates, Math.min(free, candidates.length))) {
    const set = [...must, ...extra];
    if (!accept(set)) continue;
    const { value } = scoreSet(set, recencyWeight);
    if (value > bestValue) {
      bestValue = value;
      best = set;
    }
  }
  return best;
}

// ---------- ordering through the week ----------

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items.slice();
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) yield [items[i], ...p];
  }
}

/** Put the meals on cook days so delicate items are used before they go off. */
function sequence(set: Prepared[], offsets: number[]): Prepared[] {
  if (set.length > 7) return set;
  let best = set;
  let bestCost = Infinity;
  for (const order of permutations(set)) {
    const lastUse = new Map<string, number>();
    let cost = 0;
    order.forEach((p, i) => {
      for (const [key, it] of p.items) {
        lastUse.set(key, Math.max(lastUse.get(key) ?? 0, offsets[i]));
        cost += it.weight * offsets[i] * 0.1; // fresher stuff earlier
      }
    });
    for (const [key, day] of lastUse) {
      const shelf = order.find((p) => p.items.has(key))!.items.get(key)!.shelfDays;
      if (day > shelf) cost += 10 * (day - shelf); // would spoil before it's cooked
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = order;
    }
  }
  return best;
}

// ---------- putting it together ----------

const OPTION_TEXT = {
  efficient: { name: "Most efficient", tagline: "Shares the most fresh ingredients, least likely to waste anything" },
  newest: { name: "Newest", tagline: "Leans on the recipes you saved most recently" },
  wildcard: { name: "Wildcard", tagline: "Mixes in something the other two plans don't use" },
};

export function planWeek(recipes: PlanRecipe[], input: Partial<PlanSettings> = {}, now = new Date()): PlanResult {
  const settings: PlanSettings = { ...DEFAULT_SETTINGS, ...input };
  const cookDays = DAYS.filter((d) => settings.cookDays.includes(d));
  if (!cookDays.length) cookDays.push(...DEFAULT_SETTINGS.cookDays);
  settings.cookDays = cookDays;
  const avoid = settings.avoid.map((a) => a.trim().toLowerCase()).filter(Boolean);

  const excluded: PlanResult["excluded"] = [];
  const usable: PlanRecipe[] = [];
  for (const r of recipes) {
    const hit = avoid.find((a) => r.ingredients.some((i) => i.key.includes(a) || i.label.toLowerCase().includes(a)));
    if (settings.skipped.includes(r.id)) excluded.push({ id: r.id, title: r.title, reason: "Skipped this week" });
    else if (hit) excluded.push({ id: r.id, title: r.title, reason: `Uses ${hit}` });
    else if (!r.ingredients.some((i) => !i.staple)) excluded.push({ id: r.id, title: r.title, reason: "No ingredients" });
    else usable.push(r);
  }

  const all = prepare(usable, now);
  const must = all.filter((p) => settings.pinned.includes(p.recipe.id));
  const pool = all.filter((p) => !settings.pinned.includes(p.recipe.id));
  const k = Math.min(Math.max(cookDays.length, must.length), all.length);
  const result: PlanResult = { options: [], candidates: all.length, excluded, settings, note: null };
  if (!k) {
    result.note = recipes.length
      ? "None of your saved recipes can be used with these settings."
      : "Save a few recipes first, then Thea can plan your week.";
    return result;
  }
  if (all.length < cookDays.length)
    result.note = `Only ${all.length} usable recipe${all.length === 1 ? "" : "s"} saved, so this week has fewer meals than cook days.`;
  else if (must.length > cookDays.length)
    result.note = `You pinned ${must.length} recipes for ${cookDays.length} cook days, so every pin is in and some days get two meals' worth.`;

  const ids = (s: Prepared[]) => s.map((p) => p.recipe.id).sort().join(",");
  const seen = new Set<string>();
  const picks: { kind: PlanOption["kind"]; set: Prepared[] }[] = [];
  const add = (kind: PlanOption["kind"], set: Prepared[] | null) => {
    if (!set || seen.has(ids(set))) return;
    seen.add(ids(set));
    picks.push({ kind, set });
  };

  add("efficient", bestSet(must, pool, k, 0.5));
  // Newest: only the most recently saved recipes (one more than the number of cook days), best combination among them.
  const recent = [...pool].sort((a, b) => b.recency - a.recency).slice(0, k + 1);
  add("newest", bestSet(must, recent, k, 2, (s) => !seen.has(ids(s))) ?? bestSet(must, pool, k, 6, (s) => !seen.has(ids(s))));
  const used = new Set(picks.flatMap((p) => p.set.map((x) => x.recipe.id)));
  add(
    "wildcard",
    bestSet(must, pool, k, 0.5, (s) => !seen.has(ids(s)) && s.some((p) => !used.has(p.recipe.id))) ??
      bestSet(must, pool, k, 0.5, (s) => !seen.has(ids(s))),
  );

  result.options = picks.map(({ kind, set }) => {
    const offsets = set.map((_, i) => DAYS.indexOf(cookDays[Math.min(i, cookDays.length - 1)]));
    const ordered = sequence(set, offsets);
    const counts = new Map<string, { item: string; meals: number; shelfDays: number; lastDay: number }>();
    ordered.forEach((p, i) => {
      for (const [key, it] of p.items) {
        const c = counts.get(key);
        if (c) {
          c.meals++;
          c.lastDay = offsets[i];
        } else counts.set(key, { item: it.label, meals: 1, shelfDays: it.shelfDays, lastDay: offsets[i] });
      }
    });
    const planIds = new Set(ordered.map((p) => p.recipe.id));
    const meals: PlannedMeal[] = ordered.map((p, i) => {
      const day = DAYS[offsets[i]];
      const leftover = offsets[i] + settings.leftoverGapDays;
      return {
        day,
        offset: offsets[i],
        leftoverDay: settings.servingsPerRecipe > 1 && leftover < 7 ? DAYS[leftover] : null,
        recipe: {
          id: p.recipe.id,
          title: p.recipe.title,
          prepMinutes: p.recipe.prepMinutes,
          cookMinutes: p.recipe.cookMinutes,
          servings: p.recipe.servings,
        },
        pinned: settings.pinned.includes(p.recipe.id),
        shared: [...p.items]
          .filter(([key, it]) => isFresh(it.shelfDays) && (counts.get(key)?.meals ?? 0) > 1)
          .map(([, it]) => it.label),
      };
    });
    const atRisk = [...counts]
      .filter(([, c]) => c.meals === 1 && c.shelfDays <= 7)
      .sort((a, b) => a[1].shelfDays - b[1].shelfDays)
      .map(([key, c]) => {
        const other = all
          .filter((p) => !planIds.has(p.recipe.id) && p.items.has(key))
          .sort((a, b) => b.recency - a.recency)[0];
        return {
          item: c.item,
          shelfDays: c.shelfDays,
          useUpWith: other ? { id: other.recipe.id, title: other.recipe.title } : null,
        };
      });
    const fresh = [...counts.values()].filter((c) => c.shelfDays <= 7);
    return {
      kind,
      ...OPTION_TEXT[kind],
      meals,
      sharedFresh: [...counts.values()]
        .filter((c) => c.meals > 1 && isFresh(c.shelfDays))
        .sort((a, b) => b.meals - a.meals || a.shelfDays - b.shelfDays)
        .map(({ item, meals, shelfDays }) => ({ item, meals, shelfDays })),
      atRisk,
      spoilsFirst: [...counts.values()]
        .filter((c) => c.lastDay > c.shelfDays)
        .map((c) => ({ item: c.item, shelfDays: c.shelfDays, day: DAYS[c.lastDay] })),
      itemsToBuy: counts.size,
      freshShared: fresh.length ? Math.round((100 * fresh.filter((c) => c.meals > 1).length) / fresh.length) : 100,
    };
  });
  return result;
}
