import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";
import { fetchSwiggyRestaurants, type LiveRestaurant } from "@/lib/swiggy";
import { callGemini, extractJson } from "@/lib/gemini";
import { fetchLatestSnapshot, biasHint, isConnected } from "@/lib/whoop";

export async function POST(req: NextRequest) {
  const {
    platforms,
    history,
    location,
    prefs,
    trends,
    context,
    mood,
    device,
    weather,
    tasteProfile,
    warmth,
    preFetched,
    recentlyShown,
    loved,
    userId,
  } = await req.json();
  const seed = Math.floor(Math.random() * 100000);
  const platformNames = platforms
    .map((id: string) => PLATFORMS.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  // ── Use client pre-fetched restaurants when available, else fetch live ──
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

  // Shuffle then slice — same pool, different sample each call → more variety.
  // Seeded by Math.random() (already established as `seed` above) so each
  // request gets a fresh sub-set of the live pool.
  const shuffled = [...liveRestaurants].sort(() => Math.random() - 0.5);
  const candidates = shuffled.slice(0, 10);

  const restaurantList =
    candidates.length > 0
      ? candidates
          .map(
            (r, i) =>
              `${i + 1}. ${r.name} — ${r.cuisines.slice(0, 3).join("/")} · ${r.costForTwo} · ★${r.rating} · ${r.deliveryMins}min · ${r.areaName} · id:${r.id}`,
          )
          .join("\n")
      : "(no live data — pick from generic well-known restaurants)";

  // Track BOTH ordered history AND just-shown picks. Otherwise, when a user
  // hits Skip → Feed Me repeatedly, the agent keeps suggesting the same thing
  // because Skip never enters the "history" pile.
  const orderedDishes = (history || []).slice(0, 10).map((h: any) => h.dish);
  const shownDishes = Array.isArray(recentlyShown)
    ? recentlyShown.slice(0, 15).map((h: any) => `${h.dish} @ ${h.restaurant}`)
    : [];
  const dontRepeat = [...new Set([...shownDishes, ...orderedDishes])].join(
    " | ",
  );
  const locationLine = location
    ? `${location.neighborhood ? location.neighborhood + ", " : ""}${location.city}, ${location.country}`
    : "Unknown";
  const prefsLine = prefs
    ? `diet: ${prefs.diet} · vibe: ${prefs.vibe} · spice: ${prefs.spice} · budget HARD CAP ₹${prefs.budgetMax || 500}${prefs.cuisines?.length ? " · loves: " + prefs.cuisines.join(", ") : ""}${prefs.dontEat?.length ? " · NEVER EAT: " + prefs.dontEat.join(", ") : ""}`
    : "no constraints";
  const trendLine = trends
    ? `loves ${trends.topCuisine}, frequents ${trends.topRestaurant}, avg spend ${trends.avgPrice} ${trends.primaryCurrency}, peak day ${trends.weekdayPattern}`
    : "no learned pattern yet";

  const deviceLine = device
    ? `${device.kind} on ${device.os}${device.installed ? " (installed PWA)" : ""} · ${device.width}px wide`
    : "unknown device";
  const weatherLine = weather
    ? `${Math.round(weather.tempC)}°C feels ${Math.round(weather.feelsLikeC)}°C · ${weather.condition}${weather.precipitationMm ? " · raining" : ""}${weather.windKph > 25 ? " · windy" : ""}`
    : "no weather signal";
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
          whoopLine = `BIOMETRIC BIAS (Whoop, recovery=${snap.recoveryScore}%, sleep=${snap.sleepPerformance}%): ${hint}`;
        }
      }
    } catch {}
  }

  // Compact taste profile (faster generation than the verbose multi-line version)
  const tasteLine = tasteProfile
    ? `\nTaste: ${tasteProfile.archetype || ""} · brief: "${(tasteProfile.agentInstructions || "").slice(0, 200)}"`
    : `\nTaste: unknown — use hyper-local bestsellers for this neighbourhood.`;

  const prompt = `You are Pickless — a decisive food agent for someone who refuses to choose. They are HUNGRY right now. Pick ONE specific dish from one of the LIVE restaurants below.

== CONTEXT ==
Connected apps: ${platformNames || "Swiggy"}
Location: ${locationLine}${location?.lat ? ` (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})` : ""}
Time: ${context?.timeOfDay || "dinner"} · ${context?.dayOfWeek || ""}${context?.isWeekend ? " (weekend)" : ""}
Device: ${deviceLine}
Weather: ${weatherLine}
Visit: ${warmth || "first visit"}
Mood right now: ${mood || "—"}
Stated prefs: ${prefsLine}
Aggregate trend: ${trendLine}
RECENTLY SHOWN OR ORDERED — NEVER repeat any of these:
${dontRepeat || "(none yet)"}
${lovedLine ? `\nHEARTS (user explicitly loved these — STRONG positive signal, lean toward similar cuisine/style/restaurant, but don't literally repeat):\n${lovedLine}` : ""}${whoopLine ? `\n\n${whoopLine}\n(This is a TOP-2 directive — only mood overrides it. Pick should answer to the body state.)` : ""}

Diversity seed: ${seed} (use this to break ties; pick differently than you would have last time)${tasteLine}

== LIVE INVENTORY ==
Live restaurants pulled from Swiggy dapi ${candidates.length ? "just now" : "— api failed, use world knowledge"}:
${restaurantList}

== DIRECTIVE ==
Past orders are SIGNAL — not the answer. Do NOT just re-recommend their last orders. Use them to triangulate taste, then pick something that fits THIS moment.

Hard rules (cannot violate):
- HARD CAP: price must be ≤ ₹${prefs?.budgetMax || 500}
- NEVER EAT: must not contain ${prefs?.dontEat?.length ? prefs.dontEat.join(", ") : "—"} as a primary ingredient
- Diet: respect ${prefs?.diet || "any"}
- DO NOT REPEAT any dish OR restaurant in the "RECENTLY SHOWN OR ORDERED" list above
- DIVERSIFY: if last shown was Italian, lean Indian/Asian/Mexican now. If last was a dessert, lean savoury. If last was the same restaurant, switch. The user wants VARIETY, not the same thing twice.

Soft priority (in order):
1. Mood right now — overrides everything else when they conflict.
2. Weather + time + day — cold rain at 9pm = comfort carbs; hot afternoon = light/cooling; weekday lunch = fast + filling; weekend dinner = generous.
3. Taste profile's agentInstructions — if present, the master brief on how to please this person.
4. Hyper-local bestseller knowledge — what's actually most-ordered in THIS exact neighbourhood right now.
5. Past orders — only as taste cue, never as direct copy.
6. Device — phone = faster delivery; desktop = ok bigger order.

Be opinionated. No hedging. Address them like an old friend who knows them. The "platform" should be "swish" if deliveryMins ≤20, otherwise "swiggy".

Reply ONLY with this JSON (no markdown):
{
  "dish": "<specific real dish name from their cuisine>",
  "restaurant": "<exact restaurant name from list>",
  "restaurantId": "<id from list, or empty>",
  "platform": "<swish if ≤20min else swiggy>",
  "price": "<price in ₹>",
  "order": "<full order detail in 6-12 words: 'Mac burger + jalapeños + coleslaw + fries' style>",
  "reason": "<8-word punchy lowercase reason>",
  "vibe": "<one italic line, 10-14 words, painting how this meal will feel — like 'crisp edges, soft middle, tastes like a good Saturday'>",
  "tags": ["<tag1>", "<tag2>"],
  "sponsored": false
}`;

  let text = "";
  let modelUsed = "";
  try {
    const out = await callGemini({
      prompt,
      temperature: 0.9,
      maxOutputTokens: 280,
      timeoutMs: 12000,
    });
    text = out.text;
    modelUsed = out.modelUsed;
  } catch (e) {
    return NextResponse.json(
      { error: "gemini failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const rec: any = extractJson(text);
  if (!rec) {
    return NextResponse.json({ error: "parse failed", text }, { status: 500 });
  }
  rec.modelUsed = modelUsed;

  // Use REAL Swiggy URL if we matched a live restaurant
  const matched = liveRestaurants.find((r) => r.id === rec.restaurantId);
  if (matched) {
    rec.orderUrl = matched.swiggyUrl;
    rec.deliveryMins = matched.deliveryMins;
    rec.rating = matched.rating;
    rec.areaName = matched.areaName;
    rec.live = true;
  } else {
    const platform =
      PLATFORMS.find((p) => p.id === rec.platform) || PLATFORMS[0];
    rec.orderUrl = platform.searchUrl(`${rec.dish} ${rec.restaurant}`);
    rec.live = false;
  }

  return NextResponse.json(rec);
}
