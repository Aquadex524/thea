"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { RecipeRow } from "@/lib/library";
import type { ImportResult } from "@/lib/recipe";
import AccessCode from "../../access-code";
import { fmtDate } from "../../library/library";
import RecipeCard from "../../recipe-card";
import SendToInstacart from "./send-to-instacart";
import { authFetch } from "../../token";

type Row = Omit<RecipeRow, "created_at" | "last_shared_at"> & { created_at: string; last_shared_at: string };

export default function SavedRecipe({ id }: { id: string }) {
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apply = useCallback(async (res: Response) => {
    const data = await res.json();
    if (res.status === 401) return setNeedsCode(true);
    if (!res.ok) throw new Error(data.error ?? "Couldn't load this recipe");
    setNeedsCode(false);
    setError(null);
    setRow(data.recipe);
    setResult(data.result);
  }, []);

  const load = useCallback(
    () => authFetch(`/api/recipes/${id}`, { cache: "no-store" }).then(apply).catch((e) => setError(e.message)),
    [id, apply],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (row?.status !== "pending") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [row?.status, load]);

  const retry = async () => {
    setWorking(true);
    try {
      await apply(await authFetch(`/api/recipes/${id}`, { method: "POST", body: JSON.stringify({ action: "retry" }) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await authFetch(`/api/recipes/${id}`, { method: "DELETE" });
    router.push("/library");
  };

  if (needsCode) return <AccessCode onSaved={load} />;
  if (error && !row) return <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>;
  if (!row) return <p className="py-10 text-center text-sm text-muted">Loading…</p>;

  const link = row.source_url ?? row.shared_url;
  const stale = row.status === "pending" && Date.now() - new Date(row.created_at).getTime() > 3 * 60_000;

  return (
    <div className="space-y-4">
      <Link href="/library" className="text-sm font-medium text-navy">
        ← Library
      </Link>

      {row.status === "pending" && !stale && (
        <div className="animate-pulse rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          Thea is reading this video and writing up the recipe…
        </div>
      )}
      {(row.status === "failed" || stale) && (
        <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">
          <p className="font-semibold">Thea couldn&apos;t read this one.</p>
          {row.error && <p className="mt-1">{row.error}</p>}
          <button
            onClick={retry}
            disabled={working}
            className="mt-3 rounded-xl bg-navy px-4 py-2 font-semibold text-white disabled:opacity-40 dark:text-[#0b1218]"
          >
            {working ? "Trying again…" : "Try again"}
          </button>
        </div>
      )}
      {error && row && <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>}

      {result && <RecipeCard result={result} />}

      {row.status === "ready" && result?.recipe.is_recipe && <SendToInstacart recipeId={row.id} />}

      <div className="space-y-1 rounded-2xl border border-line bg-card p-4 text-sm text-muted">
        <p>
          Saved {fmtDate(row.created_at)}
          {row.times_shared > 1 && ` · shared ${row.times_shared} times, last ${fmtDate(row.last_shared_at)}`}
        </p>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="block truncate font-medium text-navy">
            Open the original video
          </a>
        )}
        <div className="flex gap-3 pt-2">
          {row.status !== "pending" && (
            <button onClick={retry} disabled={working} className="font-medium text-navy disabled:opacity-40">
              {working ? "Re-reading…" : "Re-read video"}
            </button>
          )}
          <button onClick={remove} className="font-medium text-rust">
            {confirmDelete ? "Tap again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
