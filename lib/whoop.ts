import { Redis } from "@upstash/redis";

// Per-user Whoop integration. Each Pickless anonymous user can connect their
// own Whoop account; tokens live at `pickless:user:{id}:whoop`.

export type WhoopTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
};

let _client: Redis | null = null;
function client(): Redis | null {
  if (_client) return _client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _client = new Redis({ url, token });
  return _client;
}

export const tokenKey = (picklessUserId: string) =>
  `pickless:user:${picklessUserId}:whoop`;
export const snapKey = (picklessUserId: string) =>
  `pickless:user:${picklessUserId}:whoop:snap`;
export const stateKey = (state: string) => `pickless:whoop:state:${state}`;

export const WHOOP_SCOPES = [
  "read:recovery",
  "read:sleep",
  "read:cycles",
  "offline",
].join(" ");

async function refresh(tokens: WhoopTokens): Promise<WhoopTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: "offline",
  });
  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`whoop_refresh_${res.status}`);
  const d = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresAt: Date.now() + (d.expires_in - 60) * 1000,
    scope: d.scope,
  };
}

export async function getAccessToken(
  picklessUserId: string,
): Promise<string | null> {
  const k = client();
  if (!k) return null;
  const tokens = await k.get<WhoopTokens>(tokenKey(picklessUserId));
  if (!tokens) return null;
  if (tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;
  try {
    const next = await refresh(tokens);
    await k.set(tokenKey(picklessUserId), next);
    return next.accessToken;
  } catch {
    return null;
  }
}

export async function setTokens(picklessUserId: string, tokens: WhoopTokens) {
  const k = client();
  if (!k) return;
  await k.set(tokenKey(picklessUserId), tokens);
}

export async function clearTokens(picklessUserId: string) {
  const k = client();
  if (!k) return;
  await k.del(tokenKey(picklessUserId));
  await k.del(snapKey(picklessUserId));
}

export async function isConnected(picklessUserId: string): Promise<boolean> {
  const k = client();
  if (!k) return false;
  const tokens = await k.get(tokenKey(picklessUserId));
  return !!tokens;
}

export type WhoopSnapshot = {
  recoveryScore: number | null; // 0-100
  hrv: number | null;
  rhr: number | null;
  sleepPerformance: number | null; // 0-100
  strain: number | null; // 0-21
  source: "live" | "cache" | "none";
  fetchedAt: string;
};

const SNAP_TTL = 15 * 60;

export async function fetchLatestSnapshot(
  picklessUserId: string,
): Promise<WhoopSnapshot> {
  const k = client();
  if (k) {
    const cached = await k.get<WhoopSnapshot>(snapKey(picklessUserId));
    if (
      cached &&
      Date.now() - new Date(cached.fetchedAt).getTime() < SNAP_TTL * 1000
    ) {
      return { ...cached, source: "cache" };
    }
  }

  const token = await getAccessToken(picklessUserId);
  if (!token) {
    return {
      recoveryScore: null,
      hrv: null,
      rhr: null,
      sleepPerformance: null,
      strain: null,
      source: "none",
      fetchedAt: new Date().toISOString(),
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - 36 * 3600 * 1000);
  const qs = `?start=${start.toISOString()}&end=${end.toISOString()}&limit=5`;

  const [recRes, sleepRes, cycRes] = await Promise.allSettled([
    fetch(`https://api.prod.whoop.com/developer/v1/recovery${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(`https://api.prod.whoop.com/developer/v1/activity/sleep${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => (r.ok ? r.json() : null)),
    fetch(`https://api.prod.whoop.com/developer/v1/cycle${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => (r.ok ? r.json() : null)),
  ]);

  const latestRec =
    (recRes.status === "fulfilled" && recRes.value?.records?.[0]?.score) || {};
  const latestSleep =
    (sleepRes.status === "fulfilled" && sleepRes.value?.records?.[0]?.score) ||
    {};
  const latestCyc =
    (cycRes.status === "fulfilled" && cycRes.value?.records?.[0]?.score) || {};

  const snap: WhoopSnapshot = {
    recoveryScore:
      typeof latestRec.recovery_score === "number"
        ? latestRec.recovery_score
        : null,
    hrv:
      typeof latestRec.hrv_rmssd_milli === "number"
        ? latestRec.hrv_rmssd_milli
        : null,
    rhr:
      typeof latestRec.resting_heart_rate === "number"
        ? latestRec.resting_heart_rate
        : null,
    sleepPerformance:
      typeof latestSleep.sleep_performance_percentage === "number"
        ? latestSleep.sleep_performance_percentage
        : null,
    strain: typeof latestCyc.strain === "number" ? latestCyc.strain : null,
    source: "live",
    fetchedAt: new Date().toISOString(),
  };

  if (k) {
    try {
      await k.set(snapKey(picklessUserId), snap, { ex: SNAP_TTL });
    } catch {}
  }
  return snap;
}

export type RecoveryBand = "red" | "yellow" | "green" | "unknown";

export function bandFor(score: number | null): RecoveryBand {
  if (score == null) return "unknown";
  if (score < 34) return "red";
  if (score < 67) return "yellow";
  return "green";
}

// Plain-English bias hint Gemini can read directly.
export function biasHint(snap: WhoopSnapshot): string {
  const band = bandFor(snap.recoveryScore);
  const sleep = snap.sleepPerformance;
  const sleepBad = typeof sleep === "number" && sleep < 70;
  if (band === "red") {
    return "user is in RED RECOVERY today (recovery <34%). Body needs comfort + protein + iron + warm + hydration. Lean COMFORT FOOD, hearty, protein-forward, warming spice, easy-to-digest carbs. Avoid alcohol-pairing, ultra-spicy, raw/cold. The agent should feel like a parent feeding a sick kid.";
  }
  if (band === "yellow") {
    return `user is in YELLOW RECOVERY (recovery 34-66%). Steady-state day. Balanced — moderate protein, real carbs, no extreme spice or heaviness.${sleepBad ? " Slept badly too — push toward easy comfort, not adventure." : ""}`;
  }
  if (band === "green") {
    return "user is in GREEN RECOVERY today (recovery 67%+). Body's primed. They can handle bold spice, novelty, adventure. Push them toward something they wouldn't normally pick — this is the day for it.";
  }
  return "";
}

export function bandLabel(b: RecoveryBand): string {
  return (
    {
      red: "comfort mode",
      yellow: "steady",
      green: "adventure",
      unknown: "",
    }[b] || ""
  );
}
