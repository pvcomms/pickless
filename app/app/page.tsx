"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hanko } from "@/components/Hanko";
import { LiveMap } from "@/components/LiveMap";
import { ReelSpin } from "@/components/ReelSpin";
import { SpinningInsights } from "@/components/SpinningInsights";
import { PortableProfile } from "@/components/PortableProfile";
import { PredictPicks } from "@/components/PredictPicks";
import { InlinePrefs } from "@/components/InlinePrefs";
import { AutoOrderModal } from "@/components/AutoOrderModal";
import { MealCart, type MealItem } from "@/components/MealCart";
import { TasteSyncBadge } from "@/components/TasteSyncBadge";
import { RecoveryBadge } from "@/components/RecoveryBadge";
import { readLoved, toggleLoved, type LovedPick } from "@/lib/loved";
import { readSkipped, recordSkip, type SkippedPick } from "@/lib/skipped";
import { LovedPanel } from "@/components/LovedPanel";
import { getUserId } from "@/lib/userId";
import {
  pullCloud,
  pushCloudDebounced,
  writeLocal,
  readLocal,
} from "@/lib/cloudSync";
import { type PredictPick } from "@/app/api/predict-picks/route";
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
  const [autoOrderOpen, setAutoOrderOpen] = useState(false);
  const [meal, setMeal] = useState<MealItem[]>([]);
  const [mealVibe, setMealVibe] = useState<string | null>(null);
  const [mealOrderOpen, setMealOrderOpen] = useState(false);
  const [buildingMeal, setBuildingMeal] = useState(false);
  const [liveRestaurants, setLiveRestaurants] = useState<any[]>([]);
  const [liveFetchedAt, setLiveFetchedAt] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [device, setDevice] = useState<DeviceContext | null>(null);
  const [timeCtx, setTimeCtx] = useState<TimeContext | null>(null);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [tasteProfile, setTasteProfile] = useState<any>(null);
  const [warmth, setWarmth] = useState<string>("");
  const [streakN, setStreakN] = useState(0);
  const [loved, setLoved] = useState<LovedPick[]>([]);
  const [lovedTick, setLovedTick] = useState(0);
  const [skipped, setSkipped] = useState<SkippedPick[]>([]);
  const [skipToast, setSkipToast] = useState<string | null>(null);
  const [askSkipReason, setAskSkipReason] = useState<{
    dish: string;
    restaurant: string;
  } | null>(null);
  const [userId, setUserIdState] = useState<string>("");
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const buildIdRef = useRef(0);
  const [savedAddressDisplay, setSavedAddressDisplay] = useState<string>("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");

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
    setLoved(readLoved());
    setSkipped(readSkipped());

    // Cloud sync: get/create anonymous ID, then pull remote snapshot.
    // If remote exists and is newer than local, hydrate state from it.
    const id = getUserId();
    setUserIdState(id);
    void (async () => {
      const remote = await pullCloud(id);
      if (remote) {
        writeLocal(remote);
        if (remote.prefs) setPrefs(remote.prefs);
        if (Array.isArray(remote.loved)) setLoved(remote.loved);
        if (Array.isArray(remote.skipped)) setSkipped(remote.skipped);
        if (remote.tasteProfile) setTasteProfile(remote.tasteProfile);
        if (Array.isArray(remote.history)) setHistory(remote.history);
        if (Array.isArray(remote.recentlyShown)) {
          recentlyShownRef.current = remote.recentlyShown;
          setRecentlyShown(remote.recentlyShown);
        }
        setSyncedAt(remote.updatedAt);
      }
      hydratedRef.current = true;
    })();

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

    const sa = localStorage.getItem("pickless_saved_address");
    if (sa) {
      try {
        setSavedAddressDisplay(JSON.parse(sa));
      } catch {}
    }

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

  // Cloud push: debounced whenever any synced piece of state changes.
  // Skip until hydration completes (otherwise empty state overwrites remote).
  useEffect(() => {
    if (!userId || !hydratedRef.current) return;
    let savedAddress: string | undefined;
    try {
      const raw = localStorage.getItem("pickless_saved_address");
      if (raw) savedAddress = JSON.parse(raw);
    } catch {}
    pushCloudDebounced(userId, {
      prefs,
      loved,
      skipped,
      tasteProfile,
      history,
      recentlyShown: recentlyShownRef.current,
      ...(savedAddress ? { savedAddress } : {}),
    });
    setSyncedAt(new Date().toISOString());
  }, [userId, prefs, loved, skipped, tasteProfile, history, recentlyShown]);

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
      // Derive a human-readable delivery address string for the auto-order
      // agent. Only write if no manual override is already saved.
      if (!localStorage.getItem("pickless_saved_address")) {
        const parts = [data.neighborhood, data.city].filter(Boolean);
        if (parts.length) {
          localStorage.setItem(
            "pickless_saved_address",
            JSON.stringify(parts.join(", ")),
          );
        }
      }
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
          loved,
          skipped,
          userId,
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

  function autoOrder() {
    if (!rec) return;
    setAutoOrderOpen(true);
  }

  function autoOrderConfirmed() {
    order();
    setOrderState("idle");
  }

  function addToMeal() {
    if (!rec) return;
    sfx.pop();
    const roles: Array<"drink" | "main" | "dessert"> = [
      "drink",
      "main",
      "dessert",
    ];
    const role = roles[meal.length] ?? "dessert";
    setMeal((m) => [
      ...m,
      {
        role,
        dish: rec.dish,
        restaurant: rec.restaurant,
        orderUrl: rec.orderUrl,
        price: rec.price,
        platform: rec.platform,
      },
    ]);
    // Track shown so the next pick differs
    const next = [
      { dish: rec.dish, restaurant: rec.restaurant },
      ...recentlyShownRef.current,
    ].slice(0, 20);
    recentlyShownRef.current = next;
    setRecentlyShown(next);
    try {
      localStorage.setItem("pickless_recently_shown", JSON.stringify(next));
    } catch {}
    // Go fetch the next one
    setPhase("idle");
    setRec(null);
    setTimeout(feedMe, 100);
  }

  function removeFromMeal(role: "drink" | "main" | "dessert") {
    setMeal((m) => m.filter((it) => it.role !== role));
  }

  function orderFullMeal() {
    if (meal.length === 0) return;
    setMealOrderOpen(true);
  }

  function mealOrderConfirmed() {
    // Treat each meal item as a history entry — best-effort.
    const items = meal.map((m) => ({
      dish: m.dish,
      restaurant: m.restaurant,
      platform: m.platform,
      price: m.price || "",
      reason: "meal",
      tags: ["meal"],
      sponsored: false,
      orderUrl: m.orderUrl,
      orderedAt: new Date().toISOString(),
    })) as HistoryItem[];
    const nextHistory = [...items, ...history].slice(0, 30);
    setHistory(nextHistory);
    try {
      localStorage.setItem("pickless_history", JSON.stringify(nextHistory));
    } catch {}
    setMeal([]);
    setMealVibe(null);
  }

  function mealPayload(extras?: object) {
    return {
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
      loved,
      skipped,
      userId,
      ...extras,
    };
  }

  function mapMealItem(
    data: any,
    role: "drink" | "main" | "dessert",
  ): MealItem {
    return {
      role,
      dish: data.dish,
      restaurant: data.restaurant,
      restaurantId: data.restaurantId,
      orderUrl: data.orderUrl,
      price: data.price,
      platform: data.platform,
      reason: data.reason,
      deliveryMins: data.deliveryMins,
      live: data.live,
    };
  }

  async function buildMeal() {
    if (buildingMeal) return;
    setBuildingMeal(true);
    setMeal([]);
    setMealVibe(null);
    const id = ++buildIdRef.current;
    try {
      const res = await fetch("/api/recommend-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mealPayload()),
      });
      const data = await res.json();
      if (buildIdRef.current !== id) return;
      if (data.drink && data.main && data.dessert) {
        setMeal([
          mapMealItem(data.drink, "drink"),
          mapMealItem(data.main, "main"),
          mapMealItem(data.dessert, "dessert"),
        ]);
        if (data.vibe) setMealVibe(data.vibe);
        sfx.bell();
      }
    } catch {}
    if (buildIdRef.current === id) setBuildingMeal(false);
  }

  async function regenerateSlot(role: "drink" | "main" | "dessert") {
    const snapshot = [...meal];
    const existing = {
      drink: meal.find((m) => m.role === "drink"),
      main: meal.find((m) => m.role === "main"),
      dessert: meal.find((m) => m.role === "dessert"),
    };
    // Optimistically clear the slot
    setMeal((prev) => prev.filter((m) => m.role !== role));
    try {
      const res = await fetch("/api/recommend-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mealPayload({
            lockSlots: (["drink", "main", "dessert"] as const).filter(
              (r) => r !== role,
            ),
            existing,
          }),
        ),
      });
      const data = await res.json();
      const newItem = data[role];
      if (newItem) {
        setMeal(() => {
          const order: Array<"drink" | "main" | "dessert"> = [
            "drink",
            "main",
            "dessert",
          ];
          return order
            .map((r) =>
              r === role
                ? mapMealItem(newItem, role)
                : (existing[r] ?? undefined),
            )
            .filter(Boolean) as MealItem[];
        });
        sfx.pop();
      } else {
        setMeal(snapshot);
      }
    } catch {
      setMeal(snapshot);
    }
  }

  function clearMeal() {
    buildIdRef.current++;
    setMeal([]);
    setMealVibe(null);
    setBuildingMeal(false);
  }

  function saveAddress() {
    const trimmed = addressDraft.trim();
    setEditingAddress(false);
    if (!trimmed) return;
    setSavedAddressDisplay(trimmed);
    try {
      localStorage.setItem("pickless_saved_address", JSON.stringify(trimmed));
    } catch {}
  }

  function skip(reason?: string) {
    if (rec?.dish && rec?.restaurant) {
      const next = recordSkip({
        dish: rec.dish,
        restaurant: rec.restaurant,
        cuisine: (rec.tags || []).join(", ") || undefined,
        reason,
      });
      setSkipped(next);
      setSkipToast(
        reason
          ? `noted · agent won't pitch ${reason.toLowerCase()} again`
          : `skipped · agent will avoid similar`,
      );
      setTimeout(() => setSkipToast(null), 2400);
    }
    setAskSkipReason(null);
    setPhase("idle");
    setRec(null);
    setTimeout(feedMe, 100);
  }

  function skipWithPrompt() {
    if (!rec) return;
    setAskSkipReason({ dish: rec.dish, restaurant: rec.restaurant });
  }

  function updatePrefs(next: Preferences) {
    setPrefs(next);
    try {
      localStorage.setItem("pickless_prefs", JSON.stringify(next));
    } catch {}
  }

  function pickFromPrediction(pick: PredictPick) {
    const asRec: Recommendation = {
      dish: pick.dish,
      restaurant: pick.restaurant,
      platform: pick.platform,
      price: pick.price,
      reason: pick.reason,
      tags: [pick.angle],
      sponsored: false,
      orderUrl: pick.orderUrl,
    };
    (asRec as any).vibe = pick.vibe;
    (asRec as any).order = pick.dish;
    setRec(asRec);
    const next = [
      { dish: pick.dish, restaurant: pick.restaurant },
      ...recentlyShownRef.current,
    ].slice(0, 20);
    recentlyShownRef.current = next;
    setRecentlyShown(next);
    try {
      localStorage.setItem("pickless_recently_shown", JSON.stringify(next));
    } catch {}
    setPhase("revealed");
    sfx.thunk();
    setTimeout(() => sfx.bell(), 320);
    const s = streak.bump();
    setStreakN(s);
    setTimeout(
      () =>
        cardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      120,
    );
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
          <RecoveryBadge userId={userId} />
          <TasteSyncBadge userId={userId} syncedAt={syncedAt} />
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

            <InlinePrefs prefs={prefs} onChange={updatePrefs} />

            <PredictPicks
              platforms={platforms}
              history={history}
              location={location}
              prefs={prefs}
              trends={trends}
              context={timeCtx || { timeOfDay: timeOfDay() }}
              mood={mood ? `${mood.label} (${mood.bias})` : null}
              weather={weather}
              tasteProfile={tasteProfile}
              warmth={warmth}
              liveRestaurants={liveRestaurants}
              recentlyShown={recentlyShown}
              loved={loved}
              skipped={skipped}
              lovedTick={lovedTick}
              userId={userId}
              onPick={pickFromPrediction}
            />

            <LovedPanel
              loved={loved}
              onChange={(next) => {
                setLoved(next);
                setLovedTick((t) => t + 1);
              }}
              onReorder={(asRec) => {
                setRec(asRec);
                const next = [
                  { dish: asRec.dish, restaurant: asRec.restaurant },
                  ...recentlyShownRef.current,
                ].slice(0, 20);
                recentlyShownRef.current = next;
                setRecentlyShown(next);
                try {
                  localStorage.setItem(
                    "pickless_recently_shown",
                    JSON.stringify(next),
                  );
                } catch {}
                setPhase("revealed");
                sfx.thunk();
                setTimeout(() => sfx.bell(), 320);
                const s = streak.bump();
                setStreakN(s);
                setTimeout(
                  () =>
                    cardRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    }),
                  120,
                );
              }}
            />

            <p className="mt-10 font-mono text-[10px] uppercase tracking-widest faint">
              or — let the agent pick blind
            </p>
            <button
              onClick={feedMe}
              className="mt-3 group inline-flex items-center gap-3 px-10 py-5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
            >
              Feed me
              <span className="font-jp">食</span>
            </button>

            <button
              onClick={buildMeal}
              disabled={buildingMeal}
              className="mt-2 font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--seal)] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {buildingMeal ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                  building your meal…
                </>
              ) : (
                "or build me a full meal →"
              )}
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

                {/* Agent delivery address — user can edit; auto-typed into Swiggy/Zomato */}
                <div className="mt-4 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                      Agent delivery address
                    </p>
                    {editingAddress ? (
                      <input
                        autoFocus
                        value={addressDraft}
                        onChange={(e) => setAddressDraft(e.target.value)}
                        onBlur={saveAddress}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveAddress();
                          if (e.key === "Escape") setEditingAddress(false);
                        }}
                        className="w-full font-display text-sm bg-transparent border-b border-[var(--ink)] outline-none pb-0.5 placeholder:opacity-30"
                        placeholder="e.g. Diamond District, Indiranagar"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setAddressDraft(savedAddressDisplay);
                          setEditingAddress(true);
                        }}
                        className="font-display text-sm tracking-tight text-left w-full hover:text-[var(--seal)] transition-colors flex items-center gap-2 group"
                      >
                        {savedAddressDisplay ? (
                          <>
                            <span>{savedAddressDisplay}</span>
                            <span className="font-mono text-[8px] uppercase tracking-widest faint group-hover:text-[var(--seal)] transition-colors">
                              edit
                            </span>
                          </>
                        ) : (
                          <span className="faint italic text-sm">
                            tap to set delivery address
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
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

            <div className="mt-5 flex items-center justify-center">
              <HeartButton
                rec={rec}
                loved={loved}
                onChange={(next) => {
                  setLoved(next);
                  setLovedTick((t) => t + 1);
                }}
              />
            </div>

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

            {meal.length > 0 && (
              <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
                <span className="font-mono text-[9px] uppercase tracking-widest faint">
                  Meal so far →
                </span>
                {meal.map((m, i) => (
                  <span
                    key={i}
                    className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 border border-[var(--seal)] text-[var(--seal)] rounded-sm"
                  >
                    {m.dish.split(" ").slice(0, 3).join(" ")}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-3 justify-center flex-wrap">
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
              {meal.length < 3 && (
                <button
                  onClick={addToMeal}
                  disabled={orderState === "placing"}
                  className="px-6 py-4 border hairline rounded-sm font-mono text-xs uppercase tracking-widest hover:text-[var(--seal)] hover:border-[var(--seal)] transition-colors disabled:opacity-30 flex items-center gap-2"
                  title="Save this for the meal — pick another dish next"
                >
                  <span className="font-jp text-base text-[var(--seal)] leading-none">
                    膳
                  </span>
                  {meal.length === 0
                    ? "+ Add to meal"
                    : meal.length === 1
                      ? "+ Add main"
                      : "+ Add dessert"}
                </button>
              )}
              <button
                onClick={skipWithPrompt}
                disabled={orderState === "placing"}
                className="px-6 py-4 border hairline rounded-sm font-mono text-xs uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors disabled:opacity-30"
              >
                Skip
              </button>
            </div>

            {askSkipReason && (
              <div className="mt-5 max-w-md mx-auto rise">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
                  why not this? — one tap teaches the agent
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "too heavy",
                    "too light",
                    "wrong mood",
                    "not hungry for this cuisine",
                    "tried it recently",
                    "too expensive",
                  ].map((r) => (
                    <button
                      key={r}
                      onClick={() => skip(r)}
                      className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 border hairline rounded-sm faint hover:text-[var(--seal)] hover:border-[var(--seal)] transition-colors"
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    onClick={() => skip()}
                    className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 rounded-sm faint hover:text-[var(--ink)] transition-colors"
                  >
                    just skip →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {rec && (
        <AutoOrderModal
          open={autoOrderOpen}
          userId={userId}
          dish={rec.dish}
          restaurant={rec.restaurant}
          platform={rec.platform}
          orderUrl={rec.orderUrl}
          onClose={() => setAutoOrderOpen(false)}
          onOrdered={autoOrderConfirmed}
        />
      )}

      {/* Meal cart — pinned bottom when meal in progress or building */}
      {(meal.length > 0 || buildingMeal) && phase !== "spinning" && (
        <MealCart
          items={meal}
          vibe={mealVibe}
          loading={buildingMeal}
          onRemove={removeFromMeal}
          onRegenerate={regenerateSlot}
          onOrder={orderFullMeal}
          onClear={clearMeal}
        />
      )}

      {/* Modal for the multi-item meal flow */}
      {meal.length > 0 && (
        <AutoOrderModal
          open={mealOrderOpen}
          userId={userId}
          platform={
            // Normalise to a single platform — majority vote, fallback to swiggy.
            // Avoids the agent using the wrong preset when items span platforms.
            meal
              .map((m) => m.platform)
              .sort(
                (a, b) =>
                  meal.filter((m) => m.platform === b).length -
                  meal.filter((m) => m.platform === a).length,
              )[0] || "swiggy"
          }
          items={meal.map((m) => ({
            dish: m.dish,
            restaurant: m.restaurant,
            orderUrl: m.orderUrl,
            price: m.price,
          }))}
          onClose={() => setMealOrderOpen(false)}
          onOrdered={mealOrderConfirmed}
        />
      )}

      {skipToast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 rise ${meal.length > 0 ? "bottom-32" : "bottom-6"}`}
        >
          <div className="bg-[var(--ink)] text-[var(--bg)] px-5 py-3 rounded-sm font-mono text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <span className="font-jp text-[var(--seal)] not-italic">✗</span>
            {skipToast}
          </div>
        </div>
      )}
    </main>
  );
}

function HeartButton({
  rec,
  loved,
  onChange,
}: {
  rec: Recommendation;
  loved: LovedPick[];
  onChange: (next: LovedPick[]) => void;
}) {
  const on = loved.some(
    (l) =>
      l.dish.toLowerCase().trim() === rec.dish.toLowerCase().trim() &&
      l.restaurant.toLowerCase().trim() === rec.restaurant.toLowerCase().trim(),
  );
  return (
    <button
      onClick={() => {
        sfx.pop();
        const { loved: next } = toggleLoved({
          dish: rec.dish,
          restaurant: rec.restaurant,
          price: rec.price,
        });
        onChange(next);
      }}
      className={`group inline-flex items-center gap-2.5 px-4 py-2 border rounded-sm font-mono text-[10px] uppercase tracking-widest transition-all ${
        on
          ? "border-transparent bg-[var(--seal)] text-white"
          : "hairline faint hover:text-[var(--seal)] hover:border-[var(--seal)]"
      }`}
      title={on ? "remove from loved" : "love this — bias future picks"}
    >
      <span aria-hidden className="text-base leading-none">
        {on ? "♥" : "♡"}
      </span>
      {on ? "loved · biasing" : "love this"}
    </button>
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
