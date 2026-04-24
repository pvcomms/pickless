import { NextRequest, NextResponse } from "next/server";
import { callGemini, extractJson } from "@/lib/gemini";
import type { ConsentToken } from "../generate/route";

type SuggestResult = {
  dish: string;
  reason: string;
};

export async function POST(req: NextRequest) {
  const { prefs, scope } = (await req.json()) as {
    prefs: ConsentToken["prefs"];
    scope: string;
  };

  const lovesLine =
    prefs.loves.length > 0 ? prefs.loves.slice(0, 6).join(", ") : "anything";
  const avoidsLine =
    prefs.avoids.length > 0 ? prefs.avoids.slice(0, 4).join(", ") : "nothing";
  const budget = `${prefs.budgetBand.currency} ${prefs.budgetBand.hi}`;
  const scopeLine =
    scope === "coffee"
      ? "coffee / café"
      : scope === "delivery"
        ? "delivery"
        : "restaurant";

  const prompt = `You are a food concierge at a ${scopeLine}. A customer just shared their taste token. Suggest ONE specific dish to serve them.

Customer profile:
- Loves: ${lovesLine}
- Avoids: ${avoidsLine}
- Budget cap: ${budget}
- Archetype: "${prefs.archetype}"

Rules:
- Pick ONE specific dish (not a category). Be decisive.
- Must respect avoids — never suggest anything containing them.
- Must fit within the budget cap.
- Reason must be ≤8 words, lowercase, punchy. No hedging.

Reply ONLY with JSON (no markdown, no fences):
{"dish":"<specific dish name>","reason":"<≤8 word lowercase reason>"}`;

  try {
    const out = await callGemini({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 80,
      timeoutMs: 8000,
    });
    const parsed = extractJson<SuggestResult>(out.text);
    if (!parsed?.dish) {
      return NextResponse.json(
        { error: "parse failed", raw: out.text },
        { status: 500 },
      );
    }
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json(
      { error: "gemini failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
}
