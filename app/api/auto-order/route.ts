import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";
import { bb, projectId } from "@/lib/browserbase";

export const maxDuration = 60;

// POST /api/auto-order
// body: { userId, dish, restaurant, platform, orderUrl }
// Creates a Browserbase session, navigates to orderUrl, returns live/replay URLs
// so the client can show the remote browser inline.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const { orderUrl, dish, restaurant } = body || {};
  if (!orderUrl || typeof orderUrl !== "string") {
    return NextResponse.json({ error: "missing orderUrl" }, { status: 400 });
  }

  const client = bb();
  const pid = projectId();
  if (!client || !pid) {
    return NextResponse.json(
      { error: "browserbase not configured" },
      { status: 503 },
    );
  }

  let sessionId = "";
  try {
    const session = await client.sessions.create({
      projectId: pid,
      // Keep alive for 5 min; modal will POST /close to kill early
      keepAlive: false,
      browserSettings: {
        blockAds: true,
        viewport: { width: 1280, height: 800 },
      },
    });
    sessionId = session.id;

    // Kick off navigation in the background so the POST can return immediately
    // with the live URL — the client shows the iframe while the agent lands.
    void (async () => {
      try {
        const browser = await chromium.connectOverCDP(session.connectUrl);
        const ctx = browser.contexts()[0] || (await browser.newContext());
        const page = ctx.pages()[0] || (await ctx.newPage());
        await page.goto(orderUrl, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        // Small post-nav settle for late JS paints
        await page.waitForTimeout(2500);
        // Leave the browser connected. Session closes on its own or via /close.
      } catch (err) {
        console.error("[auto-order] nav failed", sessionId, err);
      }
    })();

    const debug = await client.sessions.debug(sessionId);
    return NextResponse.json({
      ok: true,
      sessionId,
      liveUrl: debug.debuggerFullscreenUrl,
      replayUrl: `https://www.browserbase.com/sessions/${sessionId}`,
      dish,
      restaurant,
      orderUrl,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "browserbase session failed",
        detail: (e as Error).message,
        sessionId,
      },
      { status: 502 },
    );
  }
}
