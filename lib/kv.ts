import { Redis } from "@upstash/redis";

let _client: Redis | null = null;

export function kv(): Redis | null {
  if (_client) return _client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _client = new Redis({ url, token });
  return _client;
}

export const NS = "pickless:";
export function userKey(id: string) {
  return `${NS}user:${id}`;
}
