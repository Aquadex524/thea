"use client";

import type { ImportResult, Ingredient } from "@/lib/recipe";

const CATEGORY_LABEL: Record<Ingredient["category"], string> = {
  produce: "Produce",
  herbs: "Herbs",
  meat_seafood: "Meat & seafood",
  dairy_eggs: "Dairy & eggs",
  bakery: "Bakery",
  pantry: "Pantry",
  spices: "Spices",
  frozen: "Frozen",
  other: "Other",
};

function fmtQty(i: Ingredient): string {
  if (i.quantity == null) return "";
  const q = Number.isInteger(i.quantity) ? String(i.quantity) : String(+i.quantity.toFixed(2));
  return i.unit ? `${q} ${i.unit}` : q;
}

export default function RecipeCard({ result }: { result: ImportResult }) {
  const { recipe, source, warnings } = result;
  if (!recipe.is_recipe) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
        This video doesn&apos;t look like a recipe.
      </div>
    );
  }

  const groups = new Map<Ingredient["category"], Ingredient[]>();
  for (const ing of recipe.ingredients) {
    const list = groups.get(ing.category) ?? [];
    list.push(ing);
    groups.set(ing.category, list);
  }
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="border-b border-line p-5">
        {source.author && (
          <a
            href={source.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            @{source.author} · {source.platform}
          </a>
        )}
        <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{recipe.title}</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat
            label="Servings"
            value={recipe.servings != null ? `${recipe.servings}${recipe.servings_estimated ? "*" : ""}` : "–"}
          />
          <Stat label="Time" value={total ? `${total}m` : "–"} />
          <Stat label="Items" value={String(recipe.ingredients.filter((i) => !i.is_staple).length)} />
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tags.map((t) => (
              <span key={t} className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {(recipe.uncertainties.length > 0 || warnings.length > 0) && (
        <div className="border-b border-line bg-warn-bg p-4 text-sm text-warn-ink">
          <p className="mb-1 font-semibold">Double-check</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {[...warnings, ...recipe.uncertainties].map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="border-b border-line p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Ingredients</h3>
        <div className="space-y-4">
          {[...groups.entries()].map(([cat, items]) => (
            <div key={cat}>
              <p className="mb-1 text-xs font-semibold text-navy">{CATEGORY_LABEL[cat]}</p>
              <ul className="divide-y divide-line">
                {items.map((i, idx) => (
                  <li key={idx} className="flex items-baseline justify-between gap-3 py-2 text-[15px]">
                    <span>
                      <span className="font-medium capitalize">{i.name}</span>
                      {i.preparation && <span className="text-muted">, {i.preparation}</span>}
                      {i.is_staple && <span className="ml-1.5 text-xs text-muted">staple</span>}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${i.uncertain ? "text-warn-ink" : "text-ink"}`}
                      title={i.original_text}
                    >
                      {fmtQty(i)}
                      {i.uncertain ? " ?" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-line p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Steps</h3>
        <ol className="space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-[#0b1b2b]">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <details className="p-5 text-sm">
        <summary className="cursor-pointer font-medium text-muted">
          What Thea read ({source.transcript ? `caption + transcript from ${source.transcriptSource}` : "caption only"})
        </summary>
        <p className="mt-3 whitespace-pre-wrap text-muted">{source.caption || "(no caption)"}</p>
        {source.transcript && (
          <p className="mt-3 whitespace-pre-wrap border-t border-line pt-3 text-muted">{source.transcript}</p>
        )}
      </details>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
