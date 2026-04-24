import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng)
    return NextResponse.json({ error: "missing coords" }, { status: 400 });
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "pickless/1.0 (https://pickless.ai)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok)
    return NextResponse.json({ error: "geocode failed" }, { status: 502 });
  const data = await res.json();
  const a = data.address || {};
  return NextResponse.json({
    lat: Number(lat),
    lng: Number(lng),
    city: a.city || a.town || a.village || a.county || "Unknown",
    neighborhood:
      a.suburb || a.neighbourhood || a.city_district || a.quarter || "",
    country: a.country || "",
    countryCode: (a.country_code || "").toUpperCase(),
  });
}
