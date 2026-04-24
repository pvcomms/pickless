import { NextRequest, NextResponse } from "next/server";
import { type Order, analyseTrends } from "@/lib/orders";
import { callGemini, extractJson } from "@/lib/gemini";

export type TasteProfile = {
  archetype: string; // e.g. "south indian comfort + occasional indo-chinese binge"
  loyalRestaurants: string[]; // names they keep going back to
  signatureDishes: string[]; // dishes they order across restaurants
  loves: string[]; // cuisines / styles
  avoids: string[]; // inferred dietary patterns ("never beef", "no spicy past 9pm")
  budgetBand: { lo: number; hi: number; currency: string };
  timeRhythm: string; // "weekday lunches under ₹250, weekend dinners 600+"
  weakSpots: string[]; // guilty pleasures the agent should occasionally trigger
  agentInstructions: string; // how to please this person — written for Gemini's next call
};

export async function POST(req: NextRequest) {
  const { orders } = (await req.json()) as { orders: Order[] };
  const stats = analyseTrends(orders || []);
  if (!stats || (orders || []).length < 3) {
    return NextResponse.json({ profile: null, reason: "not enough orders" });
  }

  const lines = orders
    .slice(0, 30)
    .map(
      (o) =>
        `${o.orderedAt.slice(0, 10)} · ${o.cuisine} · ${o.dish} · ${o.restaurant} · ${o.currency} ${o.price}`,
    )
    .join("\n");

  const prompt = `You're analysing a person's full food-ordering history to build a deep taste profile that another AI agent can use to pick perfect meals for them.

Stats:
- ${stats.totalOrders} orders
- Top cuisine: ${stats.topCuisine}
- Most-ordered restaurant: ${stats.topRestaurant}
- Avg ticket: ${stats.avgPrice} ${stats.primaryCurrency}
- Peak day: ${stats.weekdayPattern}

Orders (newest first):
${lines}

Output the profile as JSON. Be specific, opinionated, and human. The "agentInstructions" field is the most important — it's a 2-3 sentence brief written for ANOTHER AI that will pick meals; tell it exactly how to please this person.

Reply ONLY with this JSON (no markdown):
{
  "archetype": "<one-line characterisation, e.g. 'south indian breakfast monk who blows out on hyderabadi biryani come weekends'>",
  "loyalRestaurants": ["..."],
  "signatureDishes": ["..."],
  "loves": ["..."],
  "avoids": ["..."],
  "budgetBand": { "lo": 0, "hi": 0, "currency": "INR" },
  "timeRhythm": "<observed pattern, when they order what>",
  "weakSpots": ["..."],
  "agentInstructions": "<2-3 sentence brief, lowercase, opinionated. tell another AI exactly how to please this person.>"
}`;

  try {
    const out = await callGemini({
      prompt,
      temperature: 0.6,
      maxOutputTokens: 900,
    });
    const profile = extractJson<TasteProfile>(out.text);
    if (!profile)
      return NextResponse.json({ profile: null, reason: "parse fail" });
    return NextResponse.json({ profile, modelUsed: out.modelUsed });
  } catch (e) {
    return NextResponse.json({ profile: null, reason: (e as Error).message });
  }
}
