// Server-side fetcher hitting Swiggy's public restaurant-listing dapi.
// No auth required — same endpoint their own swiggy.com uses for the listing page.

export type LiveRestaurant = {
  id: string;
  name: string;
  cuisines: string[];
  costForTwo: string;
  rating: number;
  ratingCount: string;
  deliveryMins: number;
  areaName: string;
  cloudinaryId: string;
  slug: string;
  swiggyUrl: string;
  zomatoSearchUrl: string;
  isQuickDelivery: boolean;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function fetchSwiggyRestaurants(
  lat: number,
  lng: number,
): Promise<LiveRestaurant[]> {
  const url = `https://www.swiggy.com/dapi/restaurants/list/v5?lat=${lat}&lng=${lng}&page_type=DESKTOP_WEB_LISTING`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`swiggy ${res.status}`);
  const data = await res.json();

  // Walk the cards looking for the one with infoWithStyle.restaurants
  let rests: any[] = [];
  for (const c of data?.data?.cards || []) {
    const inner = c?.card?.card;
    const found = inner?.gridElements?.infoWithStyle?.restaurants;
    if (Array.isArray(found) && found.length > 0) {
      rests = found;
      break;
    }
  }

  return rests.slice(0, 25).map((r): LiveRestaurant => {
    const i = r.info || {};
    const slug = slugify(i.name || "restaurant");
    const areaSlug = slugify(i.areaName || "city");
    const sla = i.sla || {};
    const deliveryMins = Number(sla.deliveryTime || sla.maxDeliveryTime || 30);
    return {
      id: String(i.id),
      name: i.name || "Unknown",
      cuisines: i.cuisines || [],
      costForTwo: i.costForTwo || "",
      rating: Number(i.avgRating || 0),
      ratingCount: i.totalRatingsString || `${i.totalRatings || 0}+`,
      deliveryMins,
      areaName: i.areaName || "",
      cloudinaryId: i.cloudinaryImageId || "",
      slug,
      swiggyUrl: `https://www.swiggy.com/city/${areaSlug}/${slug}-${areaSlug}-rest${i.id}`,
      zomatoSearchUrl: `https://www.zomato.com/search?q=${encodeURIComponent(i.name || "")}`,
      isQuickDelivery: deliveryMins <= 20,
    };
  });
}
