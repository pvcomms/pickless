import { NextRequest, NextResponse } from "next/server";
import { readJob } from "@/lib/autoorder";

// GET /api/auto-order/status?sessionId=...
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
  }
  const job = await readJob(sessionId);
  if (!job) return NextResponse.json({ job: null });
  return NextResponse.json({ job });
}
