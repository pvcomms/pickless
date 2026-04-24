import Link from "next/link";

const steps = {
  customer: [
    {
      n: "01",
      label: "Profile built",
      sub: "quiz or order history — happens once, persists forever",
    },
    {
      n: "02",
      label: "Tap Generate",
      sub: "one action, zero typing, no conversation",
    },
    {
      n: "03",
      label: "QR appears",
      sub: "5-minute pass, scoped to this visit",
    },
    { n: "04", label: "Show phone", sub: "no words needed at the counter" },
  ],
  merchant: [
    {
      n: "A",
      label: "Scan QR",
      sub: "built-in camera or any reader — one gesture",
    },
    {
      n: "B",
      label: "Pass verified",
      sub: "single-use consumed, token invalidated",
    },
    {
      n: "C",
      label: "Suggestion lands",
      sub: "AI picks one dish in < 2 seconds",
    },
    { n: "D", label: "Serve", sub: "zero guesswork, zero back-and-forth" },
  ],
};

const tokenFields = [
  {
    key: "loves",
    value: '["Indian", "Biryani", "Spicy"]',
    color: "var(--ink)",
  },
  { key: "avoids", value: '["Mushroom"]', color: "var(--seal)" },
  { key: "budget", value: '"INR 600"', color: "var(--ink)" },
  { key: "archetype", value: '"comfort seeker"', color: "var(--ink)" },
  { key: "ttl", value: '"300s · single-use"', color: "var(--faint)" },
  { key: "identity", value: "null", color: "var(--faint)" },
];

const guarantees = [
  { jp: "無名", en: "No name", desc: "Zero PII in the token" },
  { jp: "一回", en: "Single use", desc: "Token burns on scan" },
  { jp: "短命", en: "5-min TTL", desc: "Expires automatically" },
  { jp: "匿名", en: "No history", desc: "Not linkable to past orders" },
];

export default function FlowPage() {
  return (
    <main className="min-h-screen text-[var(--ink)] overflow-x-hidden">
      {/* Nav */}
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <Link href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          protocol
        </span>
      </nav>

      {/* Hero */}
      <section className="px-8 sm:px-12 pt-20 pb-12 max-w-5xl mx-auto text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] mb-6">
          ● The Pickless consent loop
        </p>
        <h1 className="font-display text-5xl sm:text-6xl tracking-tight leading-[1.05] mb-6">
          Taste shared.
          <br />
          Identity kept.
        </h1>
        <p className="text-sm faint leading-relaxed max-w-lg mx-auto">
          A customer shows a QR. A merchant scans it. No name exchanged, no
          conversation needed — just a 5-second handshake that tells the kitchen
          exactly who they&apos;re serving.
        </p>
      </section>

      {/* Three-column flow */}
      <section className="px-6 sm:px-12 pb-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-0 lg:gap-0">
          {/* Customer column */}
          <div className="border hairline rounded-sm lg:rounded-r-none overflow-hidden">
            <div className="px-6 py-5 bg-[var(--paper)] border-b hairline">
              <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                POV 01
              </p>
              <h2 className="font-display text-2xl tracking-tight">Customer</h2>
              <p className="font-mono text-[10px] faint mt-1">
                at home, before leaving
              </p>
            </div>

            {/* Phone mockup */}
            <div className="p-6">
              <div
                className="mx-auto w-fit border hairline rounded-[16px] overflow-hidden bg-[var(--paper)]"
                style={{ width: 180 }}
              >
                <div className="px-4 py-3 border-b hairline flex items-center justify-between">
                  <span className="font-display text-xs tracking-tight">
                    pickless<span className="text-[var(--seal)]">.ai</span>
                  </span>
                  <span className="font-mono text-[8px] faint">承</span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {/* Mini QR placeholder */}
                  <div className="w-full aspect-square bg-[var(--bg)] rounded-sm flex items-center justify-center border hairline">
                    <svg
                      viewBox="0 0 40 40"
                      className="w-20 h-20 opacity-60"
                      fill="var(--ink)"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="14"
                        height="14"
                        rx="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <rect x="5" y="5" width="8" height="8" />
                      <rect
                        x="24"
                        y="2"
                        width="14"
                        height="14"
                        rx="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <rect x="27" y="5" width="8" height="8" />
                      <rect
                        x="2"
                        y="24"
                        width="14"
                        height="14"
                        rx="1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <rect x="5" y="27" width="8" height="8" />
                      <rect x="24" y="24" width="4" height="4" />
                      <rect x="30" y="24" width="4" height="4" />
                      <rect x="24" y="30" width="4" height="4" />
                      <rect x="30" y="30" width="4" height="4" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--seal)]" />
                    <span className="font-mono text-[8px] text-[var(--seal)]">
                      4:58 remaining
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-6 pb-6 space-y-0">
              {steps.customer.map((s, i) => (
                <div
                  key={s.n}
                  className={`flex gap-4 py-4 ${i < steps.customer.length - 1 ? "border-b hairline" : ""}`}
                >
                  <span className="font-mono text-[10px] faint w-5 flex-shrink-0 pt-px">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {s.label}
                    </p>
                    <p className="font-mono text-[9px] faint mt-0.5 leading-relaxed">
                      {s.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token bridge */}
          <div
            className="border-x-0 border-y hairline lg:border-x lg:border-y-0 lg:rounded-none bg-[var(--paper)] relative flex flex-col"
            style={{ minWidth: 200 }}
          >
            {/* Header */}
            <div className="px-5 py-5 border-b hairline">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--seal)] mb-1">
                ● token
              </p>
              <h2 className="font-display text-xl tracking-tight">
                Consent pass
              </h2>
              <p className="font-mono text-[10px] faint mt-1">
                the only thing that moves
              </p>
            </div>

            {/* Token body */}
            <div className="p-5 flex-1">
              <div className="border hairline rounded-sm overflow-hidden">
                <div className="px-3 py-2 border-b hairline">
                  <span className="font-mono text-[8px] faint">
                    consent_token.json
                  </span>
                </div>
                <div className="p-3 space-y-1.5">
                  {tokenFields.map((f) => (
                    <div key={f.key} className="flex gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] faint">
                        {f.key}:
                      </span>
                      <span
                        className="font-mono text-[9px]"
                        style={{ color: f.color }}
                      >
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flow indicators */}
              <div className="mt-5 flex flex-col items-center gap-2">
                {["single-use", "ttl: 300s", "correlation-free"].map(
                  (label) => (
                    <span
                      key={label}
                      className="font-mono text-[9px] faint px-3 py-1 border hairline rounded-full"
                    >
                      {label}
                    </span>
                  ),
                )}
              </div>

              {/* Arrow down/right */}
              <div className="mt-6 flex flex-col items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="block w-px h-4 bg-[var(--line)]"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="var(--seal)"
                  className="mt-0.5"
                >
                  <path d="M5 6L0 0h10z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Merchant column */}
          <div className="border hairline rounded-sm lg:rounded-l-none overflow-hidden">
            <div className="px-6 py-5 bg-[var(--paper)] border-b hairline">
              <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
                POV 02
              </p>
              <h2 className="font-display text-2xl tracking-tight">Merchant</h2>
              <p className="font-mono text-[10px] faint mt-1">
                at counter, after scan
              </p>
            </div>

            {/* What they see mockup */}
            <div className="p-6">
              <div className="border hairline rounded-sm overflow-hidden bg-[var(--bg)]">
                {/* Valid banner */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-900/20 border-b border-green-700/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="font-mono text-[8px] text-green-400 uppercase tracking-widest">
                    Valid · consumed
                  </span>
                </div>
                {/* Suggestion */}
                <div className="px-4 py-4 border-b hairline">
                  <p className="font-mono text-[8px] text-[var(--seal)] uppercase tracking-widest mb-2">
                    ● pickless suggests
                  </p>
                  <p className="font-display text-lg tracking-tight leading-tight">
                    Chicken Biryani
                  </p>
                  <p className="font-mono text-[8px] faint mt-1">
                    rich, familiar, hits the comfort note
                  </p>
                </div>
                {/* Profile */}
                <div className="px-4 py-4 space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {["Indian", "Biryani", "Spicy"].map((l) => (
                      <span
                        key={l}
                        className="px-2 py-0.5 border hairline rounded-sm font-mono text-[8px]"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {["Mushroom"].map((a) => (
                      <span
                        key={a}
                        className="px-2 py-0.5 border border-[var(--seal)]/30 rounded-sm font-mono text-[8px] text-[var(--seal)]"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-baseline justify-between pt-2 border-t hairline">
                    <span className="font-mono text-[8px] faint">cap</span>
                    <span className="font-display text-base">₹ 600</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-6 pb-6 space-y-0">
              {steps.merchant.map((s, i) => (
                <div
                  key={s.n}
                  className={`flex gap-4 py-4 ${i < steps.merchant.length - 1 ? "border-b hairline" : ""}`}
                >
                  <span className="font-mono text-[10px] faint w-5 flex-shrink-0 pt-px">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {s.label}
                    </p>
                    <p className="font-mono text-[9px] faint mt-0.5 leading-relaxed">
                      {s.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline bar */}
      <section className="px-6 sm:px-12 pb-16 max-w-5xl mx-auto">
        <div className="border hairline rounded-sm overflow-hidden">
          <div className="px-6 py-4 bg-[var(--paper)] border-b hairline">
            <p className="font-mono text-[9px] uppercase tracking-widest faint">
              Timeline · seconds from first tap
            </p>
          </div>
          <div className="px-6 py-6">
            <div className="relative">
              {/* Track */}
              <div className="h-px bg-[var(--line)] w-full absolute top-4" />
              <div className="flex justify-between relative">
                {[
                  { t: "T+0", label: "Generate tapped", side: "customer" },
                  { t: "T+1s", label: "QR ready", side: "customer" },
                  { t: "T+3s", label: "Merchant scans", side: "merchant" },
                  { t: "T+5s", label: "Suggestion lands", side: "merchant" },
                  { t: "T+10s", label: "Order placed", side: "merchant" },
                ].map((ev) => (
                  <div key={ev.t} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full border-2 ${
                        ev.side === "customer"
                          ? "border-[var(--ink)] bg-[var(--bg)]"
                          : "border-[var(--seal)] bg-[var(--seal)]"
                      }`}
                    />
                    <span className="font-mono text-[8px] faint">{ev.t}</span>
                    <span className="font-mono text-[8px] text-center leading-tight max-w-[64px]">
                      {ev.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-8 pt-4 border-t hairline">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full border-2 border-[var(--ink)] bg-[var(--bg)]" />
                <span className="font-mono text-[9px] faint">Customer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--seal)]" />
                <span className="font-mono text-[9px] faint">Merchant</span>
              </div>
              <span className="font-mono text-[9px] faint ml-auto">
                ~10s total, zero verbal exchange
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy guarantees */}
      <section className="px-6 sm:px-12 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--line)] border hairline rounded-sm overflow-hidden">
          {guarantees.map((g) => (
            <div key={g.jp} className="bg-[var(--bg)] px-5 py-6">
              <p className="font-jp text-2xl text-[var(--seal)] mb-3">{g.jp}</p>
              <p className="text-sm font-medium mb-1">{g.en}</p>
              <p className="font-mono text-[9px] faint leading-relaxed">
                {g.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 sm:px-12 pb-24 text-center max-w-5xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-widest faint mb-8">
          try it
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/consent"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-all duration-500"
          >
            Generate a pass
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 7H13M13 7L7 1M13 7L7 13"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </Link>
          <Link
            href="/consent/scan"
            className="inline-flex items-center gap-3 px-8 py-4 border hairline rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--paper)] transition-colors"
          >
            Merchant verify →
          </Link>
        </div>
      </section>

      <footer className="border-t hairline px-8 py-5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          pickless.ai · consent protocol
        </span>
        <span className="font-jp text-sm text-[var(--seal)]">承</span>
      </footer>
    </main>
  );
}
