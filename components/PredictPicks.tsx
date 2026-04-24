"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { type PredictPick } from "@/app/api/predict-picks/route";

type Props = {
  platforms: string[];
  history: any[];
  location: any;
  prefs: any;
  trends: any;
  context: any;
  mood: string | null;
  weather: any;
  tasteProfile: any;
  warmth: string;
  liveRestaurants: any[];
  recentlyShown: { dish: string; restaurant: string }[];
  loved?: { dish: string; restaurant: string; price?: string }[];
  skipped?: { dish: string; restaurant: string; reason?: string }[];
  lovedTick?: number;
  userId?: string;
  onPick: (pick: PredictPick) => void;
};

const ANGLE_META: Record<string, { label: string; jp: string; tone: string }> =
  {
    safe: { label: "Safe", jp: "安", tone: "the comfort one" },
    smart: { label: "Smart", jp: "智", tone: "fits this moment" },
    wild: { label: "Wild", jp: "野", tone: "the adventure" },
  };

export function PredictPicks({
  platforms,
  history,
  location,
  prefs,
  trends,
  context,
  mood,
  weather,
  tasteProfile,
  warmth,
  liveRestaurants,
  recentlyShown,
  loved,
  skipped,
  lovedTick,
  userId,
  onPick,
}: Props) {
  const [picks, setPicks] = useState<PredictPick[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const reqId = useRef(0);

  async function load() {
    if (!location || liveRestaurants.length === 0) return;
    const myReq = ++reqId.current;
    setLoading(true);
    setErr(false);
    try {
      const res = await fetch("/api/predict-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms,
          history,
          location,
          prefs,
          trends,
          context,
          mood,
          weather,
          tasteProfile,
          warmth,
          preFetched: liveRestaurants.slice(0, 14),
          recentlyShown,
          loved,
          skipped,
          userId,
        }),
      });
      const data = await res.json();
      if (myReq !== reqId.current) return;
      if (Array.isArray(data?.picks)) {
        setPicks(data.picks);
      } else {
        setErr(true);
      }
    } catch {
      if (myReq === reqId.current) setErr(true);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }

  // Auto-load once we have everything we need.
  useEffect(() => {
    if (!picks && !loading && location && liveRestaurants.length > 0) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, liveRestaurants.length]);

  // Re-bake when mood, prefs, or loved set change.
  useEffect(() => {
    if (picks || loading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mood,
    prefs?.budgetMax,
    prefs?.cuisines?.join(","),
    prefs?.diet,
    lovedTick,
  ]);

  if (!location || liveRestaurants.length === 0) return null;

  return (
    <div className="mt-12 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest faint flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--seal)] pulse-soft inline-block" />
          Pre-baked · 3 picks ready
        </p>
        <button
          onClick={() => {
            sfx.pop();
            void load();
          }}
          disabled={loading}
          className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors disabled:opacity-40"
        >
          {loading ? "baking…" : "Re-bake"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--line)] border hairline">
        {(loading && !picks ? [0, 1, 2] : (picks ?? [0, 1, 2])).map((p, i) => {
          const isPick = typeof p !== "number";
          const pick = isPick ? (p as PredictPick) : null;
          const angle =
            pick?.angle?.toLowerCase() || ["safe", "smart", "wild"][i];
          const meta = ANGLE_META[angle] || ANGLE_META.safe;
          return (
            <button
              key={i}
              disabled={!pick}
              onClick={() => {
                if (!pick) return;
                sfx.thunk();
                onPick(pick);
              }}
              className="bg-[var(--bg)] p-5 text-left flex flex-col gap-3 hover:bg-[var(--paper)] transition-colors group disabled:opacity-50 disabled:cursor-default min-h-[200px]"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="font-jp text-base text-[var(--seal)]">
                    {meta.jp}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest">
                    {meta.label}
                  </span>
                </span>
                {pick && (
                  <span className="font-mono text-[9px] uppercase tracking-widest faint">
                    {pick.deliveryMins ? `${pick.deliveryMins}m` : ""}
                  </span>
                )}
              </div>

              {!pick ? (
                <>
                  <div className="h-7 bg-[var(--paper)] rounded-sm animate-pulse" />
                  <div className="h-4 bg-[var(--paper)] rounded-sm animate-pulse w-2/3" />
                  <div className="h-3 bg-[var(--paper)] rounded-sm animate-pulse w-3/4 mt-auto" />
                </>
              ) : (
                <>
                  <p className="font-display text-xl tracking-tight leading-tight group-hover:text-[var(--seal)] transition-colors">
                    {pick.dish}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-widest faint truncate">
                    {pick.restaurant}
                  </p>
                  {pick.vibe && (
                    <p className="text-sm italic faint leading-snug line-clamp-3">
                      {pick.vibe}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest">
                      {pick.price}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest faint">
                      {meta.tone} →
                    </span>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {err && (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-amber-600">
          baker had a hiccup · hit re-bake
        </p>
      )}
    </div>
  );
}
