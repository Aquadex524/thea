// Checks the weekly optimizer on a small made-up library: npx tsx scripts/test-optimizer.mts
import assert from "node:assert/strict";
import { planWeek, type PlanRecipe } from "../src/lib/plan/optimizer.ts";

const now = new Date("2026-11-25T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const ing = (key: string, shelfDays: number, staple = false) => ({ key, label: key, shelfDays, staple });
const r = (id: string, age: number, items: ReturnType<typeof ing>[]): PlanRecipe => ({
  id, title: id, prepMinutes: 10, cookMinutes: 20, servings: 2, savedAt: daysAgo(age),
  ingredients: [ing("salt", 999, true), ing("olive oil", 365, true), ...items],
});

const library = [
  r("cilantro-lime-chicken", 20, [ing("chicken thigh", 2), ing("cilantro", 3), ing("lime", 14), ing("rice", 180)]),
  r("chicken-tacos", 25, [ing("chicken thigh", 2), ing("cilantro", 3), ing("tortilla", 7), ing("onion", 30)]),
  r("cilantro-rice-bowl", 30, [ing("cilantro", 3), ing("rice", 180), ing("black bean", 180), ing("lime", 14)]),
  r("cream-pasta", 2, [ing("heavy cream", 6), ing("pasta", 180), ing("parmesan", 30)]),
  r("tomato-soup", 1, [ing("heavy cream", 6), ing("tomato", 6), ing("basil", 3)]),
  r("beef-stew", 3, [ing("beef chuck", 2), ing("carrot", 21), ing("potato", 30), ing("celery", 14)]),
  r("mushroom-risotto", 40, [ing("mushroom", 5), ing("arborio rice", 180), ing("parmesan", 30)]),
];

// 1. Most efficient pick groups the three cilantro/chicken recipes.
const plan = planWeek(library, {}, now);
const eff = plan.options[0];
assert.equal(eff.kind, "efficient");
assert.deepEqual(eff.meals.map((m) => m.recipe.id).sort(), ["chicken-tacos", "cilantro-lime-chicken", "cilantro-rice-bowl"]);
assert.deepEqual(eff.meals.map((m) => m.day), ["sun", "mon", "tue"]);
assert.ok(eff.sharedFresh.some((f) => f.item === "cilantro" && f.meals === 3));
// Chicken keeps ~2 days, so both chicken meals land on Sun/Mon, before the rice bowl.
assert.equal(eff.meals[2].recipe.id, "cilantro-rice-bowl", "rice bowl (no chicken) goes last");
assert.equal(eff.meals[0].leftoverDay, "tue");
assert.equal(eff.spoilsFirst.length, 0);

// 2. Three different options, newest leans on the recently saved ones.
assert.equal(plan.options.length, 3);
assert.equal(new Set(plan.options.map((o) => o.meals.map((m) => m.recipe.id).sort().join())).size, 3);
const newest = plan.options.find((o) => o.kind === "newest")!;
assert.ok(newest.meals.some((m) => m.recipe.id === "tomato-soup"));

// 3. A pinned recipe is always included and the cream gets used twice (soup + pasta).
const pinned = planWeek(library, { pinned: ["tomato-soup"], cookDays: ["sun", "mon"] }, now);
for (const o of pinned.options) assert.ok(o.meals.some((m) => m.recipe.id === "tomato-soup"), o.kind);
assert.ok(pinned.options[0].meals.some((m) => m.recipe.id === "cream-pasta"), "heavy cream shared");

// 4. "Use it up" suggestions point at a library recipe outside the plan.
const lonely = planWeek(library, { pinned: ["mushroom-risotto", "beef-stew", "chicken-tacos"] }, now).options[0];
const cil = lonely.atRisk.find((a) => a.item === "cilantro");
assert.ok(cil?.useUpWith, "suggests another cilantro recipe");

// 5. Avoid + skip + cook days.
const avoid = planWeek(library, { avoid: ["cilantro"], skipped: ["beef-stew"], cookDays: ["sun", "wed"] }, now);
for (const o of avoid.options) {
  assert.equal(o.meals.length, 2);
  assert.deepEqual(o.meals.map((m) => m.day), ["sun", "wed"]);
  for (const m of o.meals) assert.ok(!["cilantro-lime-chicken", "chicken-tacos", "cilantro-rice-bowl", "beef-stew"].includes(m.recipe.id));
}
assert.equal(avoid.excluded.length, 4);

// 6. Tiny or empty library.
assert.equal(planWeek([], {}, now).options.length, 0);
const one = planWeek(library.slice(0, 1), {}, now);
assert.equal(one.options.length, 1);
assert.ok(one.note);

// 7. Big library stays fast.
const big = Array.from({ length: 150 }, (_, i) =>
  r(`r${i}`, i % 60, [ing(`veg${i % 17}`, 5), ing(`herb${i % 11}`, 3), ing(`meat${i % 7}`, 2), ing("rice", 180)]),
);
const t = performance.now();
const bigPlan = planWeek(big, { cookDays: ["sun", "mon", "tue", "wed"] }, now);
const ms = performance.now() - t;
assert.equal(bigPlan.options[0].meals.length, 4);
assert.ok(ms < 3000, `took ${ms}ms`);

console.log("All optimizer checks passed", `(150-recipe library planned in ${Math.round(ms)} ms)`);
console.log(JSON.stringify(plan.options.map((o) => ({ kind: o.kind, meals: o.meals.map((m) => `${m.day} ${m.recipe.id}`), shared: o.sharedFresh.map((f) => f.item), atRisk: o.atRisk.map((a) => a.item) })), null, 1));
