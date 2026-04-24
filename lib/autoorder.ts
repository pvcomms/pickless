import { Redis } from "@upstash/redis";

export type StepKind = "info" | "act" | "extract" | "warn" | "error" | "ok";

export type Step = {
  at: string; // iso
  kind: StepKind;
  msg: string;
  detail?: string;
};

export type AutoOrderJobStatus =
  | "starting" // session creating + first navigation
  | "navigating" // resumed, going to URL
  | "acting" // running stagehand acts
  | "cart" // at least one item added to cart
  | "partial" // some items added, others failed (multi-item only)
  | "manual" // agent stopped, user must finish (login, payment, customization)
  | "failed";

export type DishItem = {
  dish: string;
  restaurant: string;
  restaurantId?: string;
  orderUrl: string;
  price?: string;
  // Set during agent loop:
  inCart?: boolean;
  reason?: string;
};

export type AutoOrderJob = {
  sessionId: string;
  userId?: string;
  // Convenience aliases for items[0] — kept for back-compat with existing UI.
  dish: string;
  restaurant: string;
  platform: string;
  orderUrl: string;
  // Full ordered list of items the agent will try to add. items[0] mirrors
  // dish/restaurant/orderUrl above.
  items: DishItem[];
  status: AutoOrderJobStatus;
  steps: Step[];
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  error?: string;
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

export const jobKey = (sessionId: string) => `pickless:autoorder:${sessionId}`;

const TTL = 60 * 60; // 1h

export async function readJob(sessionId: string): Promise<AutoOrderJob | null> {
  const k = client();
  if (!k) return null;
  return await k.get<AutoOrderJob>(jobKey(sessionId));
}

export async function writeJob(job: AutoOrderJob): Promise<void> {
  const k = client();
  if (!k) return;
  await k.set(jobKey(job.sessionId), job, { ex: TTL });
}

export async function appendStep(
  sessionId: string,
  step: Omit<Step, "at">,
  patch?: Partial<
    Pick<AutoOrderJob, "status" | "error" | "finishedAt" | "items">
  >,
): Promise<AutoOrderJob | null> {
  const cur = await readJob(sessionId);
  if (!cur) return null;
  const next: AutoOrderJob = {
    ...cur,
    steps: [...cur.steps, { ...step, at: new Date().toISOString() }].slice(-50),
    updatedAt: new Date().toISOString(),
    ...(patch || {}),
  };
  await writeJob(next);
  return next;
}

export async function patchItem(
  sessionId: string,
  index: number,
  patch: Partial<DishItem>,
): Promise<void> {
  const cur = await readJob(sessionId);
  if (!cur) return;
  const items = cur.items.map((it, i) =>
    i === index ? { ...it, ...patch } : it,
  );
  await writeJob({ ...cur, items, updatedAt: new Date().toISOString() });
}
