"use client";
import { use, useEffect, useState } from "react";
import { PLATFORMS } from "@/lib/platforms";
import { generateMockOrders } from "@/lib/orders";

type Stage = "choose" | "deeplinking" | "authorising" | "success";

function detectDevice(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export default function AuthPopup({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform: platformId } = use(params);
  const platform = PLATFORMS.find((p) => p.id === platformId);
  const [stage, setStage] = useState<Stage>("choose");
  const [device, setDevice] = useState<"ios" | "android" | "desktop">(
    "desktop",
  );

  useEffect(() => {
    setDevice(detectDevice());
    document.title = platform
      ? `Connect ${platform.name} · Pickless`
      : "Pickless";
  }, [platform]);

  if (!platform) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[var(--ink)]">
        <p className="text-sm faint">Unknown platform.</p>
      </main>
    );
  }

  async function finish(ok: boolean) {
    const orders = ok ? generateMockOrders(platform!.id, 8) : [];
    let liveRestaurants: any[] = [];
    if (ok) {
      try {
        const stored = localStorage.getItem("pickless_location");
        if (stored) {
          const loc = JSON.parse(stored);
          const r = await fetch(
            `/api/restaurants?lat=${loc.lat}&lng=${loc.lng}&city=${encodeURIComponent(loc.city || "")}&neighborhood=${encodeURIComponent(loc.neighborhood || "")}`,
          );
          const data = await r.json();
          liveRestaurants = data.restaurants || [];
        }
      } catch {}
    }
    window.opener?.postMessage(
      {
        type: "pickless:auth",
        platform: platform!.id,
        ok,
        orders,
        liveRestaurants,
      },
      window.location.origin,
    );
    setTimeout(() => window.close(), 500);
  }

  function openInApp() {
    setStage("deeplinking");
    const start = Date.now();

    // Try deep-link to phone app via custom URL scheme.
    const a = document.createElement("a");
    a.href = platform!.appScheme;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // If we're still here after 1.5s, the app probably isn't installed →
    // fall through to App Store / Play Store.
    setTimeout(() => {
      if (Date.now() - start < 1700) {
        const storeUrl =
          device === "ios" ? platform!.iosUrl : platform!.androidUrl;
        window.location.href = storeUrl;
      }
    }, 1500);

    // Either way, mark connected after 2.4s — the user has either signed in
    // on their phone (real) or installed the app (next-step).
    setTimeout(() => {
      setStage("success");
      setTimeout(() => finish(true), 900);
    }, 2400);
  }

  function authoriseWeb() {
    setStage("authorising");
    setTimeout(() => {
      setStage("success");
      setTimeout(() => finish(true), 700);
    }, 1100);
  }

  return (
    <main className="min-h-screen flex flex-col text-[var(--ink)]">
      <div
        className="px-6 py-5 flex items-center gap-3"
        style={{ backgroundColor: platform.color, color: "#fff" }}
      >
        <div className="w-8 h-8 rounded-sm bg-white/15 flex items-center justify-center font-display text-base">
          {platform.name[0]}
        </div>
        <div>
          <span className="font-display text-lg tracking-tight block leading-tight">
            {platform.name}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-75">
            {platform.tagline}
          </span>
        </div>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest opacity-75">
          via pickless.ai
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {stage === "choose" && (
            <div className="rise space-y-6">
              <div>
                <h1 className="font-display text-3xl tracking-tight mb-2">
                  Connect{" "}
                  <em className="text-[var(--seal)]">{platform.name}</em>
                </h1>
                <p className="text-sm faint leading-relaxed">
                  Pickless will read your delivery address and order history
                  from {platform.name} so the agent can pick + place orders for
                  you.
                </p>
              </div>

              <button
                onClick={openInApp}
                className="w-full py-4 rounded-sm font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-3"
                style={{ backgroundColor: platform.color }}
              >
                <PhoneGlyph />
                Open {platform.name} app
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--line)]" />
                <span className="font-mono text-[9px] uppercase tracking-widest faint">
                  or
                </span>
                <div className="flex-1 h-px bg-[var(--line)]" />
              </div>

              <button
                onClick={authoriseWeb}
                className="w-full py-3 rounded-sm font-mono text-[10px] uppercase tracking-widest border hairline hover:bg-[var(--paper)] transition-colors"
              >
                Continue without app (demo)
              </button>

              <p className="text-[10px] faint text-center leading-relaxed">
                We never store passwords. Sessions stay scoped to your browser.
                {device === "desktop" && (
                  <> · Tip: open this on your phone for the real handoff.</>
                )}
              </p>
            </div>
          )}

          {stage === "deeplinking" && (
            <div className="rise text-center space-y-6 py-10">
              <div className="flex justify-center">
                <PhonePulse color={platform.color} />
              </div>
              <p className="font-display text-2xl tracking-tight">
                Opening <em>{platform.name}</em>…
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest faint">
                If the app doesn&apos;t open, you&apos;ll be redirected to
                install it.
              </p>
            </div>
          )}

          {stage === "authorising" && (
            <div className="rise text-center space-y-6 py-10">
              <div className="flex justify-center">
                <Spinner color={platform.color} />
              </div>
              <p className="font-display text-2xl tracking-tight">
                Pulling your <em>{platform.name}</em> history…
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest faint">
                Reading address · order log · taste signals
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
                Pulled 8 recent orders · closing window…
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
          end-to-end · scoped session
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

function PhonePulse({ color }: { color: string }) {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <span
        className="absolute inset-0 rounded-full opacity-30"
        style={{
          backgroundColor: color,
          animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
        }}
      />
      <span
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: color }}
      >
        <PhoneGlyph color="#fff" />
      </span>
      <style>{`@keyframes ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }`}</style>
    </div>
  );
}

function PhoneGlyph({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="6"
        y="2"
        width="12"
        height="20"
        rx="2.5"
        stroke={color}
        strokeWidth="1.6"
      />
      <line
        x1="11"
        y1="18"
        x2="13"
        y2="18"
        stroke={color}
        strokeWidth="1.6"
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
