// Client + server side context the agent uses to personalise.
// Device shape, time of day, day of week, weather, and a "warmth" string
// (returning user, time-since-last-visit) all fed into Gemini.

export type DeviceContext = {
  kind: "phone" | "tablet" | "desktop";
  os: string;
  installed: boolean; // true if launched as installed PWA
  width: number;
};

export type TimeContext = {
  iso: string;
  timeOfDay:
    | "early-morning"
    | "breakfast"
    | "brunch"
    | "lunch"
    | "snack"
    | "dinner"
    | "late-night";
  dayOfWeek: string;
  isWeekend: boolean;
  hourLocal: number;
};

export type WeatherContext = {
  tempC: number;
  feelsLikeC: number;
  condition: string; // "rain" | "clear" | "clouds" | "thunder" | "snow"
  windKph: number;
  precipitationMm: number;
};

export type FullContext = {
  device: DeviceContext;
  time: TimeContext;
  weather?: WeatherContext;
  warmth: string; // human phrase about the visit
};

export function detectDevice(): DeviceContext {
  if (typeof window === "undefined")
    return { kind: "desktop", os: "", installed: false, width: 0 };
  const ua = navigator.userAgent.toLowerCase();
  const w = window.innerWidth;
  const installed = window.matchMedia("(display-mode: standalone)").matches;
  let kind: DeviceContext["kind"] = "desktop";
  let os = "macos";
  if (/iphone|ipod/.test(ua)) {
    kind = "phone";
    os = "ios";
  } else if (/ipad/.test(ua)) {
    kind = "tablet";
    os = "ipados";
  } else if (/android/.test(ua)) {
    kind = w < 720 ? "phone" : "tablet";
    os = "android";
  } else if (/windows/.test(ua)) os = "windows";
  else if (/linux/.test(ua)) os = "linux";
  return { kind, os, installed, width: w };
}

export function detectTime(): TimeContext {
  const d = new Date();
  const h = d.getHours();
  const tod: TimeContext["timeOfDay"] =
    h < 6
      ? "late-night"
      : h < 9
        ? "early-morning"
        : h < 11
          ? "breakfast"
          : h < 12
            ? "brunch"
            : h < 15
              ? "lunch"
              : h < 17
                ? "snack"
                : h < 22
                  ? "dinner"
                  : "late-night";
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dow = days[d.getDay()];
  return {
    iso: d.toISOString(),
    timeOfDay: tod,
    dayOfWeek: dow,
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    hourLocal: h,
  };
}

export function computeWarmth(): string {
  if (typeof window === "undefined") return "first visit";
  const last = localStorage.getItem("pickless_last_visit");
  const now = Date.now();
  localStorage.setItem("pickless_last_visit", String(now));
  if (!last) return "first visit ever";
  const ms = now - Number(last);
  const min = ms / 60000;
  const hr = min / 60;
  const day = hr / 24;
  if (min < 5) return "still warm — hit feed me again";
  if (hr < 1) return `back ${Math.round(min)}min later`;
  if (hr < 24) return `back ${Math.round(hr)}h later`;
  if (day < 7) return `back ${Math.round(day)}d later`;
  if (day < 30) return `back after ${Math.round(day)} days`;
  return `back after ${Math.round(day / 30)} months — long time`;
}

export async function fetchWeather(
  lat: number,
  lng: number,
): Promise<WeatherContext | null> {
  try {
    const r = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
