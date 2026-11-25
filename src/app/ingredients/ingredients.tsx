"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Tier } from "@/lib/ingredients/tiers";
import { TIERS } from "@/lib/ingredients/tiers";
import AccessCode from "../access-code";
import { authFetch } from "../token";

type Item = {
  name: string;
  category: string;
  tier: Tier;
  shelf_days: number;
  staple: boolean;
  source: string;
  recipes: number;
  seen_as: string[];
};

const ORDER: Tier[] = ["days", "week", "weeks", "pantry"];

/** Every grocery item your saved recipes use, grouped by how fast it goes off. */
export default function Ingredients() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (recheck = false) => {
    try {
      const res = await authFetch("/api/ingredients", recheck ? { method: "POST", body: "{}" } : { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) return setNeedsCode(true);
      if (!res.ok) throw new Error(data.error ?? "Couldn't load ingredients");
      setNeedsCode(false);
      setError(null);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load ingredients");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recheck = async () => {
    setWorking(true);
    await load(true);
    setWorking(false);
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = (items ?? []).filter((i) => !q || i.name.includes(q) || i.seen_as.some((s) => s.includes(q)));
    return ORDER.map((tier) => ({ tier, items: shown.filter((i) => i.tier === tier) })).filter((g) => g.items.length);
  }, [items, query]);

  if (needsCode) return <AccessCode onSaved={() => load()} />;
  if (error) return <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>;
  if (!items) return <p className="py-10 text-center text-sm text-muted">Sorting your ingredients…</p>;
  if (!items.length)
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
        No ingredients yet. Save a recipe and its groceries show up here.
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Every grocery item your saved recipes use. Different names for the same thing are merged into one, and each item
        says how long it keeps, so the weekly plan can cook the delicate stuff first.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ingredients"
          className="flex-1 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[15px] outline-none focus:border-navy"
        />
        <span className="shrink-0 text-xs text-muted tabular-nums">{items.length} items</span>
      </div>

      {groups.map(({ tier, items }) => (
        <section key={tier} className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-semibold">{TIERS[tier].label}</h2>
            <p className="text-xs text-muted">{TIERS[tier].help}</p>
          </div>
          <ul className="divide-y divide-line">
            {items.map((i) => {
              const others = i.seen_as.filter((s) => s !== i.name);
              return (
                <li key={i.name} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium capitalize">
                      {i.name}
                      {i.staple && <span className="ml-1.5 text-xs font-normal normal-case text-muted">staple</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {i.recipes} {i.recipes === 1 ? "recipe" : "recipes"} · ~{i.shelf_days}d
                    </span>
                  </div>
                  {others.length > 0 && <p className="mt-0.5 text-xs text-muted">Also written as: {others.join(", ")}</p>}
                  {i.source === "guess" && (
                    <p className="mt-0.5 text-xs text-warn-ink">Best guess, Claude will double-check it next time.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <button onClick={recheck} disabled={working} className="text-sm font-medium text-navy disabled:opacity-40">
        {working ? "Re-checking…" : "Re-check all ingredients"}
      </button>
    </div>
  );
}
