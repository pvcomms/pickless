import { NextRequest, NextResponse } from "next/server";
import { clearTokens } from "@/lib/whoop";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const u = String(body?.userId || "").trim();
  if (!u || !/^[a-z0-9]{4,32}$/i.test(u)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  await clearTokens(u);
  return NextResponse.json({ ok: true });
}
