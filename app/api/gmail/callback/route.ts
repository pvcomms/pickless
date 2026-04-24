import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchReceiptCorpus, type RawMessage } from "@/lib/gmail";
import type { Order } from "@/lib/orders";
import { callGemini, extractJson } from "@/lib/gemini";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("pickless_oauth_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/connect?gmail=denied", req.url));
  }

  try {
    const { access_token } = await exchangeCode(req, code);
    const corpus = await fetchReceiptCorpus(access_token);
    if (corpus.length === 0) {
      return NextResponse.redirect(new URL("/connect?gmail=ok&n=0", req.url));
    }
    const orders = await parseReceiptsWithGemini(corpus);

    // Stash in a short-lived cookie so the client page can pick it up + drop
    // into localStorage. Capped so the cookie doesn't blow past 4KB.
    const blob = JSON.stringify(orders.slice(0, 20));
    const res = NextResponse.redirect(
      new URL(`/connect?gmail=ok&n=${orders.length}`, req.url),
    );
    res.cookies.set("pickless_gmail_orders", blob, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.redirect(
      new URL(
        `/connect?gmail=err&msg=${encodeURIComponent((e as Error).message)}`,
        req.url,
      ),
    );
  }
}

async function parseReceiptsWithGemini(corpus: RawMessage[]): Promise<Order[]> {
  const sample = corpus
    .map(
      (m, i) =>
        `--- email ${i + 1} ---\nfrom: ${m.from}\nsubject: ${m.subject}\ndate: ${m.date}\nbody: ${m.bodyText}`,
    )
    .join("\n\n");

  const prompt = `Below are ${corpus.length} delivery-receipt emails from Swiggy or Zomato. For each one that's an order confirmation, extract: dish (the main item or summary like "Chicken Biryani + 2 sides"), restaurant name, cuisine (your best guess), price (total in INR as number), platform ("swiggy" or "zomato" inferred from sender), orderedAt (ISO date).

Skip promotional emails, refund notices, or non-order messages.

Reply ONLY with this JSON (no markdown, no explanation):
{
  "orders": [
    { "dish": "...", "restaurant": "...", "cuisine": "...", "price": 340, "platform": "swiggy", "orderedAt": "2026-04-15T19:30:00Z", "deliveryAddress": "" }
  ]
}

Emails:
${sample.slice(0, 28000)}`;

  let text = "";
  try {
    const out = await callGemini({
      prompt,
      temperature: 0.1,
      maxOutputTokens: 4000,
    });
    text = out.text;
  } catch (e) {
    throw new Error(`gemini parse failed: ${(e as Error).message}`);
  }
  const parsed: any = extractJson(text);
  if (!parsed) return [];
  try {
    return (parsed.orders || []).map(
      (o: any, i: number): Order => ({
        id: `gmail-${Date.now()}-${i}`,
        platform: o.platform || "swiggy",
        dish: o.dish || "Unknown",
        restaurant: o.restaurant || "Unknown",
        cuisine: o.cuisine || "—",
        price: Number(o.price) || 0,
        currency: "INR",
        orderedAt: o.orderedAt || new Date().toISOString(),
        deliveryAddress: o.deliveryAddress || "",
      }),
    );
  } catch {
    return [];
  }
}
