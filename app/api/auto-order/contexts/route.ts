import { NextRequest, NextResponse } from "next/server";
import { clearContext, getContextRecord } from "@/lib/contexts";

const validId = (s: string) => /^[a-z0-9]{4,32}$/i.test(s);

// GET /api/auto-order/contexts?u={userId}
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u")?.trim() || "";
  if (!validId(u)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const rec = await getContextRecord(u);
  if (!rec) {
    return NextResponse.json({
      exists: false,
      knownLogins: [],
    });
  }
  return NextResponse.json({
    exists: true,
    contextId: rec.id,
    createdAt: rec.createdAt,
    lastUsedAt: rec.lastUsedAt,
    knownLogins: rec.knownLogins,
  });
}

// POST /api/auto-order/contexts/clear  body: { userId }
// (Use POST instead of DELETE to avoid CORS preflight friction in fetch.)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const u = String(body?.userId || "").trim();
  if (!validId(u)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const action = String(body?.action || "clear");
  if (action !== "clear") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  await clearContext(u);
  return NextResponse.json({ ok: true });
}
