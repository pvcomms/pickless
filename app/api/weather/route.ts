import { NextRequest, NextResponse } from "next/server";

// Free, no API key, no rate limits worth worrying about.
const URL_BASE = "https://api.open-meteo.com/v1/forecast";

function codeToCondition(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain-shower";
  if (code === 85 || code === 86) return "snow-shower";
  if (code >= 95 && code <= 99) return "thunder";
  return "unknown";
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng)
    return NextResponse.json({ error: "missing coords" }, { status: 400 });

  try {
    const url = `${URL_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation`;
    const r = await fetch(url, { next: { revalidate: 600 } });
    if (!r.ok)
      return NextResponse.json(
        { error: "weather fetch failed" },
        { status: 502 },
      );
    const d = await r.json();
    const cur = d.current || {};
    return NextResponse.json({
      tempC: Number(cur.temperature_2m ?? 0),
      feelsLikeC: Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
      condition: codeToCondition(Number(cur.weather_code ?? 0)),
      windKph: Number(cur.wind_speed_10m ?? 0),
      precipitationMm: Number(cur.precipitation ?? 0),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
