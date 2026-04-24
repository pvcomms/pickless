import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";
import { fetchSwiggyRestaurants, type LiveRestaurant } from "@/lib/swiggy";
import { callGemini, extractJson } from "@/lib/gemini";

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
    skipped,
    userId,
  } = await req.json();

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
  const candidates = shuffled.slice(0, 12);

  const restaurantList =
    candidates.length > 0
      ? candidates
          .map(
            (r, i) =>
              `${i + 1}. ${r.name} — ${r.cuisines.slice(0, 3).join("/")} · ${r.costForTwo} · ★${r.rating} · ${r.deliveryMins}min · ${r.areaName} · id:${r.id}`,
          )
          .join("\n")
      : "(no live data — pick from generic well-known restaurants)";

  const prefsLine = prefs
    ? `diet: ${prefs.diet} · vibe: ${prefs.vibe} · spice: ${prefs.spice} · budget HARD CAP ₹${prefs.budgetMax || 500}${prefs.dontEat?.length ? " · NEVER EAT: " + prefs.dontEat.join(", ") : ""}`
    : "no constraints";

  const locationLine = location
    ? `${location.neighborhood ? location.neighborhood + ", " : ""}${location.city}`
    : "Unknown";

  const tasteLine = tasteProfile
    ? `Taste: ${tasteProfile.archetype || ""} · "${(tasteProfile.agentInstructions || "").slice(0, 150)}"`
    : "";

  const prompt = `You are Pickless — a decisive food agent. Design a complete meal for this person: one drink + one main + one dessert. The three items should feel intentional together — same vibe, complementary flavours.

== CONTEXT ==
Location: ${locationLine}
Time: ${context?.timeOfDay || "dinner"}
Mood: ${mood || "—"}
Prefs: ${prefsLine}
${tasteLine}

== LIVE RESTAURANTS ==
${restaurantList}

== DIRECTIVE ==
Pick three items that form a satisfying complete meal:
- drink: a beverage (chai, juice, lassi, coffee, nimbu pani, soda — whatever fits the mood and cuisine)
- main: the centrepiece dish — filling, satisfying, on-brand for this person's taste
- dessert: something small and sweet to close — gulab jamun, kulfi, brownie, whatever fits

Prefer all three from the same restaurant if that restaurant can serve all courses. Otherwise pick best-in-class per course from different restaurants.

Hard rules:
- HARD CAP: each item's price must be ≤ ₹${prefs?.budgetMax || 500}
- Diet: respect ${prefs?.diet || "any"}
- NEVER EAT: ${prefs?.dontEat?.length ? prefs.dontEat.join(", ") : "—"}

Reply ONLY with this JSON (no markdown fences):
{
  "drink": {
    "dish": "<beverage name>",
    "restaurant": "<restaurant name from list>",
    "restaurantId": "<id from list or empty string>",
    "platform": "<swish if deliveryMins≤20 else swiggy>",
    "price": "<₹XX>",
    "reason": "<5-7 word reason>"
  },
  "main": {
    "dish": "<main dish name>",
    "restaurant": "<restaurant name>",
    "restaurantId": "<id or empty>",
    "platform": "<swish or swiggy>",
    "price": "<₹XX>",
    "reason": "<5-7 word reason>"
  },
  "dessert": {
    "dish": "<dessert name>",
    "restaurant": "<restaurant name>",
    "restaurantId": "<id or empty>",
    "platform": "<swish or swiggy>",
    "price": "<₹XX>",
    "reason": "<5-7 word reason>"
  },
  "vibe": "<one line painting how this full meal will feel, 10-14 words — like 'smoky, cold, sweet at the end — a complete arc'>"
}`;

  let text = "";
  try {
    const out = await callGemini({
      prompt,
      temperature: 0.9,
      maxOutputTokens: 600,
      timeoutMs: 18000,
    });
    text = out.text;
  } catch (e) {
    return NextResponse.json(
      { error: "gemini failed", detail: (e as Error).message },
      { status: 502 },
    );
  }

  const meal: any = extractJson(text);
  if (!meal) {
    return NextResponse.json({ error: "parse failed", text }, { status: 500 });
  }

  function resolveItem(item: any) {
    if (!item) return item;
    const matched = liveRestaurants.find((r) => r.id === item.restaurantId);
    if (matched) {
      item.orderUrl = matched.swiggyUrl;
      item.deliveryMins = matched.deliveryMins;
      item.live = true;
    } else {
      const platform =
        PLATFORMS.find((p) => p.id === item.platform) || PLATFORMS[0];
      item.orderUrl = platform.searchUrl(`${item.dish} ${item.restaurant}`);
      item.live = false;
    }
    item.tags = [];
    item.sponsored = false;
    return item;
  }

  meal.drink = resolveItem(meal.drink);
  meal.main = resolveItem(meal.main);
  meal.dessert = resolveItem(meal.dessert);

  return NextResponse.json(meal);
}
