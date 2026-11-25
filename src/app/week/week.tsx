"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DayName, PlanOption, PlanResult, PlanSettings } from "@/lib/plan/optimizer";
import AccessCode from "../access-code";
import { authFetch } from "../token";

const DAY_LABEL: Record<DayName, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};
const ALL_DAYS: DayName[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** The coming Sunday (today if it is Sunday): groceries arrive Sunday. */
function weekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
}
const dateOf = (offset: number) => {
  const d = weekStart();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const minutes = (m: number | null) => (m ? `${m} min` : "–");

export default function Week() {
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [library, setLibrary] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [pick, setPick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [avoidText, setAvoidText] = useState("");

  const apply = useCallback(async (res: Response) => {
    const data = await res.json();
    if (res.status === 401) return setNeedsCode(true);
    if (!res.ok) throw new Error(data.error ?? "Couldn't plan the week");
    setNeedsCode(false);
    setError(null);
    setPlan(data.plan);
    setLibrary(data.library);
    setAvoidText(data.plan.settings.avoid.join(", "));
  }, []);

  const load = useCallback(
    () => authFetch("/api/plan", { cache: "no-store" }).then(apply).catch((e) => setError(e.message)),
    [apply],
  );
  useEffect(() => {
    load();
  }, [load]);

  const update = async (change: Partial<PlanSettings>) => {
    if (!plan) return;
    setSaving(true);
    try {
      await apply(
        await authFetch("/api/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: { ...plan.settings, ...change } }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  if (needsCode) return <AccessCode onSaved={load} />;
  if (error && !plan) return <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>;
  if (!plan) return <p className="py-10 text-center text-sm text-muted">Planning your week…</p>;

  const s = plan.settings;
  const option: PlanOption | undefined = plan.options[Math.min(pick, plan.options.length - 1)];
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const titleOf = (id: string) => library.find((r) => r.id === id)?.title ?? "A recipe no longer saved";

  return (
    <div className={`space-y-4 ${saving ? "opacity-60 transition-opacity" : ""}`}>
      <div>
        <p className="text-sm text-muted">Week of {dateOf(0)}</p>
        <h2 className="text-2xl font-bold tracking-tight">This week&apos;s recipes</h2>
      </div>

      {error && <div className="rounded-2xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">{error}</div>}
      {plan.note && (
        <div className="rounded-2xl border border-gold/40 bg-warn-bg p-4 text-sm text-warn-ink">
          {plan.note}{" "}
          {!plan.candidates && (
            <Link href="/" className="font-semibold underline">
              Add a recipe
            </Link>
          )}
        </div>
      )}

      {plan.options.length > 1 && (
        <div className="flex gap-1 rounded-full border border-line bg-bg p-1">
          {plan.options.map((o, i) => (
            <button
              key={o.kind}
              onClick={() => setPick(i)}
              className={`flex-1 rounded-full px-2 py-1.5 text-sm font-medium transition ${i === pick ? "bg-card text-ink shadow-sm" : "text-muted"}`}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}

      {option && (
        <>
          <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
            <p className="text-sm text-muted">{option.tagline}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat big={String(option.meals.length)} small={option.meals.length === 1 ? "meal to cook" : "meals to cook"} />
              <Stat big={String(option.itemsToBuy)} small="items to buy" />
              <Stat big={`${option.freshShared}%`} small="fresh items shared" />
            </div>
          </section>

          <ul className="space-y-2">
            {option.meals.map((m) => (
              <li key={m.recipe.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-lg font-bold leading-none">{DAY_LABEL[m.day]}</p>
                    <p className="mt-1 text-[11px] text-muted">{dateOf(m.offset)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/recipes/${m.recipe.id}`} className="block break-words text-[17px] font-bold leading-snug">
                      {m.recipe.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      Prep {minutes(m.recipe.prepMinutes)} · Cook {minutes(m.recipe.cookMinutes)}
                      {m.leftoverDay && ` · Leftovers ${DAY_LABEL[m.leftoverDay]}`}
                    </p>
                    {m.shared.length > 0 && (
                      <p className="mt-1.5 text-xs text-good">Shares {m.shared.join(", ")}</p>
                    )}
                    <div className="mt-2 flex gap-3 text-xs font-medium">
                      <button onClick={() => update({ pinned: toggle(s.pinned, m.recipe.id) })} className="text-navy">
                        {m.pinned ? "★ Pinned" : "☆ Pin"}
                      </button>
                      <button
                        onClick={() => update({ skipped: [...s.skipped, m.recipe.id], pinned: s.pinned.filter((x) => x !== m.recipe.id) })}
                        className="text-muted"
                      >
                        Not this week
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {option.sharedFresh.length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h3 className="font-semibold">Fresh items that get used up</h3>
              <p className="mt-0.5 text-xs text-muted">Bought once, used in more than one meal</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {option.sharedFresh.map((f) => (
                  <li key={f.item} className="rounded-full bg-good/10 px-2.5 py-1 text-xs font-medium text-good">
                    {f.item} × {f.meals}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(option.atRisk.length > 0 || option.spoilsFirst.length > 0) && (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h3 className="font-semibold">Might go to waste</h3>
              <p className="mt-0.5 text-xs text-muted">Fresh items only one meal uses</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {option.spoilsFirst.map((f) => (
                  <li key={`spoil-${f.item}`} className="text-rust">
                    {f.item} keeps about {f.shelfDays} days, but {DAY_LABEL[f.day]}&apos;s meal needs it
                  </li>
                ))}
                {option.atRisk.map((f) => (
                  <li key={f.item} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>
                      <span className="font-medium">{f.item}</span>
                      <span className="text-xs text-muted"> · keeps ~{f.shelfDays} days</span>
                    </span>
                    {f.useUpWith && (
                      <button
                        onClick={() => update({ pinned: [...s.pinned, f.useUpWith!.id] })}
                        className="text-left text-xs font-medium text-navy"
                      >
                        Use it up: add {f.useUpWith.title}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl border border-line bg-card p-4">
        <button onClick={() => setShowSettings(!showSettings)} className="flex w-full items-center justify-between">
          <span className="font-semibold">Settings</span>
          <span className="text-xs text-muted">
            {s.cookDays.map((d) => DAY_LABEL[d]).join(", ")} · {s.servingsPerRecipe} portions {showSettings ? "▲" : "▼"}
          </span>
        </button>
        {showSettings && (
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium">Cook days</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_DAYS.map((d) => {
                  const on = s.cookDays.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => update({ cookDays: on ? s.cookDays.filter((x) => x !== d) : [...s.cookDays, d] })}
                      disabled={on && s.cookDays.length === 1}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-navy bg-navy text-white dark:text-[#0b1218]" : "border-line text-muted"}`}
                    >
                      {DAY_LABEL[d]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">One new recipe per cook day.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Portions per recipe</p>
                <p className="text-xs text-muted">Extra portions become leftovers {s.leftoverGapDays} days later</p>
              </div>
              <div className="flex items-center gap-2">
                <Stepper label="−" onClick={() => update({ servingsPerRecipe: s.servingsPerRecipe - 1 })} disabled={s.servingsPerRecipe <= 1} />
                <span className="w-5 text-center font-semibold tabular-nums">{s.servingsPerRecipe}</span>
                <Stepper label="+" onClick={() => update({ servingsPerRecipe: s.servingsPerRecipe + 1 })} disabled={s.servingsPerRecipe >= 8} />
              </div>
            </div>
            <div>
              <p className="font-medium">Ingredients to avoid</p>
              <input
                value={avoidText}
                onChange={(e) => setAvoidText(e.target.value)}
                onBlur={() => {
                  const avoid = avoidText.split(",").map((a) => a.trim()).filter(Boolean);
                  if (avoid.join(",") !== s.avoid.join(",")) update({ avoid });
                }}
                placeholder="e.g. mushroom, cilantro"
                className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-navy"
              />
            </div>
            {(s.pinned.length > 0 || s.skipped.length > 0) && (
              <div className="space-y-1">
                {s.pinned.map((id) => (
                  <Chip key={`p${id}`} text={`★ ${titleOf(id)}`} onRemove={() => update({ pinned: s.pinned.filter((x) => x !== id) })} />
                ))}
                {s.skipped.map((id) => (
                  <Chip key={`s${id}`} text={`Skipped: ${titleOf(id)}`} onRemove={() => update({ skipped: s.skipped.filter((x) => x !== id) })} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <p className="px-1 text-xs text-muted">
        Picked from {plan.candidates} saved recipe{plan.candidates === 1 ? "" : "s"}
        {plan.excluded.length > 0 && ` (${plan.excluded.length} left out: ${plan.excluded.map((e) => `${e.title}, ${e.reason.toLowerCase()}`).join("; ")})`}.
      </p>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums leading-none">{big}</p>
      <p className="mt-1 text-[11px] text-muted">{small}</p>
    </div>
  );
}

function Stepper({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="h-8 w-8 rounded-full border border-line text-lg leading-none disabled:opacity-30">
      {label}
    </button>
  );
}

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-1.5 text-xs">
      <span className="min-w-0 truncate">{text}</span>
      <button onClick={onRemove} className="shrink-0 font-medium text-navy">
        Undo
      </button>
    </div>
  );
}
