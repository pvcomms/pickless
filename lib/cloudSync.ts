import type { CloudSnapshot } from "@/app/api/sync/route";

export type LocalSnapshot = {
  prefs?: any;
  loved?: any[];
  skipped?: any[];
  tasteProfile?: any;
  history?: any[];
  recentlyShown?: any[];
};

export async function pullCloud(userId: string): Promise<CloudSnapshot | null> {
  if (!userId) return null;
  try {
    const r = await fetch(`/api/sync?u=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });
    const data = await r.json();
    return data?.snapshot ?? null;
  } catch {
    return null;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastBody: string = "";

export function pushCloudDebounced(
  userId: string,
  snap: LocalSnapshot,
  delayMs = 1200,
): void {
  if (!userId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushCloud(userId, snap), delayMs);
}

export async function pushCloud(
  userId: string,
  snap: LocalSnapshot,
): Promise<{ ok: boolean; updatedAt?: string }> {
  if (!userId) return { ok: false };
  const body = JSON.stringify({ userId, ...snap });
  if (body === lastBody) return { ok: true };
  lastBody = body;
  try {
    const r = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return await r.json();
  } catch {
    return { ok: false };
  }
}

const KEYS = {
  prefs: "pickless_prefs",
  loved: "pickless_loved",
  skipped: "pickless_skipped",
  tasteProfile: "pickless_taste_profile",
  history: "pickless_history",
  recentlyShown: "pickless_recently_shown",
} as const;

export function readLocal(): LocalSnapshot {
  if (typeof window === "undefined") return {};
  const out: LocalSnapshot = {};
  for (const [field, lsKey] of Object.entries(KEYS)) {
    try {
      const v = localStorage.getItem(lsKey);
      if (v) (out as any)[field] = JSON.parse(v);
    } catch {}
  }
  return out;
}

export function writeLocal(snap: CloudSnapshot) {
  if (typeof window === "undefined") return;
  for (const [field, lsKey] of Object.entries(KEYS)) {
    const v = (snap as any)[field];
    if (v !== undefined && v !== null) {
      try {
        localStorage.setItem(lsKey, JSON.stringify(v));
      } catch {}
    }
  }
}
