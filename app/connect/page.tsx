"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORMS } from "@/lib/platforms";
import {
  getBrowserLocation,
  regionForCountry,
  type LocationData,
} from "@/lib/location";

const REGIONS = ["IN", "UK", "US", "AU", "EU"] as const;
type Region = (typeof REGIONS)[number];
const REGION_LABELS: Record<Region, string> = {
  IN: "India",
  UK: "United Kingdom",
  US: "United States",
  AU: "Australia",
  EU: "Europe",
};

export default function Connect() {
  const router = useRouter();
  const [region, setRegion] = useState<Region>("IN");
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pickless_location");
    if (stored) {
      const d: LocationData = JSON.parse(stored);
      setLocation(d);
      const r = regionForCountry(d.countryCode) as Region;
      if (REGIONS.includes(r)) setRegion(r);
    } else {
      void detect();
    }
    const c = localStorage.getItem("pickless_connected");
    if (c) setConnected(new Set(JSON.parse(c)));
  }, []);

  async function detect() {
    try {
      const c = await getBrowserLocation();
      const r = await fetch(`/api/geocode?lat=${c.lat}&lng=${c.lng}`);
      const data: LocationData = await r.json();
      setLocation(data);
      localStorage.setItem("pickless_location", JSON.stringify(data));
      const reg = regionForCountry(data.countryCode) as Region;
      if (REGIONS.includes(reg)) setRegion(reg);
    } catch {}
  }

  // 1-click popup OAuth
  function connectPlatform(id: string) {
    if (connected.has(id) || opening) return;
    setOpening(id);
    const w = 460;
    const h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      `/auth/${id}`,
      `pickless_${id}`,
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "pickless:auth") return;
      if (e.data.platform !== id) return;
      const next = new Set(connected);
      if (e.data.ok) next.add(id);
      setConnected(next);
      localStorage.setItem("pickless_connected", JSON.stringify([...next]));
      setOpening(null);
      window.removeEventListener("message", handler);
    };
    window.addEventListener("message", handler);

    const guard = setInterval(() => {
      if (popup?.closed) {
        setOpening(null);
        clearInterval(guard);
        window.removeEventListener("message", handler);
      }
    }, 500);
  }

  function disconnect(id: string) {
    const next = new Set(connected);
    next.delete(id);
    setConnected(next);
    localStorage.setItem("pickless_connected", JSON.stringify([...next]));
  }

  function next() {
    if (connected.size === 0) return;
    router.push("/app");
  }

  const visible = PLATFORMS.filter((p) => p.regions.includes(region));

  return (
    <main className="min-h-screen text-[var(--ink)]">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <a href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </a>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          {connected.size} / {visible.length} connected
        </span>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-16">
        <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
          step two
        </p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-3">
          Connect what you <em className="text-[var(--seal)]">already use</em>.
        </h1>
        <p className="text-sm faint mb-12 max-w-md leading-relaxed">
          One-click popup. Sign in once per app. The agent reuses your existing
          account — never asks again.
        </p>

        {/* Location pill */}
        {location && (
          <div className="mb-8 inline-flex items-center gap-3 px-4 py-2 border hairline rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-soft inline-block" />
            <span className="font-mono text-[10px] uppercase tracking-widest">
              {location.neighborhood || location.city} · {location.countryCode}
            </span>
          </div>
        )}

        {/* Region selector */}
        <div className="mb-8 flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border rounded-sm transition-colors ${
                region === r
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                  : "hairline faint hover:text-[var(--ink)]"
              }`}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Platform tiles */}
        <div className="space-y-px bg-[var(--line)] border hairline">
          {visible.map((p) => {
            const on = connected.has(p.id);
            const busy = opening === p.id;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-4 bg-[var(--bg)]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-sm flex items-center justify-center text-white font-display text-lg"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="font-display text-lg tracking-tight">
                      {p.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest faint">
                      {p.regions.join(" · ")}
                    </p>
                  </div>
                </div>

                {on ? (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                      Linked
                    </span>
                    <button
                      onClick={() => disconnect(p.id)}
                      className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => connectPlatform(p.id)}
                    disabled={busy}
                    className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border hairline rounded-sm hover:bg-[var(--ink)] hover:text-[var(--bg)] hover:border-transparent transition-colors disabled:opacity-50"
                  >
                    {busy ? "Opening…" : "Connect →"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={next}
          disabled={connected.size === 0}
          className={`mt-10 w-full py-4 border rounded-sm font-mono text-xs uppercase tracking-widest transition-all ${
            connected.size > 0
              ? "bg-[var(--ink)] text-[var(--bg)] border-transparent hover:bg-[var(--seal)]"
              : "hairline faint cursor-not-allowed"
          }`}
        >
          {connected.size === 0
            ? "Link at least one app"
            : `Continue with ${connected.size} app${connected.size > 1 ? "s" : ""} →`}
        </button>

        <p className="mt-4 text-center text-xs faint">
          We never store your delivery passwords. Sessions are scoped to your
          browser.
        </p>
      </div>
    </main>
  );
}
