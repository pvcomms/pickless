// Server-side Zomato fetcher — pulls JSON-LD ItemList from city page HTML.
// No auth required. Real, real-time data, just gated behind HTML scraping.

import type { LiveRestaurant } from "./swiggy";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function citySlug(city: string): string {
  return slugify(city || "bangalore");
}

export async function fetchZomatoRestaurants(
  city: string,
  neighborhood?: string,
): Promise<LiveRestaurant[]> {
  const slug = citySlug(city);
  // Try neighborhood-specific listing first, fall back to city root.
  const urls = [
    neighborhood
      ? `https://www.zomato.com/${slug}/${slugify(neighborhood)}-restaurants/order`
      : null,
    `https://www.zomato.com/${slug}`,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        next: { revalidate: 60 },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const restaurants = parseJsonLd(html);
      if (restaurants.length > 0) return restaurants;
    } catch {}
  }
  return [];
}

function parseJsonLd(html: string): LiveRestaurant[] {
  const blockRegex =
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  const out: LiveRestaurant[] = [];
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const list = Array.isArray(data) ? data : [data];
      for (const d of list) {
        if (d?.["@type"] === "ItemList") {
          for (const el of d.itemListElement || []) {
            const item = el?.item || el;
            if (item?.["@type"] === "Restaurant") {
              out.push(normalise(item));
            }
          }
        } else if (d?.["@type"] === "Restaurant") {
          out.push(normalise(d));
        }
      }
    } catch {}
  }
  return out.slice(0, 25);
}

function normalise(r: any): LiveRestaurant {
  const name = r.name || "Unknown";
  const cuisines = (r.servesCuisine || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const rating = Number(r?.aggregateRating?.ratingValue || 0);
  const ratingCount = String(
    r?.aggregateRating?.reviewCount || r?.aggregateRating?.ratingCount || "",
  );
  const priceRangeMatch = (r.priceRange || "").match(/(\d+)/);
  const costForTwo = priceRangeMatch ? `₹${priceRangeMatch[1]} for two` : "";
  const url = r.url || r["@id"] || "";
  const slug = slugify(name);
  const id = url.match(/\/(\d{4,})/)?.[1] || slug;
  const areaName =
    r?.address?.addressLocality || r?.address?.streetAddress || "";

  return {
    id,
    name,
    cuisines,
    costForTwo,
    rating,
    ratingCount,
    deliveryMins: 30, // Zomato doesn't expose ETA in JSON-LD; default to "regular"
    areaName,
    cloudinaryId: "",
    slug,
    swiggyUrl:
      url || `https://www.zomato.com/search?q=${encodeURIComponent(name)}`,
    zomatoSearchUrl: url,
    isQuickDelivery: false,
  };
}
