"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type Preferences,
  DEFAULT_PREFS,
  QUIZ_CUISINES,
  DONT_EAT_OPTIONS,
  BUDGET_PRESETS,
} from "@/lib/platforms";

type Step =
  | "diet"
  | "dontEat"
  | "cuisines"
  | "budget"
  | "vibe"
  | "spice"
  | "done";

const STEPS: Step[] = [
  "diet",
  "dontEat",
  "cuisines",
  "budget",
  "vibe",
  "spice",
];

const DIETS: { v: Preferences["diet"]; label: string }[] = [
  { v: "any", label: "I eat everything" },
  { v: "veg", label: "Vegetarian" },
  { v: "vegan", label: "Vegan" },
  { v: "halal", label: "Halal only" },
];

const VIBES: { v: Preferences["vibe"]; label: string; sub: string }[] = [
  { v: "cheap", label: "Cheap", sub: "fill me up, save me money" },
  { v: "healthy", label: "Healthy", sub: "I'll feel good after" },
  { v: "treat", label: "Treat", sub: "I deserve it" },
  { v: "adventure", label: "Adventure", sub: "surprise me" },
];

const SPICES: { v: Preferences["spice"]; label: string; jp: string }[] = [
  { v: "mild", label: "Mild", jp: "辛さ・弱" },
  { v: "medium", label: "Medium", jp: "辛さ・中" },
  { v: "hot", label: "Hot", jp: "辛さ・強" },
];

export default function Quiz() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const step = STEPS[stepIdx];
  const startedAtRef = useState(() => Date.now())[0];

  useEffect(() => {
    const stored = localStorage.getItem("pickless_prefs");
    if (stored) setPrefs(JSON.parse(stored));
  }, []);

  function commit(next: Preferences) {
    setPrefs(next);
    localStorage.setItem("pickless_prefs", JSON.stringify(next));
  }

  function advance() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      const elapsed = Math.round((Date.now() - startedAtRef) / 1000);
      localStorage.setItem("pickless_quiz_elapsed", String(elapsed));
      router.push("/connect");
    }
  }

  function pickDiet(v: Preferences["diet"]) {
    commit({ ...prefs, diet: v });
    setTimeout(advance, 180);
  }

  function pickVibe(v: Preferences["vibe"]) {
    commit({ ...prefs, vibe: v });
    setTimeout(advance, 180);
  }

  function pickSpice(v: Preferences["spice"]) {
    commit({ ...prefs, spice: v });
    setTimeout(advance, 180);
  }

  function toggleCuisine(c: string) {
    const next = prefs.cuisines.includes(c)
      ? prefs.cuisines.filter((x) => x !== c)
      : [...prefs.cuisines, c];
    commit({ ...prefs, cuisines: next });
  }

  function skip() {
    advance();
  }

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <a href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </a>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          step {stepIdx + 1} / {STEPS.length}
        </span>
      </nav>

      {/* Progress hairline */}
      <div className="h-px bg-[var(--line)] relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-[var(--seal)] transition-all duration-500"
          style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 max-w-xl mx-auto w-full">
        {step === "diet" && (
          <div key="diet" className="rise w-full text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
              5-second setup
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-10">
              Anything <em className="text-[var(--seal)]">off-limits?</em>
            </h1>
            <div className="flex flex-wrap gap-2 justify-center">
              {DIETS.map((d) => (
                <button
                  key={d.v}
                  onClick={() => pickDiet(d.v)}
                  className={`px-5 py-3 border rounded-sm font-mono text-xs uppercase tracking-widest transition-all ${
                    prefs.diet === d.v
                      ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
                      : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "cuisines" && (
          <div key="cuisines" className="rise w-full text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
              tap any that hit
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-10">
              What <em className="text-[var(--seal)]">hits?</em>
            </h1>
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {QUIZ_CUISINES.map((c) => {
                const on = prefs.cuisines.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCuisine(c)}
                    className={`px-5 py-3 border rounded-sm font-mono text-xs uppercase tracking-widest transition-all ${
                      on
                        ? "border-transparent bg-[var(--seal)] text-white"
                        : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <button
              onClick={advance}
              className="px-8 py-3 border border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] hover:border-transparent transition-colors"
            >
              {prefs.cuisines.length > 0
                ? `Next · ${prefs.cuisines.length} picked →`
                : "Skip →"}
            </button>
          </div>
        )}

        {step === "dontEat" && (
          <div key="dontEat" className="rise w-full text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
              hard exclusions · agent never breaks these
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-10">
              What do you <em className="text-[var(--seal)]">not eat?</em>
            </h1>
            <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-xl mx-auto">
              {DONT_EAT_OPTIONS.map((d) => {
                const on = prefs.dontEat.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() =>
                      commit({
                        ...prefs,
                        dontEat: on
                          ? prefs.dontEat.filter((x) => x !== d)
                          : [...prefs.dontEat, d],
                      })
                    }
                    className={`px-4 py-2.5 border rounded-sm font-mono text-xs uppercase tracking-widest transition-all ${
                      on
                        ? "border-transparent bg-[var(--seal)] text-white"
                        : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <button
              onClick={advance}
              className="px-8 py-3 border border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] hover:border-transparent transition-colors"
            >
              {prefs.dontEat.length > 0
                ? `Next · ${prefs.dontEat.length} excluded →`
                : "Nothing off-limits →"}
            </button>
          </div>
        )}

        {step === "budget" && (
          <div key="budget" className="rise w-full text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
              hard cap · agent stays under
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-10">
              What&apos;s your <em className="text-[var(--seal)]">budget?</em>
            </h1>
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {BUDGET_PRESETS.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    commit({ ...prefs, budgetMax: b });
                    setTimeout(advance, 200);
                  }}
                  className={`px-7 py-5 border rounded-sm transition-all ${
                    prefs.budgetMax === b
                      ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
                      : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                >
                  <p className="font-display text-2xl tracking-tight">₹{b}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest opacity-75 mt-1">
                    {b <= 200
                      ? "tight"
                      : b <= 350
                        ? "everyday"
                        : b <= 500
                          ? "treat self"
                          : b <= 800
                            ? "feast"
                            : "blow it out"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "vibe" && (
          <div key="vibe" className="rise w-full text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
              right now
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-10">
              What&apos;s the <em className="text-[var(--seal)]">vibe?</em>
            </h1>
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
              {VIBES.map((v) => (
                <button
                  key={v.v}
                  onClick={() => pickVibe(v.v)}
                  className={`px-5 py-5 border rounded-sm text-left transition-all ${
                    prefs.vibe === v.v
                      ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
                      : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                >
                  <p className="font-display text-xl tracking-tight mb-0.5">
                    {v.label}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-widest opacity-75">
                    {v.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "spice" && (
          <div key="spice" className="rise w-full text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
              last one
            </p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-10">
              <em className="text-[var(--seal)]">Spice</em> tolerance?
            </h1>
            <div className="flex flex-wrap gap-2 justify-center">
              {SPICES.map((s) => (
                <button
                  key={s.v}
                  onClick={() => pickSpice(s.v)}
                  className={`px-7 py-5 border rounded-sm transition-all ${
                    prefs.spice === s.v
                      ? "border-transparent bg-[var(--seal)] text-white"
                      : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                  }`}
                >
                  <p className="font-display text-2xl tracking-tight">
                    {s.label}
                  </p>
                  <p className="font-jp text-xs opacity-75 mt-1">{s.jp}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={skip}
          className="mt-10 font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
        >
          Skip rest →
        </button>
      </div>
    </main>
  );
}
