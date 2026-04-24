import { NextRequest, NextResponse } from "next/server";
import {
  fetchLatestSnapshot,
  bandFor,
  bandLabel,
  biasHint,
  isConnected,
} from "@/lib/whoop";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u")?.trim();
  if (!u || !/^[a-z0-9]{4,32}$/i.test(u)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const connected = await isConnected(u);
  if (!connected) {
    return NextResponse.json({ connected: false, snapshot: null });
  }
  try {
    const snap = await fetchLatestSnapshot(u);
    const band = bandFor(snap.recoveryScore);
    return NextResponse.json({
      connected: true,
      snapshot: snap,
      band,
      bandLabel: bandLabel(band),
      biasHint: biasHint(snap),
    });
  } catch (e) {
    return NextResponse.json(
      { connected: true, snapshot: null, error: (e as Error).message },
      { status: 502 },
    );
  }
}
