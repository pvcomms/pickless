"use client";

export type MealItem = {
  dish: string;
  restaurant: string;
  orderUrl: string;
  price?: string;
  platform: string;
};

const ROLES = ["drink", "main", "dessert"] as const;

function parsePrice(p?: string): number {
  if (!p) return 0;
  const n = parseInt(p.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export function MealCart({
  items,
  vibe,
  onRemove,
  onOrder,
  onClear,
}: {
  items: MealItem[];
  vibe?: string | null;
  onRemove: (idx: number) => void;
  onOrder: () => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;

  const total = items.reduce((sum, it) => sum + parsePrice(it.price), 0);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t hairline bg-[var(--bg)] shadow-[0_-4px_32px_rgba(0,0,0,0.10)]">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-start gap-6">
        {/* Items */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-widest faint mb-2 flex items-center gap-3">
            <span>
              Meal · {items.length} item{items.length !== 1 ? "s" : ""}
              {total > 0 ? ` · ₹${total}` : ""}
            </span>
            {items.length < 3 && (
              <span className="opacity-50">
                · {3 - items.length} more to go
              </span>
            )}
          </p>

          {vibe && (
            <p className="font-display italic text-sm text-[var(--seal)] mb-2 leading-snug">
              {vibe}
            </p>
          )}

          <div className="space-y-1.5">
            {ROLES.map((role, i) => {
              const item = items[i];
              return (
                <div key={role} className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--seal)] w-12 shrink-0">
                    {role}
                  </span>
                  {item ? (
                    <>
                      <span className="text-sm truncate flex-1">
                        {item.dish}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest faint shrink-0 hidden sm:inline">
                        {item.restaurant.split(" ").slice(0, 2).join(" ")}
                      </span>
                      {item.price && (
                        <span className="font-mono text-[9px] uppercase tracking-widest faint shrink-0">
                          {item.price}
                        </span>
                      )}
                      <button
                        onClick={() => onRemove(i)}
                        className="font-mono text-sm leading-none faint hover:text-red-500 transition-colors shrink-0 w-4 text-center"
                        title="remove"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-widest faint opacity-40">
                      — spinning…
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-5">
          <button
            onClick={onOrder}
            className="px-6 py-3 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--seal)] transition-colors whitespace-nowrap"
          >
            Order meal →
          </button>
          <button
            onClick={onClear}
            className="font-mono text-[9px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
          >
            clear
          </button>
        </div>
      </div>
    </div>
  );
}
