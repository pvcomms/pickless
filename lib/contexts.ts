import { Redis } from "@upstash/redis";
import { bb, projectId } from "@/lib/browserbase";

// Per-user persistent Browserbase context. Cookies + localStorage from one
// auto-order session survive into the next, so the user logs into Swiggy /
// Zomato / etc. ONCE and the agent reuses that login forever after.

export type ContextRecord = {
  id: string; // Browserbase context id
  createdAt: string;
  lastUsedAt?: string;
  knownLogins: string[]; // platform ids ("swiggy", "zomato", "swish") confirmed cart-success
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

export const ctxKey = (picklessUserId: string) =>
  `pickless:user:${picklessUserId}:bbContext`;

export async function getContextRecord(
  picklessUserId: string,
): Promise<ContextRecord | null> {
  const k = kv();
  if (!k) return null;
  return await k.get<ContextRecord>(ctxKey(picklessUserId));
}

export async function getOrCreateContext(
  picklessUserId: string,
): Promise<ContextRecord> {
  const k = kv();
  if (!k) throw new Error("kv not configured");
  const existing = await k.get<ContextRecord>(ctxKey(picklessUserId));
  if (existing?.id) return existing;

  const client = bb();
  const pid = projectId();
  if (!client || !pid) throw new Error("browserbase not configured");
  const created = await client.contexts.create({ projectId: pid });
  const record: ContextRecord = {
    id: created.id,
    createdAt: new Date().toISOString(),
    knownLogins: [],
  };
  await k.set(ctxKey(picklessUserId), record);
  return record;
}

export async function touchContext(picklessUserId: string): Promise<void> {
  const k = kv();
  if (!k) return;
  const cur = await k.get<ContextRecord>(ctxKey(picklessUserId));
  if (!cur) return;
  await k.set(ctxKey(picklessUserId), {
    ...cur,
    lastUsedAt: new Date().toISOString(),
  });
}

export async function markPlatformLogin(
  picklessUserId: string,
  platform: string,
): Promise<void> {
  const k = kv();
  if (!k || !platform) return;
  const cur = await k.get<ContextRecord>(ctxKey(picklessUserId));
  if (!cur) return;
  if (cur.knownLogins.includes(platform)) return;
  await k.set(ctxKey(picklessUserId), {
    ...cur,
    knownLogins: [...cur.knownLogins, platform].slice(0, 12),
    lastUsedAt: new Date().toISOString(),
  });
}

export async function clearContext(picklessUserId: string): Promise<boolean> {
  const k = kv();
  const client = bb();
  if (!k) return false;
  const cur = await k.get<ContextRecord>(ctxKey(picklessUserId));
  if (cur?.id && client) {
    try {
      await client.contexts.delete(cur.id);
    } catch {}
  }
  await k.del(ctxKey(picklessUserId));
  return true;
}
