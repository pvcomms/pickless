import { NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { bb, projectId } from "@/lib/browserbase";
import { writeJob, type AutoOrderJob } from "@/lib/autoorder";
import {
  getOrCreateContext,
  touchContext,
  type ContextRecord,
} from "@/lib/contexts";

export const maxDuration = 60;

// POST /api/auto-order
// body: { userId, dish, restaurant, platform, orderUrl }
// Creates a Browserbase session via Stagehand, navigates to orderUrl, then
// fires off /api/auto-order/run which uses LLM-driven `act()` calls to add
// the dish to cart. Client polls /api/auto-order/status for step updates.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { orderUrl, dish, restaurant, platform, userId } = body;
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

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "anthropic key missing — agent needs an LLM" },
      { status: 503 },
    );
  }

  // Look up (or create) this user's persistent Browserbase context. Cookies +
  // localStorage from previous sessions live here, so logins survive across
  // orders. First-run users get a fresh empty context.
  let contextRecord: ContextRecord | null = null;
  if (typeof userId === "string" && /^[a-z0-9]{4,32}$/i.test(userId)) {
    try {
      contextRecord = await getOrCreateContext(userId);
    } catch (e) {
      console.error("[auto-order] context lookup failed", e);
    }
  }
  const sessionHasLogin = !!(
    contextRecord &&
    typeof platform === "string" &&
    contextRecord.knownLogins.includes(platform)
  );

  let sessionId = "";
  let stagehand: Stagehand | null = null;
  try {
    // Stagehand handles session creation. keepAlive=true so the session
    // survives our SDK disconnect — /run reuses it. context.id + persist:true
    // means Browserbase mounts the user's saved cookie jar at session start
    // and writes it back when the session ends.
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: pid,
      keepAlive: true,
      browserbaseSessionCreateParams: {
        projectId: pid,
        keepAlive: true,
        browserSettings: {
          blockAds: true,
          viewport: { width: 1280, height: 800 },
          ...(contextRecord
            ? {
                context: {
                  id: contextRecord.id,
                  persist: true,
                },
              }
            : {}),
        },
      },
      model: {
        modelName: "anthropic/claude-haiku-4-5-20251001",
        apiKey: anthropicKey,
      },
      verbose: 0,
      disablePino: true,
      domSettleTimeout: 1500,
      selfHeal: true,
    });
    await stagehand.init();
    sessionId = stagehand.browserbaseSessionID || "";
    if (!sessionId) throw new Error("no session id");

    // Initial KV record so the modal has something to poll immediately.
    const job: AutoOrderJob = {
      sessionId,
      userId,
      dish,
      restaurant,
      platform,
      orderUrl,
      status: "starting",
      steps: [
        {
          at: new Date().toISOString(),
          kind: "info",
          msg: "spinning up remote browser",
        },
      ],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeJob(job);

    // Navigate to the restaurant page so the live view shows the right thing
    // immediately, even before the agent loop starts.
    const ctx = stagehand.context;
    const page = ctx.pages()[0] || (await ctx.newPage());
    try {
      await page.goto(orderUrl, {
        waitUntil: "domcontentloaded",
        timeoutMs: 30000,
      });
    } catch {}

    // Get live URL for the iframe
    const debug = await client.sessions.debug(sessionId);

    // Disconnect SDK but keep session alive (keepAlive=true).
    try {
      await stagehand.close();
    } catch {}

    // Fire-and-forget the agent loop. /run has its own maxDuration.
    const origin = req.nextUrl.origin;
    void fetch(`${origin}/api/auto-order/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, dish, restaurant, platform, orderUrl }),
    }).catch(() => {});

    if (contextRecord && userId) {
      // Best-effort touch — non-blocking
      void touchContext(userId).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      sessionId,
      liveUrl: debug.debuggerFullscreenUrl,
      replayUrl: `https://www.browserbase.com/sessions/${sessionId}`,
      dish,
      restaurant,
      orderUrl,
      context: contextRecord
        ? {
            firstRun: contextRecord.knownLogins.length === 0,
            sessionRestored: sessionHasLogin,
            knownLogins: contextRecord.knownLogins,
          }
        : null,
    });
  } catch (e) {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
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
