"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import type { AutoOrderJob, DishItem, Step } from "@/lib/autoorder";

type Props = {
  open: boolean;
  userId: string;
  // Either a single dish OR a list. Single is wrapped into a 1-item list.
  dish?: string;
  restaurant?: string;
  orderUrl?: string;
  items?: Array<
    Pick<
      DishItem,
      "dish" | "restaurant" | "orderUrl" | "restaurantId" | "price"
    >
  >;
  platform: string;
  onClose: () => void;
  onOrdered: () => void;
};

type Session = {
  sessionId: string;
  liveUrl: string;
  replayUrl: string;
  context: {
    firstRun: boolean;
    sessionRestored: boolean;
    knownLogins: string[];
  } | null;
};

const TERMINAL = new Set([
  "cart",
  "partial",
  "manual",
  "disconnected",
  "failed",
]);

function statusBlurb(s?: AutoOrderJob["status"]): string {
  switch (s) {
    case "starting":
      return "Spinning up a remote browser";
    case "navigating":
      return "Agent at the restaurant — connecting";
    case "acting":
      return "Agent is reading the menu";
    case "cart":
      return "All items in cart — take over to pay";
    case "partial":
      return "Some items in cart — finish the rest live";
    case "manual":
      return "Agent paused — finish in the live view";
    case "disconnected":
      return "Session ended";
    case "failed":
      return "Agent hit a wall";
    default:
      return "Spinning up a remote browser";
  }
}

function dotColor(kind: Step["kind"]) {
  switch (kind) {
    case "ok":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "error":
      return "bg-red-500";
    case "act":
      return "bg-[var(--seal)]";
    case "extract":
      return "bg-blue-500";
    default:
      return "bg-[var(--ink)]";
  }
}

export function AutoOrderModal({
  open,
  userId,
  dish,
  restaurant,
  platform,
  orderUrl,
  items,
  onClose,
  onOrdered,
}: Props) {
  // Normalize: prefer items[], else wrap single dish into 1-item list.
  const effectiveItems =
    items && items.length > 0
      ? items
      : dish && restaurant && orderUrl
        ? [{ dish, restaurant, orderUrl }]
        : [];
  const isMulti = effectiveItems.length > 1;
  const headerDish = effectiveItems[0]?.dish || dish || "";
  const headerRestaurant = effectiveItems[0]?.restaurant || restaurant || "";
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "live" | "error">(
    "idle",
  );
  const [err, setErr] = useState("");
  const [job, setJob] = useState<AutoOrderJob | null>(null);
  const stepsRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setSession(null);
    setJob(null);
    setErr("");
    setState("starting");
    void (async () => {
      try {
        const savedAddress = (() => {
          try {
            const raw = localStorage.getItem("pickless_saved_address");
            if (raw) return JSON.parse(raw) as string;
            const loc = localStorage.getItem("pickless_location");
            if (loc) {
              const l = JSON.parse(loc);
              const parts = [l.neighborhood, l.city].filter(Boolean);
              return parts.length ? parts.join(", ") : undefined;
            }
          } catch {}
          return undefined;
        })();
        const r = await fetch("/api/auto-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            platform,
            items: effectiveItems,
            ...(savedAddress ? { savedAddress } : {}),
          }),
        });
        const d = await r.json();
        if (!r.ok || !d?.liveUrl) {
          setErr(d?.error || d?.detail || "session failed");
          setState("error");
          return;
        }
        setSession({
          sessionId: d.sessionId,
          liveUrl: d.liveUrl,
          replayUrl: d.replayUrl,
          context: d.context ?? null,
        });
        setState("live");
        sfx.thunk();

        // Start polling for status
        pollRef.current = setInterval(async () => {
          try {
            const sr = await fetch(
              `/api/auto-order/status?sessionId=${d.sessionId}`,
              { cache: "no-store" },
            );
            const sd = await sr.json();
            if (sd?.job) {
              setJob(sd.job);
              if (TERMINAL.has(sd.job.status) && pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
                if (sd.job.status === "cart") {
                  sfx.bell();
                }
              }
            }
          } catch {}
        }, 1200);
      } catch (e) {
        setErr((e as Error).message);
        setState("error");
      }
    })();
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll the step list to the latest entry
  useEffect(() => {
    if (stepsRef.current) {
      stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
    }
  }, [job?.steps?.length]);

  async function close(finalize: boolean) {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (session?.sessionId) {
      try {
        await fetch("/api/auto-order/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId }),
        });
      } catch {}
    }
    if (finalize) onOrdered();
    onClose();
  }

  if (!open) return null;

  const headline =
    state === "error" ? "Agent hit a wall" : statusBlurb(job?.status);

  const cartDone = job?.status === "cart";
  const partialDone = job?.status === "partial";
  const anyDone = cartDone || partialDone;
  const jobItems = job?.items || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/80 backdrop-blur-sm px-4 sm:px-8"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-6xl h-[88vh] bg-[var(--bg)] border hairline rounded-sm overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b hairline shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${
                  cartDone
                    ? "bg-emerald-500"
                    : partialDone
                      ? "bg-amber-500"
                      : job?.status === "failed"
                        ? "bg-red-500"
                        : job?.status === "disconnected"
                          ? "bg-amber-500"
                          : job?.status === "manual"
                            ? "bg-amber-500"
                            : "bg-[var(--seal)] pulse-soft"
                }`}
              />
              {headline}
              {isMulti && (
                <span className="opacity-60">
                  · {effectiveItems.length}-item meal
                </span>
              )}
            </p>
            <p className="font-display text-lg tracking-tight truncate">
              {isMulti ? (
                <>
                  {effectiveItems
                    .map((it) => it.dish)
                    .slice(0, 3)
                    .join(" + ")}
                  {effectiveItems.length > 3 ? " +…" : ""}{" "}
                  <span className="faint">· {headerRestaurant}</span>
                </>
              ) : (
                <>
                  {headerDish} ·{" "}
                  <span className="faint">{headerRestaurant}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {state === "live" && (
              <button
                onClick={() => close(true)}
                className={`font-mono text-[10px] uppercase tracking-widest px-4 py-2 rounded-sm transition-colors ${
                  anyDone
                    ? "bg-[var(--seal)] text-white hover:opacity-90"
                    : "bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--seal)]"
                }`}
              >
                {anyDone ? "Mark ordered →" : "Mark ordered"}
              </button>
            )}
            <button
              onClick={() => close(false)}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 border hairline rounded-sm faint hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_320px] min-h-0">
          {/* Live view */}
          <div className="relative bg-[var(--paper)] min-h-0">
            {state === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
                <p className="font-mono text-[10px] uppercase tracking-widest faint">
                  leasing a remote chromium · {platform}
                </p>
              </div>
            )}
            {state === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="font-display text-2xl tracking-tight">
                  The agent couldn&apos;t reach {platform}.
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600 max-w-md break-all">
                  {err}
                </p>
                {effectiveItems[0]?.orderUrl && (
                  <a
                    href={effectiveItems[0].orderUrl}
                    target="_blank"
                    rel="noopener"
                    className="mt-4 font-mono text-[10px] uppercase tracking-widest px-4 py-2 border hairline rounded-sm faint hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
                  >
                    Open {platform} yourself →
                  </a>
                )}
              </div>
            )}
            {state === "live" && session && (
              <>
                {session.context && (
                  <div
                    className={`absolute top-0 left-0 right-0 z-10 px-4 py-2 flex items-center gap-2 text-left ${
                      session.context.sessionRestored
                        ? "bg-emerald-500/10 border-b border-emerald-500/30"
                        : "bg-amber-500/10 border-b border-amber-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                        session.context.sessionRestored
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <p className="font-mono text-[10px] uppercase tracking-widest leading-snug">
                      {session.context.sessionRestored ? (
                        <>
                          ✓ {platform} session restored ·{" "}
                          <span className="opacity-60">no login needed</span>
                        </>
                      ) : session.context.firstRun ? (
                        <>
                          First run ·{" "}
                          <span className="opacity-60">
                            log into {platform} once · agent remembers
                          </span>
                        </>
                      ) : (
                        <>
                          Saved profile ·{" "}
                          <span className="opacity-60">
                            you may need to log into {platform} this time
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}
                <iframe
                  src={session.liveUrl}
                  title="Pickless agent browser"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  allow="clipboard-read; clipboard-write"
                  className="w-full h-full border-0"
                />
              </>
            )}
          </div>

          {/* Step list */}
          <aside className="border-l hairline flex flex-col bg-[var(--bg)] min-h-0">
            {isMulti && jobItems.length > 0 && (
              <div className="px-4 py-3 border-b hairline shrink-0">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-2">
                  Meal · {jobItems.filter((it) => it.inCart).length}/
                  {jobItems.length} in cart
                </p>
                <div className="space-y-1.5">
                  {jobItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-left">
                      <span
                        className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                          it.inCart === true
                            ? "bg-emerald-500"
                            : it.inCart === false &&
                                job?.status &&
                                [
                                  "cart",
                                  "partial",
                                  "manual",
                                  "failed",
                                ].includes(job.status)
                              ? "bg-amber-500"
                              : "bg-[var(--ink)] opacity-30"
                        }`}
                      />
                      <span className="text-sm leading-tight truncate flex-1">
                        {it.dish}
                      </span>
                      {it.price && (
                        <span className="font-mono text-[9px] uppercase tracking-widest faint shrink-0">
                          {it.price}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="px-4 py-3 border-b hairline shrink-0">
              <p className="font-mono text-[10px] uppercase tracking-widest faint">
                Agent log
              </p>
            </div>
            <div
              ref={stepsRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
            >
              {!job?.steps?.length && (
                <p className="font-mono text-[10px] uppercase tracking-widest faint">
                  waiting for first action…
                </p>
              )}
              {job?.steps?.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 text-left">
                  <span
                    className={`w-1.5 h-1.5 rounded-full inline-block mt-1.5 shrink-0 ${dotColor(s.kind)}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{s.msg}</p>
                    {s.detail && (
                      <p className="font-mono text-[9px] uppercase tracking-widest faint mt-0.5 break-all">
                        {s.detail.slice(0, 200)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {cartDone && (
              <div className="px-4 py-3 border-t hairline shrink-0 bg-[var(--paper)]">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1">
                  ● Cart ready
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest faint leading-snug">
                  log in + pay in the live view to finish
                </p>
              </div>
            )}
          </aside>
        </div>

        <div className="px-5 py-2.5 border-t hairline flex items-center justify-between gap-4 shrink-0">
          <p className="font-mono text-[9px] uppercase tracking-widest faint">
            the agent works alongside you · your login + payment stay yours
          </p>
          {session?.replayUrl && (
            <a
              href={session.replayUrl}
              target="_blank"
              rel="noopener"
              className="font-mono text-[9px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors"
            >
              Replay →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
