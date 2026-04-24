import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";
import { fetchSwiggyRestaurants, type LiveRestaurant } from "@/lib/swiggy";
import { callGemini, extractJson } from "@/lib/gemini";
import { fetchLatestSnapshot, biasHint, isConnected } from "@/lib/whoop";

export type PredictPick = {
  dish: string;
  restaurant: string;
  restaurantId: string;
  platform: string;
  price: string;
  vibe: string;
  reason: string;
  angle: string;
  orderUrl: string;
  deliveryMins?: number;
  rating?: number;
  live?: boolean;
};

export async function POST(req: NextRequest) {
  const {
    platforms = ["swiggy"],
    history,
    location,
    prefs,
    trends,
    context,
    mood,
    weather,
    tasteProfile,
    warmth,
    preFetched,
    recentlyShown,
    loved,
    userId,
  } = await req.json();

  const platformNames = platforms
    .map((id: string) => PLATFORMS.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  let liveRestaurants: LiveRestaurant[] = [];
  if (Array.isArray(preFetched) && preFetched.length > 0) {
    liveRestaurants = preFetched as LiveRestaurant[];
  } else if (location?.lat && location?.lng) {
    try {
      liveRestaurants = await fetchSwiggyRestaurants(
        location.lat,
        location.lng,
      );
    } catch {}
  }

  const shuffled = [...liveRestaurants].sort(() => Math.random() - 0.5);
  const candidates = shuffled.slice(0, 14);

  const restaurantList =
    candidates.length > 0
      ? candidates
          .map(
            (r, i) =>
              `${i + 1}. ${r.name} — ${r.cuisines.slice(0, 3).join("/")} · ${r.costForTwo} · ★${r.rating} · ${r.deliveryMins}min · id:${r.id}`,
          )
          .join("\n")
      : "(no live data — pick from generic well-known dishes)";

  const orderedDishes = (history || []).slice(0, 8).map((h: any) => h.dish);
  const shownDishes = Array.isArray(recentlyShown)
    ? recentlyShown.slice(0, 12).map((h: any) => `${h.dish} @ ${h.restaurant}`)
    : [];
  const dontRepeat = [...new Set([...shownDishes, ...orderedDishes])].join(
    " | ",
  );
  const lovedLine =
    Array.isArray(loved) && loved.length > 0
      ? loved
          .slice(0, 8)
          .map((l: any) => `${l.dish} @ ${l.restaurant}`)
          .join(" | ")
      : "";

  let whoopLine = "";
  if (typeof userId === "string" && /^[a-z0-9]{4,32}$/i.test(userId)) {
    try {
      if (await isConnected(userId)) {
        const snap = await fetchLatestSnapshot(userId);
        const hint = biasHint(snap);
        if (hint) {
          whoopLine = `BIOMETRIC BIAS (from user's Whoop strap, recovery=${snap.recoveryScore}%, sleep=${snap.sleepPerformance}%): ${hint}`;
        }
      }
    } catch {}
  }

  const locationLine = location
    ? `${location.neighborhood ? location.neighborhood + ", " : ""}${location.city}, ${location.country}`
    : "Unknown";
  const prefsLine = prefs
    ? `diet: ${prefs.diet} · vibe: ${prefs.vibe} · spice: ${prefs.spice} · budget HARD CAP ₹${prefs.budgetMax || 500}${prefs.cuisines?.length ? " · loves: " + prefs.cuisines.join(", ") : ""}${prefs.dontEat?.length ? " · NEVER EAT: " + prefs.dontEat.join(", ") : ""}`
    : "no constraints";
  const weatherLine = weather
    ? `${Math.round(weather.tempC)}°C · ${weather.condition}${weather.precipitationMm ? " · raining" : ""}`
    : "no weather signal";
  const tasteLine = tasteProfile
    ? `Taste: ${tasteProfile.archetype || ""} · brief: "${(tasteProfile.agentInstructions || "").slice(0, 180)}"`
    : `Taste: unknown — use hyper-local bestsellers.`;
  const trendLine = trends
    ? `loves ${trends.topCuisine}, frequents ${trends.topRestaurant}, avg ${trends.avgPrice} ${trends.primaryCurrency}`
    : "no learned pattern yet";

  const seed = Math.floor(Math.random() * 100000);

  const prompt = `You are Pickless. Pre-bake THREE distinct dish picks for someone who'll be hungry in ~5 minutes. Goal: each card represents a clearly DIFFERENT angle so they can pick on instinct.

== CONTEXT ==
Apps: ${platformNames}
Location: ${locationLine}
Time: ${context?.timeOfDay || "dinner"} · ${context?.dayOfWeek || ""}${context?.isWeekend ? " (weekend)" : ""}
Weather: ${weatherLine}
Visit: ${warmth || "first visit"}
Mood: ${mood || "—"}
Stated prefs: ${prefsLine}
Trend: ${trendLine}
${tasteLine}
NEVER repeat (recently shown / ordered): ${dontRepeat || "(none)"}${lovedLine ? `\nHEARTS (user explicitly loved — strong positive signal; the "safe" pick especially should echo this taste, but don't literally repeat):\n${lovedLine}` : ""}${whoopLine ? `\n\n${whoopLine}\n(Treat this as a TOP-2 directive — only mood overrides it. The "smart" pick especially should answer to this body state.)` : ""}
Diversity seed: ${seed}

== LIVE INVENTORY ==
${restaurantList}

== DIRECTIVE ==
Return EXACTLY 3 picks. Each pick must:
- be from a DIFFERENT restaurant
- be from a DIFFERENT cuisine family
- hit a DIFFERENT angle (label it):
  • "safe" — what they'd want 70% of the time, comfort/familiar
  • "smart" — fits THIS moment best (weather + time + mood + recovery)
  • "wild" — adventure, something they wouldn't normally pick but would love
- respect ALL hard rules: ≤ ₹${prefs?.budgetMax || 500}, diet ${prefs?.diet || "any"}, never contain ${prefs?.dontEat?.length ? prefs.dontEat.join(", ") : "—"}
- not appear in the recently-shown list
- pick "swish" platform if deliveryMins ≤ 20 else "swiggy"

Reply ONLY with this JSON (no markdown, no preamble):
{
  "picks": [
    {
      "angle": "safe",
      "dish": "<specific dish>",
      "restaurant": "<exact name from list>",
      "restaurantId": "<id from list>",
      "platform": "swish|swiggy",
      "price": "<₹ amount>",
      "vibe": "<one italic line, 8-12 words painting how it'll feel>",
      "reason": "<6-8 words, lowercase, why THIS for THEM>"
    },
    { "angle": "smart", ... },
    { "angle": "wild", ... }
  ]
}`;

  let text = "";
  let modelUsed = "";
  try {
    const out = await callGemini({
      prompt,
      temperature: 0.95,
      maxOutputTokens: 700,
      timeoutMs: 14000,
    });
    text = out.text;
    modelUsed = out.modelUsed;
  } catch (e) {
    return NextResponse.json(
      { error: "gemini failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const parsed = extractJson<{ picks: PredictPick[] }>(text);
  if (!parsed?.picks || !Array.isArray(parsed.picks)) {
    return NextResponse.json(
      { error: "parse failed", text: text.slice(0, 500) },
      { status: 500 },
    );
  }

  const enriched = parsed.picks.map((p) => {
    const matched = liveRestaurants.find((r) => r.id === p.restaurantId);
    if (matched) {
      return {
        ...p,
        orderUrl: matched.swiggyUrl,
        deliveryMins: matched.deliveryMins,
        rating: matched.rating,
        live: true,
      };
    }
    const platform =
      PLATFORMS.find((pl) => pl.id === p.platform) || PLATFORMS[0];
    return {
      ...p,
      orderUrl: platform.searchUrl(`${p.dish} ${p.restaurant}`),
      live: false,
    };
  });

  return NextResponse.json({ picks: enriched, modelUsed });
}
