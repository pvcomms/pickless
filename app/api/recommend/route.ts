import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { platforms, history, location, prefs, context } = await req.json();
  const platformNames = platforms
    .map((id: string) => PLATFORMS.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const recentDishes = (history || [])
    .slice(-5)
    .map((h: { dish: string }) => h.dish)
    .join(", ");
  const locationLine = location
    ? `${location.neighborhood ? location.neighborhood + ", " : ""}${location.city}, ${location.country}`
    : "Unknown";
  const prefsLine = prefs
    ? `diet: ${prefs.diet} · budget: ${prefs.budget} · spice: ${prefs.spice}`
    : "no constraints";

  const prompt = `You are Pickless — a decisive food agent for someone who refuses to choose. They are HUNGRY. Pick ONE specific dish from a real restaurant near them.

Connected apps: ${platformNames || "Swiggy, Zomato"}
Location: ${locationLine}
Time: ${context?.timeOfDay || "dinner"}
Preferences: ${prefsLine}
Recent (don't repeat): ${recentDishes || "none yet"}

Pick a real, well-known restaurant in their neighborhood. Be opinionated. No hedging. Reply ONLY with this JSON (no markdown):
{
  "dish": "<specific dish name>",
  "restaurant": "<real restaurant in ${locationLine}>",
  "platform": "<one of: ${platforms.join(", ")}>",
  "price": "<price with local currency>",
  "reason": "<8-word punchy reason, lowercase>",
  "tags": ["<tag1>", "<tag2>"],
  "sponsored": false,
  "orderQuery": "<dish + restaurant>"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 250,
    messages: [{ role: "user", content: prompt }],
  });
  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]+\}/);
  if (!match)
    return NextResponse.json({ error: "parse failed" }, { status: 500 });
  const rec = JSON.parse(match[0]);
  const platform = PLATFORMS.find((p) => p.id === rec.platform) || PLATFORMS[0];
  rec.orderUrl = platform.searchUrl(rec.orderQuery);
  return NextResponse.json(rec);
}
