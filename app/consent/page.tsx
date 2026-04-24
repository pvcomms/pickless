"use client";
import { useState, useEffect, useRef } from "react";
import { getUserId } from "@/lib/userId";
import { Hanko } from "@/components/Hanko";
import Link from "next/link";

type Phase = "idle" | "generating" | "active" | "expired" | "error";

type TokenData = {
  token: string;
  verifyUrl: string;
  expiresAt: number;
  prefs: {
    loves: string[];
    avoids: string[];
    budgetBand: { lo: number; hi: number; currency: string };
    archetype: string;
  };
  scope: string;
  spendCap: number;
};

const SCOPES = [
  { id: "any", label: "Anything", jp: "全" },
  { id: "restaurant", label: "Sit-down", jp: "食" },
  { id: "coffee", label: "Coffee", jp: "茶" },
  { id: "delivery", label: "Delivery", jp: "配" },
];

export default function ConsentPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [scope, setScope] = useState("any");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function generate() {
    setPhase("generating");
    setError("");
    try {
      const userId = getUserId();
      const res = await fetch("/api/consent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, scope }),
      });
      const data: TokenData = await res.json();
      setTokenData(data);

      // Generate QR client-side
      const QRCode = (await import("qrcode")).default;
      const svg = await QRCode.toString(data.verifyUrl, {
        type: "svg",
        margin: 2,
        color: {
          dark:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--ink")
              .trim()
              .replace(/^#/, "") || "eeeae0",
          light: "00000000",
        },
      });
      setQrSvg(svg);

      const remaining = Math.floor((data.expiresAt - Date.now()) / 1000);
      setSecondsLeft(remaining);
      setPhase("active");

      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            setPhase("expired");
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setError("Could not generate token. Try again.");
      setPhase("error");
    }
  }

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("idle");
    setTokenData(null);
    setQrSvg(null);
    setSecondsLeft(0);
    setError("");
  }

  const progress = tokenData
    ? (secondsLeft /
        ((tokenData.expiresAt - Date.now() + secondsLeft * 1000) / 1000)) *
      100
    : 100;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <Link href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          consent pass
        </span>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-lg mx-auto w-full">
        {phase === "idle" && (
          <div className="w-full text-center rise">
            <Hanko size={52} label="承" />
            <h1 className="mt-8 font-display text-4xl sm:text-5xl tracking-tight leading-tight">
              5-minute
              <br />
              taste pass
            </h1>
            <p className="mt-5 text-sm faint leading-relaxed max-w-sm mx-auto">
              Share a scoped, time-limited token with any counter, kiosk, or
              agent. They see your preferences — not your history, not your
              identity.
            </p>

            {/* Scope picker */}
            <div className="mt-10 grid grid-cols-4 gap-px bg-[var(--line)] rounded-sm overflow-hidden border hairline">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScope(s.id)}
                  className={`flex flex-col items-center gap-1.5 py-4 px-2 transition-colors ${
                    scope === s.id
                      ? "bg-[var(--ink)] text-[var(--bg)]"
                      : "bg-[var(--paper)] hover:bg-[var(--line)]"
                  }`}
                >
                  <span className="font-jp text-base">{s.jp}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={generate}
              className="mt-8 w-full flex items-center justify-center gap-3 px-7 py-4 rounded-sm font-mono text-xs uppercase tracking-widest bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--seal)] transition-all duration-500 cursor-pointer"
            >
              Generate pass
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 7H13M13 7L7 1M13 7L7 13"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>

            <p className="mt-4 text-[10px] faint font-mono">
              single-use · expires in 5 min · correlation-resistant
            </p>
          </div>
        )}

        {phase === "generating" && (
          <div className="text-center">
            <div className="w-2 h-2 rounded-full bg-[var(--seal)] mx-auto pulse-soft" />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest faint">
              Minting token…
            </p>
          </div>
        )}

        {phase === "active" && tokenData && qrSvg && (
          <div className="w-full text-center rise">
            {/* Countdown arc */}
            <div className="relative mx-auto w-fit mb-6">
              <svg width="80" height="80" className="rotate-[-90deg]">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="3"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="var(--seal)"
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - secondsLeft / 300)}`}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-sm tabular-nums">
                  {mins}:{secs.toString().padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* QR */}
            <div
              className="mx-auto border hairline rounded-sm p-4 bg-[var(--paper)]"
              style={{ width: 200, height: 200 }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />

            {/* Prefs preview */}
            <div className="mt-6 text-left border hairline rounded-sm p-5 bg-[var(--paper)] space-y-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--seal)]">
                ● What they see
              </p>
              <p className="text-xs faint">{tokenData.prefs.archetype}</p>
              {tokenData.prefs.loves.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                    Loves
                  </p>
                  <p className="text-xs">
                    {tokenData.prefs.loves.slice(0, 4).join(" · ")}
                  </p>
                </div>
              )}
              {tokenData.prefs.avoids.length > 0 && (
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                    Avoids
                  </p>
                  <p className="text-xs">
                    {tokenData.prefs.avoids.slice(0, 3).join(" · ")}
                  </p>
                </div>
              )}
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                  Spend cap
                </p>
                <p className="text-xs">
                  {tokenData.prefs.budgetBand.currency} {tokenData.spendCap}
                </p>
              </div>
            </div>

            <p className="mt-4 font-mono text-[9px] uppercase tracking-widest faint">
              token · {tokenData.token.slice(0, 4)}···
              {tokenData.token.slice(-4)}
            </p>

            <button
              onClick={reset}
              className="mt-6 font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors underline underline-offset-4 decoration-dotted"
            >
              Cancel pass
            </button>
          </div>
        )}

        {(phase === "expired" || phase === "error") && (
          <div className="text-center rise">
            <Hanko size={44} label="切" />
            <p className="mt-6 font-display text-2xl tracking-tight">
              {phase === "expired" ? "Pass expired" : "Something went wrong"}
            </p>
            {error && <p className="mt-2 text-sm faint">{error}</p>}
            <button
              onClick={reset}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 border hairline rounded-sm font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--paper)] transition-colors"
            >
              Generate new pass
            </button>
          </div>
        )}
      </section>

      {/* Merchant link */}
      <footer className="border-t hairline px-8 py-5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          For merchants →{" "}
          <Link
            href="/consent/scan"
            className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-dotted"
          >
            verify a pass
          </Link>
        </span>
        <span className="font-jp text-sm text-[var(--seal)]">承</span>
      </footer>
    </main>
  );
}
