"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ImportResult } from "@/lib/recipe";
import Link from "next/link";
import RecipeCard from "./recipe-card";
import { TOKEN_KEY, readToken } from "./token";

export default function Importer() {
  const params = useSearchParams();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"link" | "text">("link");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const started = useRef(false);

  const run = useCallback(async (payload: { url?: string; text?: string }) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = readToken();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) {
        setNeedsCode(true);
        setError("Enter your Thea access code first.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // The iOS Shortcut opens /?url=<shared link>#token=<access code>; import straight away.
  // The token rides in the #fragment so it never reaches the server or its logs.
  useEffect(() => {
    if (started.current) return;
    const hashToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (hashToken) {
      try {
        localStorage.setItem(TOKEN_KEY, hashToken);
      } catch {}
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const shared = params.get("url") ?? params.get("text");
    if (shared) {
      started.current = true;
      setInput(shared);
      run(params.get("url") ? { url: shared } : { text: shared });
    }
  }, [params, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    run(mode === "link" ? { url: input.trim() } : { text: input.trim() });
  };

  const saveCode = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(TOKEN_KEY, code.trim());
    } catch {}
    setNeedsCode(false);
    setError(null);
    if (input.trim()) run(mode === "link" ? { url: input.trim() } : { text: input.trim() });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <div className="mb-3 flex gap-1 rounded-full bg-bg p-1 text-sm font-medium">
          {(["link", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-1.5 transition ${
                mode === m ? "bg-card text-ink shadow-sm" : "text-muted"
              }`}
            >
              {m === "link" ? "Video link" : "Paste text"}
            </button>
          ))}
        </div>
        {mode === "link" ? (
          <input
            type="url"
            inputMode="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.tiktok.com/@…/video/…"
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-[15px] outline-none focus:border-navy"
          />
        ) : (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            placeholder="Paste the caption or the recipe text"
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-[15px] outline-none focus:border-navy"
          />
        )}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="mt-3 w-full rounded-xl bg-navy py-3 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40 dark:text-[#0b1218]"
        >
          {loading ? "Reading the video…" : "Get recipe"}
        </button>
      </form>

      {needsCode && (
        <form onSubmit={saveCode} className="flex gap-2 rounded-2xl border border-line bg-card p-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-[15px] outline-none"
          />
          <button className="rounded-xl bg-navy px-4 font-semibold text-white dark:text-[#0b1218]">Save</button>
        </form>
      )}

      {error && (
        <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>
      )}

      {loading && <LoadingCard />}
      {result?.recipeId && (
        <Link
          href={`/recipes/${result.recipeId}`}
          className="block rounded-2xl border border-good/30 bg-good/10 p-3 text-center text-sm font-medium text-good"
        >
          Saved to your library
        </Link>
      )}
      {result && <RecipeCard result={result} />}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="animate-pulse space-y-3 rounded-2xl border border-line bg-card p-5">
      <div className="h-5 w-2/3 rounded bg-line" />
      <div className="h-3 w-1/3 rounded bg-line" />
      <div className="space-y-2 pt-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-line" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
