import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { readJob, writeJob, appendStep } from "@/lib/autoorder";

const TERMINAL = new Set([
  "cart",
  "partial",
  "manual",
  "disconnected",
  "failed",
]);

function verifySignature(body: string, header: string | null): boolean {
  const secret = process.env.BROWSERBASE_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification if secret not configured
  if (!header) return false;
  const sig = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

// POST /api/auto-order/webhook
// Browserbase fires this when a session ends or gets released.
// Patches the KV job to a terminal status so the modal stops polling.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-bb-signature");
  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const event: string = payload?.event ?? "";
  const sessionId: string = payload?.session?.id ?? payload?.sessionId ?? "";
  if (!sessionId) return NextResponse.json({ ok: true }); // nothing to update

  const job = await readJob(sessionId);
  if (!job || TERMINAL.has(job.status)) {
    return NextResponse.json({ ok: true }); // already settled
  }

  if (event === "session.ended" || event === "session.updated") {
    const bbStatus: string = payload?.session?.status ?? "";
    // Only act on terminal BB statuses — ignore intermediate updates
    if (
      event === "session.updated" &&
      !["COMPLETED", "ERROR", "TIMED_OUT"].includes(bbStatus)
    ) {
      return NextResponse.json({ ok: true });
    }
    const isTimed = bbStatus === "TIMED_OUT";
    await appendStep(
      sessionId,
      {
        kind: "warn",
        msg: isTimed ? "Session timed out" : "Session ended by Browserbase",
      },
      { status: "disconnected", finishedAt: new Date().toISOString() },
    );
  } else if (event === "session.failed") {
    await appendStep(
      sessionId,
      { kind: "error", msg: "Browserbase session failed" },
      { status: "failed", finishedAt: new Date().toISOString() },
    );
  }

  return NextResponse.json({ ok: true });
}
