"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Preferences,
  DEFAULT_PREFS,
  DONT_EAT_OPTIONS,
} from "@/lib/platforms";
import type { PredictedPrefs } from "@/app/api/predict-prefs/route";

const DIET_CARDS: {
  v: Preferences["diet"];
  label: string;
  jp: string;
  sub: string;
}[] = [
  { v: "any", label: "Eats everything", jp: "全", sub: "no restrictions" },
  { v: "veg", label: "Vegetarian", jp: "菜", sub: "no meat or fish" },
  { v: "vegan", label: "Vegan", jp: "純", sub: "plants only" },
  { v: "halal", label: "Halal only", jp: "清", sub: "halal-certified" },
];

export default function Profile() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [predicted, setPredicted] = useState<PredictedPrefs | null>(null);
  const [predicting, setPredicting] = useState(true);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("pickless_prefs");
    if (saved) setPrefs(JSON.parse(saved));

    void runPrediction();
  }, []);

  async function runPrediction() {
    const o = localStorage.getItem("pickless_orders");
    if (!o) {
      setPredicting(false);
      return;
    }
    const orders = JSON.parse(o);
    setOrderCount(orders.length);
    if (orders.length === 0) {
      setPredicting(false);
      return;
    }

    try {
      const r = await fetch("/api/predict-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const d = await r.json();
      if (d.predicted) {
        setPredicted(d.predicted);
        // Auto-apply predictions to prefs (user can override below)
        const cur =
          JSON.parse(localStorage.getItem("pickless_prefs") || "null") ||
          DEFAULT_PREFS;
        const next: Preferences = {
          ...cur,
          diet: d.predicted.diet || cur.diet,
          cuisines: d.predicted.cuisines?.length
            ? d.predicted.cuisines.slice(0, 6)
            : cur.cuisines,
          budgetMax: d.predicted.budgetBand?.hi || cur.budgetMax,
        };
        setPrefs(next);
        localStorage.setItem("pickless_prefs", JSON.stringify(next));
      }
    } catch {}
    setPredicting(false);
  }

  function commit(next: Preferences) {
    setPrefs(next);
    localStorage.setItem("pickless_prefs", JSON.stringify(next));
  }

  function toggleDontEat(item: string) {
    const has = prefs.dontEat.includes(item);
    commit({
      ...prefs,
      dontEat: has
        ? prefs.dontEat.filter((x) => x !== item)
        : [...prefs.dontEat, item],
    });
  }

  return (
    <main className="min-h-screen text-[var(--ink)]">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <a href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </a>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          step 3 · profile
        </span>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-14">
        <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
          {predicting ? (
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--seal)] pulse-soft inline-block" />
              Reading your {orderCount} orders…
            </span>
          ) : predicted ? (
            <span className="text-[var(--seal)]">
              ● {orderCount} orders read · pre-filled below
            </span>
          ) : (
            <span>no orders · pick manually</span>
          )}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-3">
          What does the agent{" "}
          <em className="text-[var(--seal)]">need to know?</em>
        </h1>
        <p className="text-sm faint mb-12 leading-relaxed max-w-md">
          {predicted
            ? "We've inferred from your history. Adjust anything that's wrong — these are hard rules the agent never breaks."
            : "Tap any cards that apply. The agent treats these as hard rules."}
        </p>

        {/* Diet */}
        <section className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
            Diet
            {predicted && (
              <span className="ml-3 normal-case text-[var(--seal)]">
                · predicted: {predicted.diet} (
                {Math.round(predicted.dietConfidence * 100)}% conf ·{" "}
                {predicted.dietWhy})
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIET_CARDS.map((d) => {
              const on = prefs.diet === d.v;
              return (
                <button
                  key={d.v}
                  onClick={() => commit({ ...prefs, diet: d.v })}
                  className={`flex flex-col items-start gap-2 p-4 border rounded-sm text-left transition-all ${
                    on
                      ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
                      : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                >
                  <span className="font-jp text-xl">{d.jp}</span>
                  <div>
                    <p className="font-display text-base tracking-tight">
                      {d.label}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-widest opacity-60 mt-0.5">
                      {d.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Loves */}
        {predicted?.loves && predicted.loves.length > 0 && (
          <section className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
              You love · pulled from history
            </p>
            <div className="flex flex-wrap gap-2">
              {predicted.loves.slice(0, 8).map((l) => (
                <span
                  key={l.item}
                  className="px-4 py-2.5 border border-[var(--seal)] rounded-sm bg-[var(--seal)]/10"
                  title={l.signal}
                >
                  <span className="font-display text-sm tracking-tight text-[var(--seal)]">
                    {l.item}
                  </span>
                  <span className="ml-2 font-mono text-[9px] uppercase tracking-widest faint">
                    {l.signal}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Likely OK */}
        {predicted?.likelyOk && predicted.likelyOk.length > 0 && (
          <section className="mb-12">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
              Likely OK · relational guess
            </p>
            <div className="flex flex-wrap gap-2">
              {predicted.likelyOk.slice(0, 6).map((l) => (
                <span
                  key={l.item}
                  className="px-3 py-2 border hairline rounded-sm flex items-center gap-2"
                  title={l.reason}
                >
                  <span className="font-display text-sm tracking-tight">
                    {l.item}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest faint">
                    {l.reason}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Don't eat / allergens */}
        <section className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
            Hard exclusions · agent never serves these
          </p>
          <div className="flex flex-wrap gap-2">
            {DONT_EAT_OPTIONS.map((d) => {
              const on = prefs.dontEat.includes(d);
              const flagged = predicted?.watchFor?.find((w) =>
                w.item.includes(d),
              );
              return (
                <button
                  key={d}
                  onClick={() => toggleDontEat(d)}
                  className={`px-4 py-2.5 border rounded-sm font-mono text-xs uppercase tracking-widest transition-all ${
                    on
                      ? "border-transparent bg-[var(--seal)] text-white"
                      : flagged
                        ? "border-[var(--seal)]/40 hover:bg-[var(--paper)]"
                        : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                  title={flagged?.reason || ""}
                >
                  {d}
                  {flagged && !on && <span className="ml-1 opacity-50">?</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Budget */}
        <section className="mb-14">
          <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
            Budget cap · agent stays under
            {predicted?.budgetBand && (
              <span className="ml-3 normal-case text-[var(--seal)]">
                · learned avg: ₹{predicted.budgetBand.lo}–
                {predicted.budgetBand.hi}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {[200, 350, 500, 800, 1500].map((b) => (
              <button
                key={b}
                onClick={() => commit({ ...prefs, budgetMax: b })}
                className={`px-5 py-3 border rounded-sm transition-all ${
                  prefs.budgetMax === b
                    ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
                    : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                }`}
              >
                <span className="font-display text-lg">₹{b}</span>
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={() => router.push("/app")}
          className="w-full py-4 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
        >
          Looks right · feed me →
        </button>
      </div>
    </main>
  );
}
