"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";

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

  // Stash latest values in refs so the loop sees fresh data without restarting
  const finalRef = useRef<string | null>(finalText);
  const onDoneRef = useRef(onDone);
  finalRef.current = finalText;
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!spinning) return;
    let cancelled = false;
    let i = 0;
    let landing = false;
    let landingI = 0;

    const tick = () => {
      if (cancelled) return;

      // First moment finalText shows up → flip into landing mode
      if (finalRef.current && !landing) {
        landing = true;
        landingI = 0;
      }

      // Land after 14 deceleration frames
      if (landing && landingI >= 14) {
        setFrame(finalRef.current);
        onDoneRef.current?.();
        return;
      }

      const word = pool[Math.floor(Math.random() * pool.length)] || "…";
      setFrame(word);
      if (i % 2 === 0) sfx.tick();
      i++;
      if (landing) landingI++;

      // Steeper deceleration so the final 2-3 frames are readable
      const delay = landing ? 50 + Math.pow(landingI / 14, 3.2) * 520 : 75;
      tRef.current = setTimeout(tick, delay);
    };
    tick();

    return () => {
      cancelled = true;
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [spinning, pool]); // intentionally NOT depending on finalText/onDone

  return (
    <div className="min-h-[1.4em] flex items-center justify-center">
      <span className="block font-display text-[clamp(2rem,6vw,3.8rem)] leading-tight tracking-tight">
        {frame || finalText || "…"}
      </span>
    </div>
  );
}
