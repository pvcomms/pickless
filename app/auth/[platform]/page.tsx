"use client";
import { use, useEffect, useState } from "react";
import { PLATFORMS } from "@/lib/platforms";

type Stage = "form" | "authorising" | "success";

export default function AuthPopup({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform: platformId } = use(params);
  const platform = PLATFORMS.find((p) => p.id === platformId);
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");

  useEffect(() => {
    document.title = platform
      ? `Sign in to ${platform.name} · Pickless`
      : "Pickless";
  }, [platform]);

  if (!platform) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[var(--ink)]">
        <p className="text-sm faint">Unknown platform.</p>
      </main>
    );
  }

  function authorise(e?: React.FormEvent) {
    e?.preventDefault();
    setStage("authorising");
    setTimeout(() => {
      setStage("success");
      setTimeout(() => {
        window.opener?.postMessage(
          {
            type: "pickless:auth",
            platform: platform!.id,
            ok: true,
            email: email || undefined,
          },
          window.location.origin,
        );
        setTimeout(() => window.close(), 600);
      }, 700);
    }, 1100);
  }

  return (
    <main className="min-h-screen flex flex-col text-[var(--ink)]">
      {/* Brand bar */}
      <div
        className="px-6 py-5 flex items-center gap-3"
        style={{ backgroundColor: platform.color, color: "#fff" }}
      >
        <div className="w-8 h-8 rounded-sm bg-white/15 flex items-center justify-center font-display text-base">
          {platform.name[0]}
        </div>
        <span className="font-display text-lg tracking-tight">
          {platform.name}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest opacity-75">
          via pickless.ai
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {stage === "form" && (
            <form onSubmit={authorise} className="rise space-y-6">
              <div>
                <h1 className="font-display text-3xl tracking-tight mb-2">
                  Authorise <em className="text-[var(--seal)]">Pickless</em>
                </h1>
                <p className="text-sm faint leading-relaxed">
                  Pickless will read your saved addresses, payment methods, and
                  recent orders on {platform.name} so the agent can place orders
                  for you.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest faint block mb-1.5">
                    Your {platform.name} email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 bg-[var(--paper)] border hairline rounded-sm text-sm font-mono outline-none focus:border-[var(--ink)] transition-colors"
                    required
                  />
                </div>

                <div className="text-xs faint flex items-start gap-2 pt-2">
                  <span className="font-jp text-[var(--seal)] leading-none mt-0.5">
                    ●
                  </span>
                  <span>
                    A push notification will be sent to your {platform.name} app
                    to confirm.
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-sm font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: platform.color }}
                >
                  Authorise →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.opener?.postMessage(
                      {
                        type: "pickless:auth",
                        platform: platform.id,
                        ok: false,
                      },
                      window.location.origin,
                    );
                    window.close();
                  }}
                  className="w-full py-2 font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {stage === "authorising" && (
            <div className="rise text-center space-y-6 py-10">
              <div className="flex justify-center">
                <Spinner color={platform.color} />
              </div>
              <p className="font-display text-2xl tracking-tight">
                Linking your <em>{platform.name}</em> account…
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest faint">
                Confirming session · scoping permissions
              </p>
            </div>
          )}

          {stage === "success" && (
            <div className="rise text-center space-y-6 py-10">
              <div className="flex justify-center">
                <Check color={platform.color} />
              </div>
              <p className="font-display text-2xl tracking-tight">
                <em className="text-[var(--seal)]">Linked.</em>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest faint">
                Closing window…
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t hairline flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          pickless.ai
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          end-to-end encrypted
        </span>
      </div>
    </main>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg className="animate-spin w-10 h-10" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        opacity="0.2"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill={color} fillOpacity="0.12" />
      <circle cx="28" cy="28" r="26" stroke={color} strokeWidth="1.5" />
      <path
        d="M16 28L25 37L40 20"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 60,
          strokeDashoffset: 60,
          animation: "draw 600ms cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      />
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}
