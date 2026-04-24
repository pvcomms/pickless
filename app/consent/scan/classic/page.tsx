"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Hanko } from "@/components/Hanko";
import Link from "next/link";

type Phase = "idle" | "verifying" | "valid" | "invalid";

type VerifyResult = {
  valid: boolean;
  prefs: {
    loves: string[];
    avoids: string[];
    budgetBand: { lo: number; hi: number; currency: string };
    archetype: string;
  };
  scope: string;
  spendCap: number;
  ttlMs: number;
  error?: string;
};

function ScanInner() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const [token, setToken] = useState(params.get("t") ?? "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const t = params.get("t");
    if (t) {
      setToken(t);
      void verify(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(t?: string) {
    const tok = (t ?? token).trim();
    if (!tok) return;
    setPhase("verifying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/consent/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tok }),
      });
      const data: VerifyResult = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? "Verification failed");
        setPhase("invalid");
      } else {
        setResult(data);
        setPhase("valid");
      }
    } catch {
      setErrorMsg("Network error");
      setPhase("invalid");
    }
  }

  function reset() {
    setPhase("idle");
    setToken("");
    setResult(null);
    setErrorMsg("");
  }

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <Link href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          merchant verify
        </span>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-lg mx-auto w-full">
        {phase === "idle" && (
          <div className="w-full text-center rise">
            <Hanko size={52} label="検" />
            <h1 className="mt-8 font-display text-4xl tracking-tight">
              Verify a pass
            </h1>
            <p className="mt-4 text-sm faint leading-relaxed max-w-sm mx-auto">
              Enter the token shown on the customer&apos;s screen. You&apos;ll
              receive their preferences — single use, no identity.
            </p>

            <div className="mt-10 flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toLowerCase())}
                placeholder="16-char token"
                maxLength={16}
                className="flex-1 px-4 py-3 bg-[var(--paper)] border hairline rounded-sm font-mono text-sm placeholder:faint focus:outline-none focus:border-[var(--ink)] transition-colors"
                onKeyDown={(e) => e.key === "Enter" && verify()}
              />
              <button
                onClick={() => verify()}
                disabled={token.length !== 16}
                className="px-5 py-3 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest disabled:opacity-30 hover:bg-[var(--seal)] transition-all duration-300 cursor-pointer"
              >
                Check
              </button>
            </div>

            <p className="mt-4 text-[10px] faint font-mono">
              or scan QR from customer&apos;s pickless.ai/consent
            </p>
          </div>
        )}

        {phase === "verifying" && (
          <div className="text-center">
            <div className="w-2 h-2 rounded-full bg-[var(--seal)] mx-auto pulse-soft" />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest faint">
              Verifying…
            </p>
          </div>
        )}

        {phase === "valid" && result && (
          <div className="w-full rise">
            <div className="flex items-center gap-3 mb-8 px-5 py-3 border border-green-700/30 bg-green-900/10 rounded-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-green-400">
                Valid pass · single use consumed
              </span>
            </div>

            <div className="border hairline rounded-sm overflow-hidden">
              <div className="px-5 py-4 bg-[var(--paper)] border-b hairline flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--seal)]">
                  ● Customer taste profile
                </span>
                <span className="font-mono text-[9px] faint uppercase tracking-widest">
                  {result.scope}
                </span>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1.5">
                    Archetype
                  </p>
                  <p className="text-sm leading-relaxed italic">
                    &ldquo;{result.prefs.archetype}&rdquo;
                  </p>
                </div>

                {result.prefs.loves.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1.5">
                      Loves
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.prefs.loves.map((l) => (
                        <span
                          key={l}
                          className="px-2 py-0.5 border hairline rounded-sm font-mono text-[10px]"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.prefs.avoids.length > 0 && (
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1.5">
                      Avoids
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.prefs.avoids.map((a) => (
                        <span
                          key={a}
                          className="px-2 py-0.5 border border-[var(--seal)]/30 rounded-sm font-mono text-[10px] text-[var(--seal)]"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-baseline justify-between pt-2 border-t hairline">
                  <span className="font-mono text-[9px] uppercase tracking-widest faint">
                    Spend cap
                  </span>
                  <span className="font-display text-2xl tracking-tight">
                    {result.prefs.budgetBand.currency}{" "}
                    {result.spendCap.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={reset}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 border hairline rounded-sm font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--paper)] transition-colors"
            >
              Verify another
            </button>
          </div>
        )}

        {phase === "invalid" && (
          <div className="w-full text-center rise">
            <Hanko size={44} label="無" />
            <p className="mt-6 font-display text-2xl tracking-tight">
              {errorMsg === "token already used"
                ? "Pass already used"
                : errorMsg === "token not found or expired"
                  ? "Pass expired or not found"
                  : "Invalid pass"}
            </p>
            <p className="mt-2 text-xs faint font-mono">{errorMsg}</p>
            <button
              onClick={reset}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 border hairline rounded-sm font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--paper)] transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      <footer className="border-t hairline px-8 py-5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          Customer side →{" "}
          <Link
            href="/consent"
            className="hover:text-[var(--ink)] transition-colors underline underline-offset-2 decoration-dotted"
          >
            generate a pass
          </Link>
        </span>
        <span className="font-jp text-sm text-[var(--seal)]">検</span>
      </footer>
    </main>
  );
}

export default function ScanClassicPage() {
  return (
    <Suspense>
      <ScanInner />
    </Suspense>
  );
}
