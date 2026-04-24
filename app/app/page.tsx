"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hanko } from "@/components/Hanko";
import { LiveMap } from "@/components/LiveMap";
import { ReelSpin } from "@/components/ReelSpin";
import { SpinningInsights } from "@/components/SpinningInsights";
import { PortableProfile } from "@/components/PortableProfile";
import {
  PLATFORMS,
  type Recommendation,
  type Preferences,
  DEFAULT_PREFS,
} from "@/lib/platforms";
import { getBrowserLocation, type LocationData } from "@/lib/location";
import { type Order, type Trends, currencySymbol } from "@/lib/orders";
import { sfx, streak } from "@/lib/sfx";
import { MOODS, type Mood } from "@/lib/moods";
import {
  detectDevice,
  detectTime,
  computeWarmth,
  fetchWeather,
  type DeviceContext,
  type TimeContext,
  type WeatherContext,
} from "@/lib/context";

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
  "vada pav",
  "dosa",
  "maggi",
  "roll",
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
  const [recentlyShown, setRecentlyShown] = useState<
    { dish: string; restaurant: string }[]
  >([]);
  const recentlyShownRef = useRef<{ dish: string; restaurant: string }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");
  const [orderState, setOrderState] = useState<"idle" | "placing">("idle");
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [liveFetchedAt, setLiveFetchedAt] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [device, setDevice] = useState<DeviceContext | null>(null);
  const [timeCtx, setTimeCtx] = useState<TimeContext | null>(null);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [tasteProfile, setTasteProfile] = useState<any>(null);
  const [warmth, setWarmth] = useState<string>("");
  const [streakN, setStreakN] = useState(0);
  const [muted, setMuted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isGuest =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("guest") === "1";
    const c = localStorage.getItem("pickless_connected");
    if ((!c || JSON.parse(c).length === 0) && !isGuest) {
      router.push("/connect");
      return;
    }
    setPlatforms(c ? JSON.parse(c) : ["swiggy"]);

    // Rich context — captured ONCE at mount
    setDevice(detectDevice());
    setTimeCtx(detectTime());
    setWarmth(computeWarmth());
    setStreakN(streak.read());
    setMuted(sfx.muted());

    // Restore recently-shown from previous session so refresh doesn't break diversity
    try {
      const rs = localStorage.getItem("pickless_recently_shown");
      if (rs) {
        const arr = JSON.parse(rs);
        if (Array.isArray(arr)) {
          recentlyShownRef.current = arr;
          setRecentlyShown(arr);
        }
      }
    } catch {}

    const tp = localStorage.getItem("pickless_taste_profile");
    if (tp) setTasteProfile(JSON.parse(tp));

    const h = localStorage.getItem("pickless_history");
    if (h) setHistory(JSON.parse(h));

    const o = localStorage.getItem("pickless_orders");
    if (o) {
      const arr: Order[] = JSON.parse(o);
      setOrders(arr);
      void loadTrends(arr);
    }

    const l = localStorage.getItem("pickless_location");
    if (l) setLocation(JSON.parse(l));
    else void refreshLocation();

    const p = localStorage.getItem("pickless_prefs");
    if (p) setPrefs(JSON.parse(p));

    const lr = localStorage.getItem("pickless_live_restaurants");
    if (lr) {
      const parsed = JSON.parse(lr);
      setLiveRestaurants(parsed.restaurants || []);
      setLiveFetchedAt(parsed.fetchedAt || null);
    } else {
      void refreshLiveRestaurants();
    }

    // Weather (best-effort)
    if (l) {
      const loc = JSON.parse(l);
      void fetchWeather(loc.lat, loc.lng).then((w) => {
        if (w) setWeather(w);
      });
    }
  }, [router]);

  async function refreshLiveRestaurants() {
    const l = localStorage.getItem("pickless_location");
    if (!l) return;
    const loc = JSON.parse(l);
    try {
      const r = await fetch(
        `/api/restaurants?lat=${loc.lat}&lng=${loc.lng}&city=${encodeURIComponent(loc.city || "")}&neighborhood=${encodeURIComponent(loc.neighborhood || "")}`,
        { cache: "no-store" },
      );
      const data = await r.json();
      const next = {
        fetchedAt: new Date().toISOString(),
        restaurants: data.restaurants || [],
      };
      setLiveRestaurants(next.restaurants);
      setLiveFetchedAt(next.fetchedAt);
      localStorage.setItem("pickless_live_restaurants", JSON.stringify(next));
    } catch {}
  }

  // Auto-poll every 30s while the user is on the screen.
  useEffect(() => {
    const id = setInterval(() => void refreshLiveRestaurants(), 30000);
    return () => clearInterval(id);
  }, []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function loadTrends(arr: Order[]) {
    try {
      const res = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: arr }),
      });
      const data = await res.json();
      setTrends(data.stats);
      setInsights(data.insights || []);
    } catch {}
  }

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
          trends,
          tasteProfile,
          device,
          weather,
          warmth,
          mood: mood ? `${mood.label} (${mood.bias})` : null,
          context: timeCtx || { timeOfDay: timeOfDay() },
          preFetched: liveRestaurants.slice(0, 18),
          recentlyShown: recentlyShownRef.current,
        }),
      });
      const data: Recommendation = await res.json();
      setRec(data);
      // Track for next call so the agent doesn't repeat — sync via ref so the
      // very next feedMe call sees the latest list (state updates are async).
      if (data?.dish && data?.restaurant) {
        const next = [
          { dish: data.dish, restaurant: data.restaurant },
          ...recentlyShownRef.current,
        ].slice(0, 20);
        recentlyShownRef.current = next;
        setRecentlyShown(next);
        try {
          localStorage.setItem("pickless_recently_shown", JSON.stringify(next));
        } catch {}
      }
    } catch {
      setPhase("idle");
    }
  }

  function onReelDone() {
    setPhase("revealed");
    sfx.thunk();
    setTimeout(() => sfx.bell(), 320);
    const next = streak.bump();
    setStreakN(next);
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
  const platformAddress = orders[0]?.deliveryAddress;
  const locationsMatch =
    (!!location &&
      !!platformAddress &&
      platformAddress
        .toLowerCase()
        .includes(location.neighborhood?.toLowerCase() || "___")) ||
    (!!location &&
      !!platformAddress &&
      platformAddress
        .toLowerCase()
        .includes(location.city?.toLowerCase() || "___"));

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <a href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </a>
        <div className="flex items-center gap-5">
          {weather && (
            <span className="font-mono text-[10px] uppercase tracking-widest faint hidden sm:inline">
              {Math.round(weather.tempC)}°· {weather.condition}
            </span>
          )}
          {streakN > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)]">
              streak · {streakN}
            </span>
          )}
          <button
            onClick={() => {
              const m = !muted;
              setMuted(m);
              sfx.setMuted(m);
            }}
            title={muted ? "unmute" : "mute"}
            className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
          >
            {muted ? "♪ off" : "♪ on"}
          </button>
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
          {timeOfDay()} · {prefs.diet} · vibe: {prefs.vibe}
        </p>

        {phase === "idle" && (
          <div className="rise w-full flex flex-col items-center">
            <Hanko size={56} label="食" />
            <p className="mt-10 font-display text-3xl sm:text-4xl tracking-tight max-w-md">
              When you&apos;re ready, the{" "}
              <em className="text-[var(--seal)]">agent eats</em> with you.
            </p>
            {warmth && (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-widest faint">
                {warmth}
              </p>
            )}

            {/* Mood picker */}
            <div className="mt-10 w-full max-w-md">
              <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
                Mood right now
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {MOODS.map((m) => {
                  const on = mood?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        sfx.pop();
                        setMood(on ? null : m);
                      }}
                      className={`group px-4 py-2 border rounded-sm transition-all ${
                        on
                          ? "border-transparent bg-[var(--seal)] text-white"
                          : "hairline hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-jp text-sm">{m.jp}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest">
                          {m.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={feedMe}
              className="mt-10 group inline-flex items-center gap-3 px-10 py-5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
            >
              Feed me
              <span className="font-jp">食</span>
            </button>

            {/* Live map */}
            {location && (
              <div className="mt-12 w-full max-w-md">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
                  ● Live · GPS pin
                </p>
                <LiveMap
                  lat={location.lat}
                  lng={location.lng}
                  label={location.neighborhood || location.city}
                  restaurantCount={liveRestaurants.length}
                />
                <p className="mt-2 font-mono text-[9px] uppercase tracking-widest faint">
                  red ring = ~1.5km delivery range
                </p>
              </div>
            )}

            {/* Verified location strip */}
            {location && platformAddress && (
              <div className="mt-12 w-full max-w-md text-left grid grid-cols-2 gap-px bg-[var(--line)] border hairline">
                <div className="bg-[var(--bg)] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                    GPS · live
                  </p>
                  <p className="font-display text-base tracking-tight">
                    {location.neighborhood || location.city}
                  </p>
                </div>
                <div className="bg-[var(--bg)] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                    From your apps
                  </p>
                  <p className="font-display text-base tracking-tight">
                    {platformAddress}
                  </p>
                </div>
                <div className="col-span-2 bg-[var(--bg)] px-4 py-2.5 flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${locationsMatch ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-widest faint">
                    {locationsMatch
                      ? "Verified · same neighbourhood"
                      : "Different · agent will use GPS"}
                  </span>
                </div>
              </div>
            )}

            {/* LIVE Swiggy panel — real data, no mock */}
            {liveRestaurants.length > 0 && (
              <div className="mt-12 w-full max-w-md text-left">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest faint flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-soft inline-block" />
                    Live · {liveRestaurants.length} near you
                    <span className="opacity-60">
                      · updated{" "}
                      {liveFetchedAt
                        ? secondsAgo(liveFetchedAt, tick)
                        : "just now"}
                    </span>
                  </p>
                  <button
                    onClick={refreshLiveRestaurants}
                    className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
                  >
                    Refresh
                  </button>
                </div>
                <div className="space-y-px bg-[var(--line)] border hairline">
                  {liveRestaurants.slice(0, 5).map((r: any) => {
                    const sources: string[] = r.source || [];
                    const onSwish = sources.includes("swish");
                    const onSwiggy = sources.includes("swiggy") || onSwish;
                    const onZomato = sources.includes("zomato");
                    return (
                      <a
                        key={r.id}
                        href={r.swiggyUrl}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center justify-between gap-3 bg-[var(--bg)] py-3 px-3 hover:bg-[var(--paper)] transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="font-display text-base tracking-tight truncate group-hover:text-[var(--seal)] transition-colors">
                            {r.name}
                          </p>
                          <p className="font-mono text-[9px] uppercase tracking-widest faint truncate">
                            {r.cuisines.slice(0, 2).join(" · ")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-[10px] uppercase tracking-widest">
                            ★ {r.rating}
                            {r.deliveryMins ? ` · ${r.deliveryMins}m` : ""}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {onSwish && (
                              <span
                                className="font-mono text-[8px] uppercase tracking-widest px-1 py-0.5 rounded-sm text-white"
                                style={{ backgroundColor: "#0FA968" }}
                              >
                                Swish
                              </span>
                            )}
                            {onSwiggy && !onSwish && (
                              <span
                                className="font-mono text-[8px] uppercase tracking-widest px-1 py-0.5 rounded-sm text-white"
                                style={{ backgroundColor: "#FC8019" }}
                              >
                                Swiggy
                              </span>
                            )}
                            {onZomato && (
                              <span
                                className="font-mono text-[8px] uppercase tracking-widest px-1 py-0.5 rounded-sm text-white"
                                style={{ backgroundColor: "#E23744" }}
                              >
                                Zomato
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-widest faint">
                  Pulled live from swiggy + zomato · auto-refresh every 30s
                </p>
              </div>
            )}

            {/* Trends panel */}
            {trends && (
              <div className="mt-12 w-full max-w-md text-left">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
                  What the agent learned
                </p>
                <div className="space-y-px bg-[var(--line)] border hairline">
                  <Stat k="Total orders" v={String(trends.totalOrders)} />
                  <Stat
                    k="Spent"
                    v={trends.totalSpend
                      .map(
                        (s) =>
                          `${currencySymbol(s.currency)}${s.amount.toLocaleString()}`,
                      )
                      .join(" · ")}
                  />
                  <Stat k="Loves" v={trends.topCuisine} />
                  <Stat k="Frequents" v={trends.topRestaurant} />
                  <Stat
                    k="Avg ticket"
                    v={`${currencySymbol(trends.primaryCurrency)}${trends.avgPrice}`}
                  />
                  <Stat k="Peak day" v={trends.weekdayPattern} />
                </div>

                {insights.length > 0 && (
                  <div className="mt-6">
                    <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
                      Gemini insights
                    </p>
                    <div className="space-y-2">
                      {insights.map((line, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 py-2 border-b hairline"
                        >
                          <span className="font-jp text-[var(--seal)] leading-none mt-1">
                            ●
                          </span>
                          <p className="text-sm faint leading-snug">{line}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Portable profile — MCP/Aadhaar for the cyborg human */}
            <PortableProfile />

            {/* Recent orders strip */}
            {orders.length > 0 && (
              <div className="mt-12 w-full max-w-md text-left">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
                  Recent · across {platforms.length} app
                  {platforms.length > 1 ? "s" : ""}
                </p>
                <div className="space-y-px bg-[var(--line)]">
                  {orders.slice(0, 4).map((o) => {
                    const p = PLATFORMS.find((pp) => pp.id === o.platform);
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-3 bg-[var(--bg)] py-3 px-1"
                      >
                        <div className="min-w-0">
                          <p className="font-display text-base tracking-tight truncate">
                            {o.dish}
                          </p>
                          <p className="font-mono text-[9px] uppercase tracking-widest faint truncate">
                            {o.restaurant}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {p && (
                            <span
                              className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-sm text-white"
                              style={{ backgroundColor: p.color }}
                            >
                              {p.name}
                            </span>
                          )}
                          <p className="font-mono text-[9px] uppercase tracking-widest faint mt-1">
                            {currencySymbol(o.currency)}
                            {o.price}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
              pool={
                liveRestaurants.length > 0
                  ? Array.from(
                      new Set(
                        liveRestaurants.flatMap((r: any) =>
                          (r.cuisines || []).slice(0, 2),
                        ),
                      ),
                    )
                  : SAMPLE_DISHES
              }
              onDone={onReelDone}
            />
            <SpinningInsights
              orders={orders}
              trends={trends}
              tasteProfile={tasteProfile}
              weather={weather}
              location={location}
              mood={mood}
              prefs={prefs}
            />
          </div>
        )}

        {phase === "revealed" && rec && (
          <div ref={cardRef} className="rise w-full">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] mb-4 flex items-center justify-center gap-3">
              <span>{rec.sponsored ? "● Sponsored pick" : "● The pick"}</span>
              <span className="opacity-50">
                № {String((history?.length || 0) + 1).padStart(3, "0")}
              </span>
              <span className="opacity-50">
                · {timeCtx?.timeOfDay || timeOfDay()}
              </span>
            </p>
            <h2 className="font-display text-[clamp(2.4rem,7vw,4.5rem)] leading-none tracking-tight">
              {rec.dish}
            </h2>
            <p className="mt-4 font-display text-xl faint italic">
              from {rec.restaurant}
            </p>

            {(rec as any).order && (
              <div className="mt-8 max-w-md mx-auto text-left">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-1.5">
                  The order
                </p>
                <p className="text-base leading-relaxed">
                  {(rec as any).order}.
                </p>
              </div>
            )}

            {(rec as any).vibe && (
              <p className="mt-6 max-w-md mx-auto font-display italic text-xl text-[var(--seal)] leading-snug px-4 text-left">
                {(rec as any).vibe}
              </p>
            )}

            <p className="mt-6 max-w-md mx-auto text-sm faint leading-relaxed border-l border-[var(--seal)] pl-4 text-left">
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

            {/* Copy + Open-in-app row */}
            <div className="mt-10 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              <CopyButton label="Copy dish" text={rec.dish} />
              <CopyButton label="Copy restaurant" text={rec.restaurant} />
              <CopyButton
                label="Copy both"
                text={`${rec.dish} at ${rec.restaurant}`}
              />
            </div>

            {/* Open in linked apps */}
            <div className="mt-3 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {platforms.map((pid) => {
                const p = PLATFORMS.find((x) => x.id === pid);
                if (!p) return null;
                const q = encodeURIComponent(`${rec.dish} ${rec.restaurant}`);
                const webUrl = p.searchUrl(`${rec.dish} ${rec.restaurant}`);
                return (
                  <button
                    key={pid}
                    onClick={() => openInApp(p.appScheme, webUrl)}
                    className="font-mono text-[10px] uppercase tracking-widest px-3 py-2.5 rounded-sm text-white transition-opacity hover:opacity-90 flex items-center gap-2"
                    style={{ backgroundColor: p.color }}
                  >
                    Open {p.name} →
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex gap-3 justify-center">
              <button
                onClick={autoOrder}
                disabled={orderState === "placing"}
                className="px-8 py-4 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors disabled:opacity-70 flex items-center gap-3"
              >
                {orderState === "placing" ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
      </div>
    </main>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {}
      }}
      className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 border rounded-sm transition-all ${
        copied
          ? "border-emerald-500 text-emerald-500"
          : "hairline faint hover:text-[var(--ink)] hover:border-[var(--ink)]"
      }`}
      title={text}
    >
      {copied ? "✓ copied" : label}
    </button>
  );
}

function openInApp(scheme: string, webFallback: string) {
  // Try the native app's URL scheme first; if nothing handles it within ~1s,
  // fall through to the web URL. Works on iOS / Android phone webviews.
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipad|ipod|android/.test(ua);
  if (!isMobile) {
    window.open(webFallback, "_blank");
    return;
  }
  const start = Date.now();
  const a = document.createElement("a");
  a.href = scheme;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    if (Date.now() - start < 1500 && document.hasFocus()) {
      window.open(webFallback, "_blank");
    }
  }, 1100);
}

function secondsAgo(iso: string, _tick: number): string {
  const s = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[var(--bg)] py-2.5 px-3">
      <span className="font-mono text-[10px] uppercase tracking-widest faint">
        {k}
      </span>
      <span className="font-display text-base tracking-tight text-right truncate">
        {v}
      </span>
    </div>
  );
}
