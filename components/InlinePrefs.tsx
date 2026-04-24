"use client";
import {
  type Preferences,
  BUDGET_PRESETS,
  QUIZ_CUISINES,
} from "@/lib/platforms";
import { sfx } from "@/lib/sfx";

type Props = {
  prefs: Preferences;
  onChange: (next: Preferences) => void;
};

export function InlinePrefs({ prefs, onChange }: Props) {
  function update(patch: Partial<Preferences>) {
    sfx.pop();
    onChange({ ...prefs, ...patch });
  }

  function toggleCuisine(c: string) {
    const has = prefs.cuisines.includes(c);
    update({
      cuisines: has
        ? prefs.cuisines.filter((x) => x !== c)
        : [...prefs.cuisines, c],
    });
  }

  return (
    <div className="mt-8 w-full max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-3 items-start text-left">
        <p className="font-mono text-[10px] uppercase tracking-widest faint pt-2 sm:text-right">
          Budget cap
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BUDGET_PRESETS.map((b) => {
            const on = prefs.budgetMax === b;
            return (
              <button
                key={b}
                onClick={() => update({ budgetMax: b })}
                className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 border rounded-sm transition-all ${
                  on
                    ? "border-transparent bg-[var(--ink)] text-[var(--bg)]"
                    : "hairline faint hover:text-[var(--ink)] hover:border-[var(--ink)]"
                }`}
              >
                ≤ ₹{b}
              </button>
            );
          })}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-widest faint pt-2 sm:text-right">
          Loves
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUIZ_CUISINES.map((c) => {
            const on = prefs.cuisines.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleCuisine(c)}
                className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 border rounded-sm transition-all ${
                  on
                    ? "border-transparent bg-[var(--seal)] text-white"
                    : "hairline faint hover:text-[var(--ink)] hover:border-[var(--ink)]"
                }`}
              >
                {c}
              </button>
            );
          })}
          {prefs.cuisines.length > 0 && (
            <button
              onClick={() => update({ cuisines: [] })}
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1.5 faint hover:text-[var(--ink)] transition-colors"
              title="clear loves"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
