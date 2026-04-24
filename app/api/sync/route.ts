import { NextRequest, NextResponse } from "next/server";
import { kv, userKey } from "@/lib/kv";

export type CloudSnapshot = {
  prefs?: any;
  loved?: any[];
  tasteProfile?: any;
  history?: any[];
  recentlyShown?: any[];
  updatedAt: string;
};

const TTL_DAYS = 365;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("u")?.trim();
  if (!id || !/^[a-z0-9]{4,32}$/i.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const k = kv();
  if (!k) return NextResponse.json({ snapshot: null, mode: "no-kv" });
  try {
    const snap = await k.get<CloudSnapshot>(userKey(id));
    return NextResponse.json({ snapshot: snap ?? null });
  } catch (e) {
    return NextResponse.json(
      { snapshot: null, error: (e as Error).message },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const id = String(body.userId || "").trim();
  if (!id || !/^[a-z0-9]{4,32}$/i.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const k = kv();
  if (!k) return NextResponse.json({ ok: false, mode: "no-kv" });
  const snap: CloudSnapshot = {
    prefs: body.prefs,
    loved: Array.isArray(body.loved) ? body.loved.slice(0, 50) : undefined,
    tasteProfile: body.tasteProfile,
    history: Array.isArray(body.history)
      ? body.history.slice(0, 50)
      : undefined,
    recentlyShown: Array.isArray(body.recentlyShown)
      ? body.recentlyShown.slice(0, 30)
      : undefined,
    updatedAt: new Date().toISOString(),
  };
  try {
    await k.set(userKey(id), snap, { ex: TTL_DAYS * 24 * 3600 });
    return NextResponse.json({ ok: true, updatedAt: snap.updatedAt });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
