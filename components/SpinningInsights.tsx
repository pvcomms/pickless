"use client";
import { useEffect, useState, useMemo } from "react";
import { SAYINGS as BIG_SAYINGS } from "@/lib/sayings";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Old short list kept as fallback only — primary pool is BIG_SAYINGS (200+).
const _UNUSED_SAYINGS = [
  // decision-fatigue / lifestyle
  "decision fatigue is real · spend it where it counts",
  "the average person makes 200 food choices a day · stop",
  "save the willpower for the work that matters",
  "outsource the trivial · own the important",
  "you've already decided enough today",
  "obama wore the same suit. zuck wore the same shirt. you skip the menu.",
  "the menu is a tax on your attention",
  "every minute scrolling swiggy is a minute not lived",
  "stop researching dinner like it's a thesis",

  // food / fuel framing
  "fuel for what's next, not just what's now",
  "eat like you respect the work",
  "the body keeps score · feed it accordingly",
  "good fuel · good output",
  "your kitchen is two taps away",
  "food is upstream of mood · pick well",
  "the meal is the small reward · the work is the big one",

  // contrarian / sharp
  "the third option is usually wrong anyway",
  "your gut already knows · we're just confirming",
  "indecision is a worse meal than a wrong call",
  "perfect dinner > no dinner · stop optimising",
  "you can't a/b test your stomach",
  "the agent has no preferences. that's the point.",

  // ritual / japanese / nordic
  "itadakimasu · receive what's given",
  "ichi-go ichi-e · this meal, this moment",
  "lagom · just enough, not too much",
  "the small ritual saves the big day",

  // cyborg / tech
  "humans pick. agents recommend. you eat.",
  "the loop closes when the food arrives",
  "your taste, ported once · plug-and-play forever",
  "we read the patterns · you live the life",

  // food-specific punchy
  "biryani solves more than you'd think",
  "noodles are a vibe, not a meal",
  "tikka is forever",
  "pizza is a wake-up call disguised as food",
  "rice is the universal yes",
  "soup at the right moment is therapy",

  // dad-joke / wry
  "no notes",
  "trust the process · eat the dish",
  "the agent has spoken",
  "this is the way",
];

function fmtAgo(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function dayOf(iso: string): string {
  return DAYS[new Date(iso).getDay()];
}

export function SpinningInsights({
  orders,
  trends,
  tasteProfile,
  weather,
  location,
  mood,
  prefs,
}: {
  orders: any[];
  trends: any;
  tasteProfile: any;
  weather: any;
  location: any;
  mood: any;
  prefs: any;
}) {
  const lines = useMemo(() => {
    const out: string[] = [];

    if (weather) {
      const c = weather.condition || "";
      const t = Math.round(weather.tempC);
      if (c.includes("rain") || weather.precipitationMm > 0) {
        out.push(`it's ${t}° with rain · biasing toward something warm`);
      } else if (t >= 32) {
        out.push(`it's ${t}° outside · leaning light + cooling`);
      } else if (t <= 18) {
        out.push(`it's ${t}° · comfort food weather`);
      } else {
        out.push(`it's ${t}°, ${c} · clean conditions`);
      }
    }

    if (location?.neighborhood || location?.city) {
      out.push(
        `scanning kitchens near ${location.neighborhood || location.city}`,
      );
      out.push(`agent reading ${location.city || "your area"} in real time`);
    }

    const last = orders?.[0];
    if (last) {
      out.push(
        `your last: ${last.dish.toLowerCase()} · ${dayOf(last.orderedAt)}, ${fmtAgo(last.orderedAt)}`,
      );
    }

    if (trends?.topCuisine) {
      out.push(
        `your pattern: ${trends.topCuisine.toLowerCase()} on ${trends.weekdayPattern || "weekdays"}s`,
      );
    }

    if (trends?.topRestaurant) {
      out.push(`you keep going back to ${trends.topRestaurant}`);
    }

    if (tasteProfile?.archetype) {
      out.push(
        `your archetype: ${String(tasteProfile.archetype).toLowerCase()}`,
      );
    }

    if (mood?.label) {
      out.push(`mood: ${mood.label.toLowerCase()} · biasing the pick`);
    }

    if (prefs?.dontEat?.length) {
      out.push(`hard rule · never ${prefs.dontEat.slice(0, 3).join(", ")}`);
    }

    if (prefs?.budgetMax) {
      out.push(`hard cap · under ₹${prefs.budgetMax}`);
    }

    // Pick 6 random sayings from the 200+ pool — each spin feels new
    const shuffled = [...BIG_SAYINGS].sort(() => Math.random() - 0.5);
    const sayingPicks = shuffled.slice(0, 6);
    // Interleave real signal + sayings so the user gets a steady mix
    const mixed: string[] = [];
    const maxLen = Math.max(out.length, sayingPicks.length);
    for (let i = 0; i < maxLen; i++) {
      if (out[i]) mixed.push(out[i]);
      if (sayingPicks[i]) mixed.push(sayingPicks[i]);
    }
    return mixed;
  }, [orders, trends, tasteProfile, weather, location, mood, prefs]);

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (lines.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), 1700);
    return () => clearInterval(id);
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div className="mt-6 min-h-[2.4em] flex items-center justify-center px-6">
      <p
        key={idx}
        className="font-mono text-[10px] uppercase tracking-widest faint text-center max-w-md"
        style={{ animation: "rise 700ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {lines[idx]}
      </p>
    </div>
  );
}
