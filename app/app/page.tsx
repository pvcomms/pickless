"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hanko } from "@/components/Hanko";
import { ReelSpin } from "@/components/ReelSpin";
import {
  PLATFORMS,
  type Recommendation,
  type Preferences,
  DEFAULT_PREFS,
} from "@/lib/platforms";
import { getBrowserLocation, type LocationData } from "@/lib/location";

type HistoryItem = Recommendation & { orderedAt: string };

const SAMPLE_DISHES = [
  "thali",
  "khichdi",
  "biryani",
  "tikka",
  "ramen",
  "sushi",
  "tacos",
  "pho",
  "burger",
  "pasta",
  "salad",
  "curry",
  "kebab",
  "noodles",
  "wrap",
  "bowl",
];

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

export default function FeedMe() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");
  const [orderState, setOrderState] = useState<"idle" | "placing">("idle");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = localStorage.getItem("pickless_connected");
    if (!c || JSON.parse(c).length === 0) {
      router.push("/connect");
      return;
    }
    setPlatforms(JSON.parse(c));

    const h = localStorage.getItem("pickless_history");
    if (h) setHistory(JSON.parse(h));

    const l = localStorage.getItem("pickless_location");
    if (l) setLocation(JSON.parse(l));
    else void refreshLocation();

    const p = localStorage.getItem("pickless_prefs");
    if (p) setPrefs(JSON.parse(p));
  }, [router]);

  async function refreshLocation() {
    try {
      const c = await getBrowserLocation();
      const r = await fetch(`/api/geocode?lat=${c.lat}&lng=${c.lng}`);
      const data = await r.json();
      setLocation(data);
      localStorage.setItem("pickless_location", JSON.stringify(data));
    } catch {}
  }

  async function feedMe() {
    if (phase === "spinning") return;
    setRec(null);
    setPhase("spinning");

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms,
          history,
          location,
          prefs,
          context: { timeOfDay: timeOfDay() },
        }),
      });
      const data: Recommendation = await res.json();
      setRec(data);
    } catch {
      setPhase("idle");
    }
  }

  function onReelDone() {
    setPhase("revealed");
    setTimeout(
      () =>
        cardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      100,
    );
  }

  function order() {
    if (!rec) return;
    const item: HistoryItem = { ...rec, orderedAt: new Date().toISOString() };
    const next = [item, ...history].slice(0, 30);
    setHistory(next);
    localStorage.setItem("pickless_history", JSON.stringify(next));
    window.open(rec.orderUrl, "_blank");
  }

  async function autoOrder() {
    if (!rec) return;
    setOrderState("placing");
    await new Promise((r) => setTimeout(r, 1800));
    order();
    setOrderState("idle");
  }

  function skip() {
    setPhase("idle");
    setRec(null);
    setTimeout(feedMe, 100);
  }

  const platform = rec ? PLATFORMS.find((p) => p.id === rec.platform) : null;

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <a href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </a>
        <div className="flex items-center gap-6">
          <button
            onClick={refreshLocation}
            className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] flex items-center gap-2 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-soft inline-block" />
            {location ? location.neighborhood || location.city : "Locating…"}
          </button>
          <Link
            href="/connect"
            className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
          >
            Apps · {platforms.length}
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-2xl mx-auto w-full text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest faint mb-6">
          {timeOfDay()} · {prefs.diet} · {prefs.budget} budget
        </p>

        {phase === "idle" && (
          <div className="rise">
            <Hanko size={56} label="食" />
            <p className="mt-10 font-display text-3xl sm:text-4xl tracking-tight max-w-md">
              When you&apos;re ready, the{" "}
              <em className="text-[var(--seal)]">agent eats</em> with you.
            </p>
            <button
              onClick={feedMe}
              className="mt-12 group inline-flex items-center gap-3 px-10 py-5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
            >
              Feed me
              <span className="font-jp">食</span>
            </button>
          </div>
        )}

        {phase === "spinning" && (
          <div className="rise w-full">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-6">
              The agent is choosing
            </p>
            <ReelSpin
              spinning={true}
              finalText={rec?.dish || null}
              pool={SAMPLE_DISHES}
              onDone={onReelDone}
            />
            <p className="mt-6 font-mono text-[10px] uppercase tracking-widest faint pulse-soft">
              · · ·
            </p>
          </div>
        )}

        {phase === "revealed" && rec && (
          <div ref={cardRef} className="rise w-full">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] mb-4">
              {rec.sponsored ? "● Sponsored pick" : "● The pick"}
            </p>
            <h2 className="font-display text-[clamp(2.4rem,7vw,4.5rem)] leading-none tracking-tight">
              {rec.dish}
            </h2>
            <p className="mt-4 font-display text-xl faint italic">
              from {rec.restaurant}
            </p>

            <p className="mt-8 max-w-md mx-auto text-base faint leading-relaxed border-l border-[var(--seal)] pl-4 text-left">
              &ldquo;{rec.reason}&rdquo;
            </p>

            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              {platform && (
                <span
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm text-white"
                  style={{ backgroundColor: platform.color }}
                >
                  via {platform.name}
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border hairline rounded-sm faint">
                {rec.price}
              </span>
              {rec.tags?.map((t) => (
                <span
                  key={t}
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border hairline rounded-sm faint"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-12 flex gap-3 justify-center">
              <button
                onClick={autoOrder}
                disabled={orderState === "placing"}
                className="px-8 py-4 bg-[var(--seal)] text-white rounded-sm font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center gap-3"
              >
                {orderState === "placing" ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Agent ordering…
                  </>
                ) : (
                  <>Order it for me →</>
                )}
              </button>
              <button
                onClick={skip}
                disabled={orderState === "placing"}
                className="px-6 py-4 border hairline rounded-sm font-mono text-xs uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors disabled:opacity-30"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && phase === "idle" && (
          <div className="mt-20 w-full max-w-md text-left">
            <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
              Recent
            </p>
            <div className="space-y-px bg-[var(--line)]">
              {history.slice(0, 4).map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-[var(--bg)] py-3 px-1"
                >
                  <div>
                    <p className="font-display text-base tracking-tight">
                      {h.dish}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest faint">
                      {h.restaurant}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-widest faint">
                    {new Date(h.orderedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
