"use client";
import { useEffect, useState, useRef } from "react";

export function ReelSpin({
  spinning,
  finalText,
  pool,
  onDone,
}: {
  spinning: boolean;
  finalText: string | null;
  pool: string[];
  onDone?: () => void;
}) {
  const [frame, setFrame] = useState<string | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!spinning || !finalText) return;
    let cancelled = false;
    const steps = 16;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      if (i >= steps) {
        setFrame(finalText);
        onDone?.();
        return;
      }
      setFrame(pool[Math.floor(Math.random() * pool.length)] || "…");
      i++;
      const delay = 60 + Math.pow(i / steps, 2.2) * 280;
      tRef.current = setTimeout(tick, delay);
    };
    tick();
    return () => {
      cancelled = true;
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [spinning, finalText, pool, onDone]);

  return (
    <div className="overflow-hidden h-[1.15em]">
      <span className="block font-display text-[clamp(2.4rem,7vw,4.5rem)] leading-tight tracking-tight">
        {frame || finalText || "—"}
      </span>
    </div>
  );
}
