"use client";
import { PLATFORMS } from "@/lib/platforms";

export type MealRole = "drink" | "main" | "dessert";

export type MealItem = {
  role?: MealRole;
  dish: string;
  restaurant: string;
  restaurantId?: string;
  orderUrl: string;
  price?: string;
  platform: string;
  reason?: string;
  deliveryMins?: number;
  live?: boolean;
};

const ROLE_META: Array<{ id: MealRole; jp: string; label: string }> = [
  { id: "drink", jp: "飲", label: "drink" },
  { id: "main", jp: "膳", label: "main" },
  { id: "dessert", jp: "甘", label: "sweet" },
];

// Fixed skeleton widths per role — avoids Math.random() in render
const SKELETON: Record<MealRole, [string, string]> = {
  drink: ["w-24", "w-16"],
  main: ["w-32", "w-20"],
  dessert: ["w-28", "w-14"],
};

function parsePrice(p?: string): number {
  if (!p) return 0;
  const n = parseInt(p.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export function MealCart({
  items,
  vibe,
  loading = false,
  onRemove,
  onRegenerate,
  onOrder,
  onClear,
}: {
  items: MealItem[];
  vibe?: string | null;
  loading?: boolean;
  onRemove: (role: MealRole) => void;
  onRegenerate?: (role: MealRole) => void;
  onOrder: () => void;
  onClear: () => void;
}) {
  if (!loading && items.length === 0) return null;

  // Build role → item map. Positional fallback for items without explicit role.
  const byRole = new Map<MealRole, MealItem>();
  items.forEach((it, i) => {
    const r = it.role ?? ROLE_META[i]?.id;
    if (r) byRole.set(r, it);
  });

  const total = items.reduce((sum, it) => sum + parsePrice(it.price), 0);
  const complete = byRole.size >= 3;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t hairline bg-[var(--bg)] shadow-[0_-8px_40px_rgba(0,0,0,0.10)]">
      {/* Vibe strip */}
      {vibe && (
        <div className="border-b hairline bg-[var(--paper)] px-6 py-2">
          <p className="max-w-2xl mx-auto font-display italic text-sm text-[var(--seal)] text-center leading-snug">
            {vibe}
          </p>
        </div>
      )}

      {/* Course rows */}
      <div className="max-w-2xl mx-auto divide-y divide-[var(--line)]">
        {ROLE_META.map(({ id, jp, label }) => {
          const item = byRole.get(id);
          const plat = item
            ? PLATFORMS.find((p) => p.id === item.platform)
            : null;
          const [skW1, skW2] = SKELETON[id];

          return (
            <div
              key={id}
              className="flex items-center gap-3 px-6 py-2.5 min-w-0"
            >
              {/* Glyph */}
              <div className="w-7 shrink-0 text-center select-none">
                <span className="font-jp text-lg leading-none text-[var(--seal)] opacity-40">
                  {jp}
                </span>
              </div>

              {/* Info block */}
              <div className="flex-1 min-w-0">
                {item ? (
                  <>
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-display text-[15px] tracking-tight truncate leading-snug">
                        {item.dish}
                      </span>
                      {item.price && (
                        <span className="font-mono text-[9px] uppercase tracking-widest faint shrink-0">
                          {item.price}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="font-mono text-[9px] uppercase tracking-widest faint truncate max-w-[130px]">
                        {item.restaurant.split(" ").slice(0, 3).join(" ")}
                      </span>
                      {item.deliveryMins && (
                        <span className="font-mono text-[9px] uppercase tracking-widest faint">
                          · {item.deliveryMins}m
                        </span>
                      )}
                      {item.live !== undefined && (
                        <span
                          className={`font-mono text-[9px] uppercase tracking-widest ${
                            item.live ? "text-emerald-600" : "faint opacity-50"
                          }`}
                        >
                          · {item.live ? "live" : "est"}
                        </span>
                      )}
                    </div>
                    {item.reason && (
                      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--seal)] opacity-50 mt-0.5 truncate">
                        {item.reason}
                      </p>
                    )}
                  </>
                ) : loading ? (
                  <div className="space-y-1.5 py-0.5">
                    <div
                      className={`h-3.5 ${skW1} bg-[var(--line)] rounded-sm animate-pulse`}
                    />
                    <div
                      className={`h-2.5 ${skW2} bg-[var(--line)] rounded-sm animate-pulse opacity-50`}
                    />
                  </div>
                ) : (
                  <span className="font-mono text-[9px] uppercase tracking-widest faint opacity-30">
                    — {label}
                  </span>
                )}
              </div>

              {/* Platform badge → opens order url */}
              {item && plat && (
                <a
                  href={item.orderUrl}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 font-mono text-[8px] uppercase tracking-widest px-2 py-1 rounded-sm text-white hover:opacity-75 transition-opacity"
                  style={{ backgroundColor: plat.color }}
                >
                  {plat.name} →
                </a>
              )}

              {/* Regenerate + remove */}
              {item && (
                <div className="flex items-center gap-2 shrink-0">
                  {onRegenerate && (
                    <button
                      onClick={() => onRegenerate(id)}
                      title={`re-roll ${label}`}
                      className="font-mono text-[11px] leading-none faint hover:text-[var(--seal)] transition-colors"
                    >
                      ↺
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(id)}
                    title={`remove ${label}`}
                    className="font-mono text-[11px] leading-none faint hover:text-red-500 transition-colors w-3.5 text-center"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA bar */}
      <div className="border-t hairline">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-3">
          <p className="font-mono text-[9px] uppercase tracking-widest faint flex-1">
            {loading && !complete
              ? "agent building meal…"
              : complete && total > 0
                ? `₹${total} total`
                : `${byRole.size} / 3 courses`}
          </p>
          <button
            onClick={onClear}
            className="font-mono text-[9px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
          >
            clear
          </button>
          {complete && (
            <button
              onClick={onOrder}
              className="px-5 py-2.5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--seal)] transition-colors whitespace-nowrap"
            >
              Order all →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
