import { NextRequest, NextResponse } from "next/server";
import { kv, NS } from "@/lib/kv";
import type { ConsentToken } from "../generate/route";

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token: string };

  if (!token || !/^[0-9a-f]{16}$/.test(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const db = kv();
  if (!db) {
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }

  const key = `${NS}consent:${token}`;
  const record = await db.get<ConsentToken>(key);

  if (!record) {
    return NextResponse.json(
      { error: "token not found or expired" },
      { status: 404 },
    );
  }
  if (record.used) {
    return NextResponse.json({ error: "token already used" }, { status: 410 });
  }
  if (Date.now() > record.expiresAt) {
    await db.del(key);
    return NextResponse.json({ error: "token expired" }, { status: 410 });
  }

  // Mark consumed
  await db.set(key, { ...record, used: true }, { ex: 60 });

  const ttlMs = record.expiresAt - Date.now();

  return NextResponse.json({
    valid: true,
    prefs: record.prefs,
    scope: record.scope,
    spendCap: record.spendCap,
    ttlMs,
  });
}
