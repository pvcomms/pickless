import { NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { projectId } from "@/lib/browserbase";
import { appendStep, patchItem, readJob } from "@/lib/autoorder";
import { markPlatformLogin } from "@/lib/contexts";
import { presetFor } from "@/lib/platformPresets";

export const maxDuration = 60;

// POST /api/auto-order/run
// Body: { sessionId }
// Resumes the Browserbase session and loops job.items, adding each to cart in
// turn. Streams progress to KV via appendStep. Final status:
//   - "cart"    → all items confirmed in cart
//   - "partial" → some items in cart, others not (multi only)
//   - "manual"  → 0 items confirmed (user takes over from live view)
//   - "failed"  → exception
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { sessionId } = body;
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
    status: "cart" | "partial" | "manual" | "failed",
    msg: string,
    detail?: string,
  ) => {
    await appendStep(
      sessionId,
      {
        kind:
          status === "cart"
            ? "ok"
            : status === "partial"
              ? "warn"
              : status === "manual"
                ? "warn"
                : "error",
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
    const items = job.items;
    await appendStep(sessionId, {
      kind: "info",
      msg:
        items.length > 1
          ? `using ${preset.label} preset · ${items.length} items`
          : `using ${preset.label} preset`,
    });

    // Run the platform preflight ONCE per session (e.g. dismiss "Open in App",
    // accept location). After that we trust the same context.
    if (preset.preflight) {
      try {
        await stagehand.act(preset.preflight);
      } catch {}
    }

    // If the user has a saved delivery address, try to fill it into any address
    // prompt before we hit the menu. This is the #1 manual-takeover trigger.
    if (preset.addressAct && job.savedAddress) {
      await appendStep(sessionId, {
        kind: "act",
        msg: `filling delivery address: ${job.savedAddress}`,
      });
      try {
        await stagehand.act(preset.addressAct(job.savedAddress));
      } catch {}
    }

    // First scan-for-blockers — also one-shot per session.
    await appendStep(
      sessionId,
      { kind: "act", msg: "scanning for blocking modals" },
      { status: "acting" },
    );
    try {
      await stagehand.act(preset.blockerDismiss);
    } catch {}

    let cartTotal: string | undefined;
    let prevOrderUrl = "";

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const tag = items.length > 1 ? `[${i + 1}/${items.length}] ` : "";

      // Navigate if this item lives at a different URL than the prev (or
      // first iteration with empty prev URL).
      if (item.orderUrl !== prevOrderUrl) {
        await appendStep(sessionId, {
          kind: "info",
          msg: `${tag}opening ${item.restaurant}`,
        });
        try {
          const ctx = stagehand.context;
          const page = ctx.pages()[0] || (await ctx.newPage());
          await page.goto(item.orderUrl, {
            waitUntil: "domcontentloaded",
            timeoutMs: 30000,
          });
          // Re-dismiss blockers after a fresh nav (some platforms re-show
          // location prompts per restaurant).
          try {
            await stagehand.act(preset.blockerDismiss);
          } catch {}
        } catch (e) {
          await appendStep(sessionId, {
            kind: "warn",
            msg: `${tag}navigation hiccup`,
            detail: (e as Error).message?.slice(0, 200),
          });
        }
        prevOrderUrl = item.orderUrl;
      }

      // Locate the dish (skip search if already visible)
      await appendStep(sessionId, {
        kind: "act",
        msg: `${tag}looking for "${item.dish}"`,
      });
      let foundOnPage = false;
      try {
        const present = await stagehand.extract(
          `is the dish "${item.dish}" visible anywhere on this page?`,
          z.object({
            present: z.boolean(),
            notes: z.string().optional(),
          }),
        );
        foundOnPage = !!present?.present;
      } catch {}

      if (!foundOnPage) {
        try {
          await stagehand.act(preset.search(item.dish));
        } catch {}
      }

      // Click "Add" — observe→diagnose→re-act on failure, max 2 retries
      let addClicked = false;
      let addError: Error | null = null;
      let addInstruction = preset.addItem(item.dish);

      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          await stagehand.act(addInstruction);
          addClicked = true;
          break;
        } catch (e) {
          addError = e as Error;
          if (attempt >= 2) break;

          await appendStep(sessionId, {
            kind: "info",
            msg: `${tag}Add failed · observing page for retry ${attempt + 1}`,
          });

          try {
            const diagnosis = await stagehand.extract(
              `The action to add "${item.dish}" to cart just failed. Look at the current page and answer: ` +
                `1) Is the dish card for "${item.dish}" visible anywhere? ` +
                `2) Is any modal, overlay, or popup blocking the menu right now? ` +
                `3) What is the exact text or label on the button that adds it to cart? ` +
                `4) Write a single concrete action instruction that will add "${item.dish}" to the cart based strictly on what you can see right now.`,
              z.object({
                dishVisible: z.boolean(),
                blockerPresent: z.boolean(),
                blockerDescription: z.string().optional(),
                addButtonLabel: z.string().optional(),
                actionInstruction: z.string(),
              }),
            );
            if (diagnosis?.blockerPresent) {
              try {
                await stagehand.act(preset.blockerDismiss);
              } catch {}
            }
            if (diagnosis?.actionInstruction) {
              addInstruction = diagnosis.actionInstruction;
            }
          } catch {}
        }
      }

      if (!addClicked) {
        await appendStep(sessionId, {
          kind: "warn",
          msg: `${tag}Add failed for "${item.dish}" after 3 attempts`,
          detail: addError?.message?.slice(0, 200),
        });
      }

      // Customization
      if (addClicked) {
        try {
          await stagehand.act(preset.customization);
        } catch {}
      }

      // Verify per-item
      let inCart = false;
      try {
        const verify = await stagehand.extract(
          preset.verifyCart(item.dish, item.restaurant),
          z.object({
            inCart: z.boolean(),
            itemName: z.string().optional(),
            total: z.string().optional(),
            notes: z.string().optional(),
          }),
        );
        inCart = !!verify?.inCart;
        if (verify?.total) cartTotal = verify.total;
      } catch {}

      await patchItem(sessionId, i, {
        inCart,
        reason: addClicked ? undefined : "add failed",
      });
      await appendStep(sessionId, {
        kind: inCart ? "ok" : "warn",
        msg: inCart
          ? `${tag}${item.dish} → in cart`
          : `${tag}${item.dish} → not confirmed`,
      });
    }

    // Final outcome based on per-item results
    const inCartCount = items.filter((it, i) => {
      // Re-read latest item state from DB-ish (in-memory items already updated
      // via patchItem, but our local `items` reference was captured before;
      // pull fresh).
      void it;
      return false;
    }).length;
    const fresh = await readJob(sessionId);
    const succeeded = (fresh?.items || []).filter((it) => it.inCart).length;
    const total = items.length;

    if (succeeded === total) {
      await finalize(
        "cart",
        cartTotal
          ? `${total === 1 ? items[0].dish + " added" : `all ${total} items added`} · cart ${cartTotal}`
          : total === 1
            ? `${items[0].dish} added to cart`
            : `all ${total} items added to cart`,
      );
      if (job.userId && job.platform) {
        try {
          await markPlatformLogin(job.userId, job.platform);
        } catch {}
      }
    } else if (succeeded > 0) {
      await finalize(
        "partial",
        `${succeeded} of ${total} items in cart · finish the rest in the live view`,
        cartTotal ? `current cart: ${cartTotal}` : undefined,
      );
      if (job.userId && job.platform) {
        try {
          await markPlatformLogin(job.userId, job.platform);
        } catch {}
      }
    } else {
      await finalize(
        "manual",
        "agent placed you on the page · finish from the live view",
        "couldn't confirm any item in cart — usually login required first",
      );
    }

    // touch unused for lint
    void inCartCount;
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

  const finalJob = await readJob(sessionId);
  return NextResponse.json({ ok: true, job: finalJob });
}
