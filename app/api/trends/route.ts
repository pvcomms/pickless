import { NextRequest, NextResponse } from "next/server";
import { analyseTrends, type Order } from "@/lib/orders";
import { callGemini, extractJson } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { orders } = (await req.json()) as { orders: Order[] };
  const stats = analyseTrends(orders);
  if (!stats) return NextResponse.json({ insights: [], stats: null });

  const sample = orders
    .slice(0, 12)
    .map(
      (o) =>
        `${o.dish} · ${o.restaurant} · ${o.cuisine} · ${o.price} ${o.currency}`,
    )
    .join("\n");

  const prompt = `You're analysing a person's food order history to surface 3 sharp, specific insights they'd find useful or amusing. Be direct, lowercase, max 12 words each. No hedging.

Stats:
- ${stats.totalOrders} orders
- favourite cuisine: ${stats.topCuisine}
- most-ordered from: ${stats.topRestaurant}
- avg spend: ${stats.avgPrice} ${stats.primaryCurrency}
- orders most on: ${stats.weekdayPattern}

Recent orders:
${sample}

Reply ONLY with this JSON (no markdown):
{ "insights": ["insight 1", "insight 2", "insight 3"] }`;

  try {
    const out = await callGemini({
      prompt,
      temperature: 0.9,
      maxOutputTokens: 250,
    });
    const parsed: any = extractJson(out.text) || { insights: [] };
    return NextResponse.json({
      stats,
      insights: parsed.insights || [],
      modelUsed: out.modelUsed,
    });
  } catch {
    return NextResponse.json({ stats, insights: [] });
  }
}
