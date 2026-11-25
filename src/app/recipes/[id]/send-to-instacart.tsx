"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../token";

type Result = { url: string; itemCount: number; environment: "development" | "production" };
type Item = { name: string; label: string; amount: string; searchUrl: string };

/**
 * "Shop on Instacart": turns this recipe's ingredients into an Instacart shopping list.
 * Until Thea has an Instacart API key, it shows the list item by item instead, each item
 * linking to a search for it at Key Food on Instacart.
 */
export default function SendToInstacart({ recipeId }: { recipeId: string }) {
  const [includeStaples, setIncludeStaples] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [showItems, setShowItems] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const loadItems = useCallback(async () => {
    try {
      const res = await authFetch(`/api/instacart?recipeId=${recipeId}&includeStaples=${includeStaples ? 1 : 0}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load the shopping list");
      setConfigured(data.configured);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the shopping list");
    }
  }, [recipeId, includeStaples]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const send = async () => {
    setWorking(true);
    setError(null);
    // Open the tab right away (inside the tap) so phones don't block it as a pop-up.
    const tab = window.open("", "_blank");
    try {
      const res = await authFetch("/api/instacart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, includeStaples }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't make the Instacart list");
      setResult(data);
      if (tab) tab.location.href = data.url;
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Couldn't make the Instacart list");
    } finally {
      setWorking(false);
    }
  };

  const itemList = (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <li key={it.name}>
          <a
            href={it.searchUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => setDone((d) => new Set(d).add(it.name))}
            className={`flex items-center justify-between gap-3 py-2.5 ${done.has(it.name) ? "opacity-40" : ""}`}
          >
            <span className="font-medium text-ink">
              {done.has(it.name) && "✓ "}
              {it.label}
              {it.amount && <span className="font-normal text-muted"> · {it.amount}</span>}
            </span>
            <span className="shrink-0 font-medium text-navy">Find →</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 text-sm">
      {configured !== false && (
        <button
          onClick={send}
          disabled={working || configured === null}
          className="flex h-[46px] w-full items-center justify-center rounded-full bg-[#003D29] px-5 font-semibold text-[#FAF1E5] disabled:opacity-50"
        >
          {working ? "Making your list…" : "Shop on Instacart"}
        </button>
      )}
      {configured === false && (
        <div>
          <p className="font-semibold text-ink">Shop on Instacart, item by item</p>
          <p className="mt-0.5 text-muted">Tap each item to find it at Key Food on Instacart and add it to your cart.</p>
        </div>
      )}

      <label className="flex items-center gap-2 text-muted">
        <input
          type="checkbox"
          checked={includeStaples}
          onChange={(e) => {
            setIncludeStaples(e.target.checked);
            setResult(null);
          }}
          className="h-4 w-4 accent-[#003D29]"
        />
        Include staples (salt, oil, butter, spices)
      </label>

      {result && (
        <p className="text-muted">
          {result.itemCount} items sent.{" "}
          <a href={result.url} target="_blank" rel="noreferrer" className="font-medium text-navy">
            Open the list on Instacart
          </a>
          {result.environment === "development" && " (test mode)"}
        </p>
      )}

      {configured === false && itemList}
      {configured && items.length > 0 && (
        <div>
          <button onClick={() => setShowItems((s) => !s)} className="font-medium text-navy">
            {showItems ? "Hide item list" : "Or shop item by item"}
          </button>
          {showItems && <div className="mt-2">{itemList}</div>}
        </div>
      )}

      {error && <p className="text-rust">{error}</p>}
    </div>
  );
}
