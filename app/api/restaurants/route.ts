import { NextRequest, NextResponse } from "next/server";
import { fetchSwiggyRestaurants, type LiveRestaurant } from "@/lib/swiggy";
import { fetchZomatoRestaurants } from "@/lib/zomato";

type Source = "swiggy" | "zomato" | "swish";

export type LiveRestaurantWithSource = LiveRestaurant & { source: Source[] };

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const city = req.nextUrl.searchParams.get("city") || "";
  const neighborhood = req.nextUrl.searchParams.get("neighborhood") || "";

  if (!lat || !lng) {
    return NextResponse.json({ error: "missing coords" }, { status: 400 });
  }

  // Fire both fetchers in parallel.
  const [swiggyRes, zomatoRes] = await Promise.allSettled([
    fetchSwiggyRestaurants(lat, lng),
    city ? fetchZomatoRestaurants(city, neighborhood) : Promise.resolve([]),
  ]);

  const swiggy = swiggyRes.status === "fulfilled" ? swiggyRes.value : [];
  const zomato = zomatoRes.status === "fulfilled" ? zomatoRes.value : [];

  // Merge by lower-cased restaurant name; if a name appears on both,
  // the merged entry carries both source tags.
  const byName = new Map<string, LiveRestaurantWithSource>();
  for (const r of swiggy) {
    const key = r.name.toLowerCase().trim();
    const sources: Source[] = [r.isQuickDelivery ? "swish" : "swiggy"];
    byName.set(key, { ...r, source: sources });
  }
  for (const r of zomato) {
    const key = r.name.toLowerCase().trim();
    const existing = byName.get(key);
    if (existing) {
      if (!existing.source.includes("zomato")) existing.source.push("zomato");
      // Prefer Zomato URL when both available — direct restaurant page link.
      if (r.zomatoSearchUrl) existing.zomatoSearchUrl = r.zomatoSearchUrl;
    } else {
      byName.set(key, { ...r, source: ["zomato"] });
    }
  }

  const merged = Array.from(byName.values()).sort(
    (a, b) => b.rating - a.rating,
  );

  return NextResponse.json({
    sources: { swiggy: swiggy.length, zomato: zomato.length },
    count: merged.length,
    restaurants: merged,
    fetchedAt: new Date().toISOString(),
  });
}
