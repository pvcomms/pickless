"use client";
import { type LovedPick, toggleLoved } from "@/lib/loved";
import { sfx } from "@/lib/sfx";
import { PLATFORMS, type Recommendation } from "@/lib/platforms";

type Props = {
  loved: LovedPick[];
  onChange: (next: LovedPick[]) => void;
  onReorder: (rec: Recommendation) => void;
};

export function LovedPanel({ loved, onChange, onReorder }: Props) {
  if (!loved || loved.length === 0) return null;

  function remove(p: LovedPick) {
    sfx.pop();
    const { loved: next } = toggleLoved({
      dish: p.dish,
      restaurant: p.restaurant,
      price: p.price,
    });
    onChange(next);
  }

  function reorder(p: LovedPick) {
    sfx.thunk();
    const platform = PLATFORMS[0];
    const asRec: Recommendation = {
      dish: p.dish,
      restaurant: p.restaurant,
      platform: "swiggy",
      price: p.price || "",
      reason: "loved — straight back to the agent",
      tags: ["loved"],
      sponsored: false,
      orderUrl: platform.searchUrl(`${p.dish} ${p.restaurant}`),
    };
    (asRec as any).vibe = "already loved once — the agent remembers";
    (asRec as any).order = p.dish;
    onReorder(asRec);
  }

  return (
    <div className="mt-12 w-full max-w-3xl text-left">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest faint flex items-center gap-2">
          <span className="font-jp text-[var(--seal)] not-italic">♥</span>
          Loved · {loved.length}
          <span className="opacity-60">· biasing every pick</span>
        </p>
        <span className="font-mono text-[9px] uppercase tracking-widest faint">
          tap to pull up · × to forget
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--line)] border hairline">
        {loved.slice(0, 9).map((p) => (
          <div
            key={`${p.dish}|${p.restaurant}`}
            className="bg-[var(--bg)] p-4 flex items-start justify-between gap-3 hover:bg-[var(--paper)] transition-colors group"
          >
            <button
              onClick={() => reorder(p)}
              className="flex-1 min-w-0 text-left"
              title="pull this pick back up"
            >
              <p className="font-display text-lg tracking-tight leading-tight group-hover:text-[var(--seal)] transition-colors truncate">
                {p.dish}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-widest faint truncate mt-1">
                {p.restaurant}
              </p>
              {p.price && (
                <p className="font-mono text-[9px] uppercase tracking-widest faint mt-2">
                  {p.price}
                </p>
              )}
            </button>
            <button
              onClick={() => remove(p)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-sm font-mono text-[11px] faint opacity-0 group-hover:opacity-100 hover:text-[var(--seal)] hover:bg-[var(--paper)] transition-all"
              title="remove from loved"
              aria-label="remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {loved.length > 9 && (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-widest faint">
          + {loved.length - 9} more — agent uses them all as taste signal
        </p>
      )}
    </div>
  );
}
