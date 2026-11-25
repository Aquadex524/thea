"use client";

import { useState } from "react";
import { authFetch } from "../../token";

type Result = { url: string; itemCount: number; environment: "development" | "production" };

/** "Shop on Instacart": turns this recipe's ingredients into an Instacart shopping list. */
export default function SendToInstacart({ recipeId }: { recipeId: string }) {
  const [includeStaples, setIncludeStaples] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 text-sm">
      <button
        onClick={send}
        disabled={working}
        className="flex h-[46px] w-full items-center justify-center rounded-full bg-[#003D29] px-5 font-semibold text-[#FAF1E5] disabled:opacity-50"
      >
        {working ? "Making your list…" : "Shop on Instacart"}
      </button>
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
      {error && <p className="text-rust">{error}</p>}
    </div>
  );
}
