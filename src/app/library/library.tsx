"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecipeSummary } from "@/lib/library";
import AccessCode from "../access-code";
import { authFetch } from "../token";

type Summary = Omit<RecipeSummary, "created_at" | "last_shared_at"> & { created_at: string; last_shared_at: string };

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1 && new Date().getDate() === d.getDate()) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: days > 300 ? "numeric" : undefined });
}

export default function Library() {
  const [recipes, setRecipes] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/recipes", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) return setNeedsCode(true);
      if (!res.ok) throw new Error(data.error ?? "Couldn't load the library");
      setNeedsCode(false);
      setError(null);
      setRecipes(data.recipes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the library");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While something is still being read, check back every few seconds.
  const busy = recipes?.some((r) => r.status === "pending");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [busy, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!recipes || !q) return recipes;
    return recipes.filter((r) =>
      [r.title, r.author, ...r.tags, ...(r.items ?? [])].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [recipes, query]);

  if (needsCode) return <AccessCode onSaved={load} />;
  if (error) return <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>;
  if (!recipes) return <p className="py-10 text-center text-sm text-muted">Loading your library…</p>;
  if (!recipes.length)
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted">
        Nothing saved yet. Share a TikTok to Thea and it will show up here.
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes, creators, ingredients"
          className="flex-1 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[15px] outline-none focus:border-navy"
        />
        <span className="shrink-0 text-xs text-muted tabular-nums">{recipes.length} saved</span>
      </div>
      <ul className="space-y-2">
        {shown?.map((r) => (
          <li key={r.id}>
            <Link href={`/recipes/${r.id}`} className="block rounded-2xl border border-line bg-card p-4 shadow-sm active:scale-[0.995]">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words font-semibold leading-snug">
                  {r.title ??
                    (r.status === "pending"
                      ? "Reading the video…"
                      : r.status === "failed"
                        ? "Couldn't read this video"
                        : "Untitled")}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {[
                  r.author && `@${r.author}`,
                  fmtDate(r.created_at),
                  r.total_minutes && `${r.total_minutes} min`,
                  r.item_count ? `${r.item_count} items` : null,
                  r.times_shared > 1 && `shared ${r.times_shared}×`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {r.fresh_items?.length > 0 && (
                <p className="mt-1 text-xs text-rust">Use fast: {r.fresh_items.join(", ")}</p>
              )}
              {r.status === "failed" && r.error && <p className="mt-1 text-xs text-rust">{r.error}</p>}
              {r.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-medium text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: Summary["status"] }) {
  if (status === "ready") return null;
  const [label, cls] =
    status === "pending"
      ? ["Reading", "bg-gold/20 text-warn-ink animate-pulse"]
      : status === "failed"
        ? ["Failed", "bg-rust/15 text-rust"]
        : ["Not a recipe", "bg-bg text-muted"];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}
