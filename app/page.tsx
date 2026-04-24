"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Hanko } from "@/components/Hanko";
import { getBrowserLocation, type LocationData } from "@/lib/location";

type Phase = "idle" | "asking" | "located" | "denied";

export default function Landing() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [loc, setLoc] = useState<LocationData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pickless_location");
    if (stored) {
      setLoc(JSON.parse(stored));
      setPhase("located");
      return;
    }
    void requestLocation();
  }, []);

  async function requestLocation() {
    setPhase("asking");
    try {
      const c = await getBrowserLocation();
      const r = await fetch(`/api/geocode?lat=${c.lat}&lng=${c.lng}`);
      const data: LocationData = await r.json();
      setLoc(data);
      localStorage.setItem("pickless_location", JSON.stringify(data));
      setPhase("located");

      // BACKGROUND: as soon as location is locked, pre-fetch real restaurants
      // for this exact spot. By the time the user clicks Begin OR Skip, the
      // combo bank is already sitting in localStorage — Feed Me fires instantly.
      void (async () => {
        try {
          const r2 = await fetch(
            `/api/restaurants?lat=${data.lat}&lng=${data.lng}&city=${encodeURIComponent(data.city || "")}&neighborhood=${encodeURIComponent(data.neighborhood || "")}`,
          );
          const rdata = await r2.json();
          localStorage.setItem(
            "pickless_live_restaurants",
            JSON.stringify({
              fetchedAt: new Date().toISOString(),
              restaurants: rdata.restaurants || [],
            }),
          );
        } catch {}
      })();
    } catch {
      setPhase("denied");
    }
  }

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      {/* Top hairline + nav */}
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <span className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          v0 · agent build
        </span>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-8 py-20 max-w-3xl mx-auto w-full text-center">
        <Hanko size={56} label="食" />

        <h1 className="mt-10 font-display text-[clamp(3rem,9vw,6.5rem)] leading-[0.95] tracking-tight rise">
          Stop choosing.
          <br />
          <em className="text-[var(--seal)]">Start living.</em>
        </h1>

        <p className="mt-8 max-w-xl text-base sm:text-lg leading-relaxed faint">
          Participate in the modern economy on <em>your</em> terms. A humanist
          appendage on top of the apps you already use — your taste, learned
          once, plug-and-play across every interface.
        </p>

        {/* Live location status */}
        <div className="mt-12 mb-10 min-h-[80px] flex items-center justify-center">
          {phase === "asking" && (
            <div className="flex items-center gap-3 text-sm faint">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--seal)] pulse-soft inline-block" />
              <span className="font-mono uppercase tracking-widest text-[10px]">
                Reading GPS…
              </span>
            </div>
          )}

          {phase === "located" && loc && (
            <div className="rise text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest faint mb-2">
                The agent sees you in
              </p>
              <p className="font-display text-2xl sm:text-3xl tracking-tight">
                {loc.neighborhood ? `${loc.neighborhood}, ` : ""}
                <em>{loc.city}</em>
              </p>
              <p className="mt-1 text-xs faint font-mono">
                {loc.country} · {loc.lat.toFixed(3)}°, {loc.lng.toFixed(3)}°
              </p>
            </div>
          )}

          {phase === "denied" && (
            <div className="text-center">
              <p className="text-sm faint mb-3">
                Location off — we need it to find food near you.
              </p>
              <button
                onClick={requestLocation}
                className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border hairline rounded-sm hover:bg-[var(--paper)] transition-colors"
              >
                Allow access
              </button>
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            if (phase !== "located") {
              try {
                await requestLocation();
              } catch {}
            }
            window.location.href = "/connect";
          }}
          className="group inline-flex items-center gap-3 px-7 py-4 rounded-sm font-mono text-xs uppercase tracking-widest transition-all duration-500 bg-[var(--ink)] text-[var(--bg)] hover:bg-[var(--seal)] cursor-pointer"
        >
          Begin
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="transition-transform group-hover:translate-x-1"
          >
            <path
              d="M1 7H13M13 7L7 1M13 7L7 13"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>

        <p className="mt-6 text-xs faint">
          Free. No card. The agent keeps no menus.
        </p>

        <button
          onClick={async () => {
            if (phase !== "located") {
              try {
                await requestLocation();
              } catch {}
            }
            window.location.href = "/app?guest=1";
          }}
          className="mt-8 font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors underline underline-offset-4 decoration-dotted"
        >
          Skip setup · just feed me random →
        </button>
        <p className="mt-2 text-[10px] faint max-w-xs">
          location only · no email, no apps · top-rated picks near you
        </p>
      </section>

      {/* The three steps — minimal, hairline grid */}
      <section className="border-t hairline">
        <div className="max-w-5xl mx-auto px-8 py-20 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--line)]">
          {[
            {
              n: "一",
              k: "1",
              title: "We see you",
              body: "The agent reads your live location the moment you arrive. No address forms.",
            },
            {
              n: "二",
              k: "2",
              title: "You connect once",
              body: "One-click popup to Swiggy, Zomato, Uber Eats, Deliveroo, Wolt — whatever you already use.",
            },
            {
              n: "三",
              k: "3",
              title: "It feeds you",
              body: "Press one button. The agent picks a real dish, opens the right app, places the order.",
            },
          ].map((s) => (
            <div key={s.k} className="bg-[var(--bg)] p-10">
              <div className="flex items-baseline gap-3 mb-6">
                <span className="font-jp text-2xl text-[var(--seal)]">
                  {s.n}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest faint">
                  step {s.k}
                </span>
              </div>
              <h3 className="font-display text-2xl tracking-tight mb-2">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed faint">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Manifesto */}
      <section className="border-t hairline">
        <div className="max-w-3xl mx-auto px-8 py-24 text-left">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] mb-6">
            ● The bigger thing
          </p>
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight mb-8">
            Pickless is one instance of a <em>protocol</em>.
          </h2>
          <div className="space-y-5 text-base sm:text-lg leading-relaxed faint max-w-2xl">
            <p>
              Big platforms don&apos;t care about you. They care about their
              bottom line — and that&apos;s reflected in every default they
              ship. Same recommendations, same dark patterns, same plays run on
              you forever. They have all the data. You just keep clicking.
            </p>
            <p>
              Pickless is the last mile, flipped back toward the user. We sit on
              top of the apps you already use, take the levers the platforms
              won&apos;t give you, and make their stack work for you.
              <em> A bit of a protest, really.</em>
            </p>
            <p>
              Underneath: a portable, cross-app <em>preference layer</em> that
              you own. Your taste, your routines, your last-orders, your dietary
              signals — learned once, plug-and-play into any agent, any
              interface.
            </p>
            <p className="text-[var(--ink)]">
              <em>Think MCP. Think Aadhaar. But for the cyborg human.</em>
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t hairline px-8 py-6 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          pickless.ai · part of the suite
        </span>
        <span className="font-jp text-sm text-[var(--seal)]">食</span>
      </footer>
    </main>
  );
}
