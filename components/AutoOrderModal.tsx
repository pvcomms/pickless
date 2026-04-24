"use client";
import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";

type Props = {
  open: boolean;
  userId: string;
  dish: string;
  restaurant: string;
  platform: string;
  orderUrl: string;
  onClose: () => void;
  onOrdered: () => void;
};

type Session = {
  sessionId: string;
  liveUrl: string;
  replayUrl: string;
};

export function AutoOrderModal({
  open,
  userId,
  dish,
  restaurant,
  platform,
  orderUrl,
  onClose,
  onOrdered,
}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "live" | "error">(
    "idle",
  );
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setSession(null);
    setErr("");
    setState("starting");
    void (async () => {
      try {
        const r = await fetch("/api/auto-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            dish,
            restaurant,
            platform,
            orderUrl,
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
        });
        setState("live");
        sfx.thunk();
      } catch (e) {
        setErr((e as Error).message);
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function close(finalize: boolean) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/80 backdrop-blur-sm px-4 sm:px-8"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-5xl h-[85vh] bg-[var(--bg)] border hairline rounded-sm overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b hairline shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--seal)] pulse-soft inline-block" />
              {state === "starting" && "Agent spinning up a browser"}
              {state === "live" &&
                "Agent is at the restaurant · take over to pay"}
              {state === "error" && "Agent hit a wall"}
            </p>
            <p className="font-display text-lg tracking-tight truncate">
              {dish} · <span className="faint">{restaurant}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {state === "live" && (
              <button
                onClick={() => close(true)}
                className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 bg-[var(--ink)] text-[var(--bg)] rounded-sm hover:bg-[var(--seal)] transition-colors"
              >
                Mark ordered
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

        <div className="flex-1 relative bg-[var(--paper)]">
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
                The agent couldn't reach {platform}.
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600 max-w-md break-all">
                {err}
              </p>
              <a
                href={orderUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 font-mono text-[10px] uppercase tracking-widest px-4 py-2 border hairline rounded-sm faint hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
              >
                Open {platform} yourself →
              </a>
            </div>
          )}
          {state === "live" && session && (
            <iframe
              src={session.liveUrl}
              title="Pickless agent browser"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              allow="clipboard-read; clipboard-write"
              className="w-full h-full border-0"
            />
          )}
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
