export type LovedPick = {
  dish: string;
  restaurant: string;
  cuisine?: string;
  price?: string;
  savedAt: string;
};

const KEY = "pickless_loved";
const MAX = 30;

export function readLoved(): LovedPick[] {
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

export function isLoved(p: { dish: string; restaurant: string }): boolean {
  return readLoved().some((l) => keyOf(l) === keyOf(p));
}

export function toggleLoved(p: Omit<LovedPick, "savedAt">): {
  loved: LovedPick[];
  isOn: boolean;
} {
  const list = readLoved();
  const k = keyOf(p);
  const idx = list.findIndex((l) => keyOf(l) === k);
  let next: LovedPick[];
  let isOn: boolean;
  if (idx >= 0) {
    next = list.filter((_, i) => i !== idx);
    isOn = false;
  } else {
    next = [{ ...p, savedAt: new Date().toISOString() }, ...list].slice(0, MAX);
    isOn = true;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return { loved: next, isOn };
}
