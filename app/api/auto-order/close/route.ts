import { NextRequest, NextResponse } from "next/server";
import { bb } from "@/lib/browserbase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = String(body?.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "bad sessionId" }, { status: 400 });
  }
  const client = bb();
  if (!client) return NextResponse.json({ ok: false, mode: "no-bb" });
  try {
    await client.sessions.update(sessionId, {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      status: "REQUEST_RELEASE",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 },
    );
  }
}
