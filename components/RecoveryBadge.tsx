"use client";
import { useEffect, useState } from "react";

type Snap = {
  connected: boolean;
  snapshot: { recoveryScore: number | null } | null;
  bandLabel: string;
};

export function RecoveryBadge({ userId }: { userId: string }) {
  const [snap, setSnap] = useState<Snap | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/whoop/snapshot?u=${userId}`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (alive) setSnap(d);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!snap?.connected) return null;
  const score = snap.snapshot?.recoveryScore;
  const dotColor =
    score == null
      ? "bg-zinc-500"
      : score < 34
        ? "bg-red-500"
        : score < 67
          ? "bg-amber-500"
          : "bg-emerald-500";

  return (
    <span
      className="font-mono text-[10px] uppercase tracking-widest faint flex items-center gap-2"
      title="recovery from your Whoop strap · biasing every pick"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} pulse-soft`} />
      {score != null ? `Rec ${score}%` : "Whoop · pending"}
      {snap.bandLabel && <span className="opacity-60">· {snap.bandLabel}</span>}
    </span>
  );
}
