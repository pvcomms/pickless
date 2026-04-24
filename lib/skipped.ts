export type SkippedPick = {
  dish: string;
  restaurant: string;
  cuisine?: string;
  reason?: string;
  skippedAt: string;
};

const KEY = "pickless_skipped";
const MAX = 20;

export function readSkipped(): SkippedPick[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function keyOf(p: { dish: string; restaurant: string }) {
  return `${p.dish.toLowerCase().trim()}|${p.restaurant.toLowerCase().trim()}`;
}

export function recordSkip(p: Omit<SkippedPick, "skippedAt">): SkippedPick[] {
  const list = readSkipped();
  const k = keyOf(p);
  const without = list.filter((s) => keyOf(s) !== k);
  const next = [
    { ...p, skippedAt: new Date().toISOString() },
    ...without,
  ].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function clearSkips(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
