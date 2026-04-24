import { NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { projectId } from "@/lib/browserbase";
import { appendStep, readJob, writeJob } from "@/lib/autoorder";
import { markPlatformLogin } from "@/lib/contexts";
import { presetFor } from "@/lib/platformPresets";

export const maxDuration = 60;

// POST /api/auto-order/run
// Body: { sessionId, dish, restaurant, platform, orderUrl }
// Resumes an existing Browserbase session and runs LLM-driven `act()` calls
// to add the dish to the user's cart. Streams progress to KV via appendStep.
// Returns immediately with the final state when done.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { sessionId, dish, restaurant } = body;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "bad sessionId" }, { status: 400 });
  }

  const job = await readJob(sessionId);
  if (!job) {
    return NextResponse.json({ error: "no job" }, { status: 404 });
  }

  const pid = projectId();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!pid || !anthropicKey) {
    await appendStep(
      sessionId,
      { kind: "error", msg: "agent not configured" },
      { status: "failed", finishedAt: new Date().toISOString() },
    );
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let stagehand: Stagehand | null = null;
  const finalize = async (
    status: "cart" | "manual" | "failed",
    msg: string,
    detail?: string,
  ) => {
    await appendStep(
      sessionId,
      {
        kind: status === "cart" ? "ok" : status === "manual" ? "warn" : "error",
        msg,
        detail,
      },
      { status, finishedAt: new Date().toISOString() },
    );
  };

  try {
    await appendStep(
      sessionId,
      { kind: "info", msg: "agent connected to remote browser" },
      { status: "navigating" },
    );

    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: pid,
      browserbaseSessionID: sessionId,
      model: {
        modelName: "anthropic/claude-haiku-4-5-20251001",
        apiKey: anthropicKey,
      },
      verbose: 0,
      disablePino: true,
      domSettleTimeout: 2000,
      actTimeoutMs: 20000,
      selfHeal: true,
    });
    await stagehand.init();

    const preset = presetFor(job.platform);
    await appendStep(sessionId, {
      kind: "info",
      msg: `using ${preset.label} preset`,
    });

    // Optional preflight — handles platform-specific first-touch friction
    // (Swiggy "Open in App" banner, Zomato login overlay) before the main loop.
    if (preset.preflight) {
      try {
        await stagehand.act(preset.preflight);
      } catch {}
    }

    // Step 1 — dismiss blocking modal
    await appendStep(
      sessionId,
      { kind: "act", msg: "scanning for blocking modals" },
      { status: "acting" },
    );
    try {
      await stagehand.act(preset.blockerDismiss);
    } catch (e) {
      await appendStep(sessionId, {
        kind: "warn",
        msg: "modal scan had no effect",
        detail: (e as Error).message?.slice(0, 200),
      });
    }

    // Step 2 — locate the dish (skip search if already visible)
    await appendStep(sessionId, {
      kind: "act",
      msg: `looking for "${dish}" on the menu`,
    });
    let foundOnPage = false;
    try {
      const present = await stagehand.extract(
        `is the dish "${dish}" visible anywhere on this page?`,
        z.object({
          present: z.boolean(),
          notes: z.string().optional(),
        }),
      );
      foundOnPage = !!present?.present;
    } catch {}

    if (!foundOnPage) {
      try {
        await stagehand.act(preset.search(dish));
      } catch (e) {
        await appendStep(sessionId, {
          kind: "warn",
          msg: "couldn't open menu search",
          detail: (e as Error).message?.slice(0, 200),
        });
      }
    }

    // Step 3 — click "Add" with platform-specific button hints
    await appendStep(sessionId, {
      kind: "act",
      msg: `clicking Add on the ${dish} item`,
    });
    let addClicked = false;
    try {
      await stagehand.act(preset.addItem(dish));
      addClicked = true;
    } catch (e) {
      await appendStep(sessionId, {
        kind: "warn",
        msg: "Add button click failed",
        detail: (e as Error).message?.slice(0, 200),
      });
    }

    // Step 4 — handle customization with platform-specific cues
    if (addClicked) {
      try {
        await stagehand.act(preset.customization);
      } catch {}
    }

    // Step 5 — verify cart with platform-specific cart-finder hints
    await appendStep(sessionId, {
      kind: "extract",
      msg: "checking cart status",
    });
    let inCart = false;
    let cartTotal: string | undefined;
    try {
      const verify = await stagehand.extract(
        preset.verifyCart(dish, restaurant),
        z.object({
          inCart: z.boolean(),
          itemName: z.string().optional(),
          total: z.string().optional(),
          notes: z.string().optional(),
        }),
      );
      inCart = !!verify?.inCart;
      cartTotal = verify?.total;
    } catch {}

    if (inCart) {
      await finalize(
        "cart",
        cartTotal
          ? `${dish} added · cart ${cartTotal}`
          : `${dish} added to cart`,
      );
      // Reaching cart implies the user already crossed login on this platform
      // (Swiggy/Zomato can't add to cart without auth). Mark it so the next
      // run shows "session restored" instead of "first run."
      if (job.userId && job.platform) {
        try {
          await markPlatformLogin(job.userId, job.platform);
        } catch {}
      }
    } else {
      await finalize(
        "manual",
        "agent placed you on the page · finish from the live view",
        "couldn't confirm cart state automatically — common on Swiggy when login is required first",
      );
    }
  } catch (e) {
    await finalize(
      "failed",
      "agent hit an error",
      (e as Error).message?.slice(0, 300),
    );
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {}
    }
  }

  // Always release the Browserbase session at the end since the user has the
  // live view open and can drive on their own from here. Actually NO — we want
  // the user to keep interacting via the live URL. The frontend modal calls
  // /api/auto-order/close when the user closes the modal.
  const finalJob = await readJob(sessionId);
  return NextResponse.json({ ok: true, job: finalJob });
}

// keep this so the file doesn't get tree-shaken — writeJob isn't used directly
// after refactor but is available if we want to short-circuit
void writeJob;
