import { NextRequest, NextResponse } from "next/server";
import { type Order } from "@/lib/orders";
import { callGemini, extractJson } from "@/lib/gemini";

export type PredictedPrefs = {
  diet: "any" | "veg" | "vegan" | "halal";
  dietConfidence: number; // 0-1
  dietWhy: string;
  loves: { item: string; signal: string }[]; // ["chicken", "ordered 4× in 2 weeks"]
  likelyOk: { item: string; reason: string }[]; // ["eggs", "you eat poultry frequently"]
  watchFor: { item: string; reason: string }[]; // ["nuts", "thai dishes — verify"]
  cuisines: string[];
  budgetBand: { lo: number; hi: number };
};

export async function POST(req: NextRequest) {
  const { orders } = (await req.json()) as { orders: Order[] };
  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({
      predicted: null,
      reason: "no orders to analyse",
    });
  }

  const lines = orders
    .slice(0, 30)
    .map(
      (o, i) =>
        `${i + 1}. ${o.dish} · ${o.cuisine} · ${o.restaurant} · ${o.currency} ${o.price}`,
    )
    .join("\n");

  const prompt = `You're a food-preference predictor. Given this person's recent order history, predict what they likely eat / like / want avoided.

Orders:
${lines}

Be RELATIONAL: if they order chicken often, infer they're non-veg + likely ok with eggs/dairy. If they order biryani, infer rice + spicy ok. If they order pizza + pasta, infer Italian-friendly + dairy ok. If they avoid meat across all orders, infer vegetarian.

Be HONEST about confidence. If only 3 orders, dietConfidence ≤ 0.5. If 15+, can be 0.85+.

Reply ONLY with this JSON (no markdown):
{
  "diet": "any|veg|vegan|halal",
  "dietConfidence": 0.85,
  "dietWhy": "<one-line proof, lowercase, e.g. 'chicken biryani 4×, no veg orders'>",
  "loves": [
    { "item": "chicken", "signal": "ordered 5× in 30 days" },
    { "item": "biryani", "signal": "your top dish" }
  ],
  "likelyOk": [
    { "item": "eggs", "reason": "you eat poultry · likely ok" },
    { "item": "dairy", "reason": "ordered paneer + ice cream" }
  ],
  "watchFor": [
    { "item": "nuts", "reason": "no signal either way · confirm" }
  ],
  "cuisines": ["Indian", "Italian"],
  "budgetBand": { "lo": 200, "hi": 500 }
}`;

  try {
    const out = await callGemini({
      prompt,
      temperature: 0.3,
      maxOutputTokens: 700,
      timeoutMs: 15000,
    });
    const predicted = extractJson<PredictedPrefs>(out.text);
    if (!predicted)
      return NextResponse.json({ predicted: null, reason: "parse fail" });
    return NextResponse.json({ predicted, modelUsed: out.modelUsed });
  } catch (e) {
    return NextResponse.json({ predicted: null, reason: (e as Error).message });
  }
}
