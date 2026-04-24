import { Redis } from "@upstash/redis";

// Cart-success metrics per platform. Stored in a KV hash so reads are O(1) and
// writes are atomic. Used by /admin/metrics to show real-time success rates.

export type Outcome = "cart" | "partial" | "manual" | "failed" | "disconnected";

export type PlatformMetrics = {
  platform: string;
  total: number;
  cart: number;
  partial: number;
  manual: number;
  failed: number;
  disconnected: number;
  lastOutcomeAt?: string;
  cartSuccessRate?: number; // (cart + partial) / total
  fullCartRate?: number; // cart / total
};

let _kv: Redis | null = null;
function kv(): Redis | null {
  if (_kv) return _kv;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _kv = new Redis({ url, token });
  return _kv;
}

const KEY = "pickless:metrics:autoorder";
const PLATFORMS_KEY = "pickless:metrics:autoorder:platforms";

const fieldFor = (platform: string, outcome: Outcome | "total" | "lastAt") =>
  `${platform}:${outcome}`;

export async function recordOutcome(
  platform: string,
  outcome: Outcome,
): Promise<void> {
  const k = kv();
  if (!k || !platform) return;
  try {
    await Promise.all([
      k.hincrby(KEY, fieldFor(platform, outcome), 1),
      k.hincrby(KEY, fieldFor(platform, "total"), 1),
      k.hset(KEY, {
        [fieldFor(platform, "lastAt")]: new Date().toISOString(),
      }),
      k.sadd(PLATFORMS_KEY, platform),
    ]);
  } catch {}
}

export async function readMetrics(): Promise<PlatformMetrics[]> {
  const k = kv();
  if (!k) return [];
  try {
    const platforms = await k.smembers(PLATFORMS_KEY);
    if (!platforms || platforms.length === 0) return [];
    const hash = await k.hgetall<Record<string, string | number>>(KEY);
    if (!hash) return [];
    const out: PlatformMetrics[] = [];
    for (const platform of platforms) {
      const get = (o: Outcome | "total" | "lastAt") => {
        const v = hash[fieldFor(platform, o)];
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };
      const total = get("total");
      const cart = get("cart");
      const partial = get("partial");
      const manual = get("manual");
      const failed = get("failed");
      const disconnected = get("disconnected");
      const lastAt = hash[fieldFor(platform, "lastAt")];
      out.push({
        platform,
        total,
        cart,
        partial,
        manual,
        failed,
        disconnected,
        lastOutcomeAt: typeof lastAt === "string" ? lastAt : undefined,
        cartSuccessRate: total > 0 ? (cart + partial) / total : undefined,
        fullCartRate: total > 0 ? cart / total : undefined,
      });
    }
    out.sort((a, b) => b.total - a.total);
    return out;
  } catch {
    return [];
  }
}
