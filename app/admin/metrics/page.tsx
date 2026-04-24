import Link from "next/link";
import { headers } from "next/headers";
import { readMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Light gate. Two ways through:
//   1. ADMIN_TOKEN env var unset → open (dev / first-run)
//   2. ADMIN_TOKEN set → require ?token=<value> in the URL OR a matching
//      "x-pickless-admin" cookie set via prior visit
async function checkGate(): Promise<{ ok: boolean; reason?: string }> {
  const required = process.env.ADMIN_TOKEN?.trim();
  if (!required) return { ok: true };
  const h = await headers();
  // Read token from cookie set by prior URL hit.
  const cookie = h.get("cookie") || "";
  const match = cookie.match(/pickless_admin=([^;]+)/);
  if (match && decodeURIComponent(match[1]) === required) return { ok: true };
  // Fall through to the URL ?token= check on the page itself (handled below).
  return { ok: false, reason: "missing token" };
}

function pct(n: number | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function relTime(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const required = process.env.ADMIN_TOKEN?.trim();
  // URL token grants access AND should set a cookie via the gate route — but
  // since this is a server component we can only read. The flow:
  //   /admin/metrics?token=XYZ → matches → renders + sets cookie via Set-Cookie
  //   header (using next/headers.cookies()) so the next visit doesn't need the
  //   query string.
  if (required) {
    const urlToken = sp?.token;
    if (urlToken === required) {
      // OK — also persist via a cookie so refresh doesn't lose it.
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.set("pickless_admin", required, {
        httpOnly: true,
        sameSite: "lax",
        path: "/admin",
        maxAge: 60 * 60 * 24 * 30,
      });
    } else {
      const gate = await checkGate();
      if (!gate.ok) {
        return (
          <main className="min-h-screen text-[var(--ink)] flex items-center justify-center px-8">
            <div className="max-w-md text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
                ● admin · gated
              </p>
              <p className="font-display text-3xl tracking-tight">
                Add <em className="text-[var(--seal)]">?token=…</em> to the URL
              </p>
              <p className="mt-4 text-sm faint">
                Set ADMIN_TOKEN in the Pickless env to require a token.
              </p>
            </div>
          </main>
        );
      }
    }
  }

  const rows = await readMetrics();

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      cart: acc.cart + r.cart,
      partial: acc.partial + r.partial,
      manual: acc.manual + r.manual,
      failed: acc.failed + r.failed,
      disconnected: acc.disconnected + r.disconnected,
    }),
    { total: 0, cart: 0, partial: 0, manual: 0, failed: 0, disconnected: 0 },
  );
  const overallSuccess =
    totals.total > 0
      ? (totals.cart + totals.partial) / totals.total
      : undefined;
  const fullSuccess = totals.total > 0 ? totals.cart / totals.total : undefined;

  return (
    <main className="min-h-screen text-[var(--ink)]">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <Link href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          admin · auto-order metrics
        </span>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
          ● live · live KV reads
        </p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight mb-3">
          Auto-order <em className="text-[var(--seal)]">cart-success</em> rates
        </h1>
        <p className="text-sm faint mb-12 max-w-md leading-relaxed">
          Every agent run lands an outcome here. Cart-success = agent confirmed
          the dish made it into the cart (full or partial).
        </p>

        {/* Overall headline */}
        <div className="mb-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--line)] border hairline">
          <Cell k="Total runs" v={totals.total.toString()} />
          <Cell
            k="Cart-success"
            v={pct(overallSuccess)}
            seal={overallSuccess != null && overallSuccess > 0}
          />
          <Cell k="Full cart" v={pct(fullSuccess)} />
          <Cell
            k="Manual / Failed"
            v={`${totals.manual + totals.failed + totals.disconnected}`}
          />
        </div>

        {/* Per-platform breakdown */}
        <p className="font-mono text-[10px] uppercase tracking-widest faint mb-4">
          By platform
        </p>
        {rows.length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-widest faint">
            no runs yet
          </p>
        ) : (
          <div className="bg-[var(--line)] border hairline">
            <div className="grid grid-cols-[1fr_repeat(6,minmax(0,1fr))] gap-px text-[var(--line)]">
              <Header label="Platform" />
              <Header label="Total" />
              <Header label="Cart" />
              <Header label="Partial" />
              <Header label="Manual" />
              <Header label="Failed" />
              <Header label="Last" />
            </div>
            {rows.map((r) => (
              <div
                key={r.platform}
                className="grid grid-cols-[1fr_repeat(6,minmax(0,1fr))] gap-px"
              >
                <Row val={r.platform} bold />
                <Row val={r.total.toString()} />
                <Row val={`${r.cart} (${pct(r.fullCartRate)})`} />
                <Row val={r.partial.toString()} />
                <Row val={r.manual.toString()} />
                <Row val={r.failed.toString()} />
                <Row val={relTime(r.lastOutcomeAt)} />
              </div>
            ))}
          </div>
        )}

        <p className="mt-12 font-mono text-[9px] uppercase tracking-widest faint">
          Tip: visit /admin/metrics any time. No auth — keep this private.
        </p>
      </div>
    </main>
  );
}

function Cell({ k, v, seal }: { k: string; v: string; seal?: boolean }) {
  return (
    <div className="bg-[var(--bg)] py-4 px-4">
      <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
        {k}
      </p>
      <p
        className={`font-display text-2xl tracking-tight ${
          seal ? "text-[var(--seal)]" : ""
        }`}
      >
        {v}
      </p>
    </div>
  );
}

function Header({ label }: { label: string }) {
  return (
    <div className="bg-[var(--paper)] py-2 px-3">
      <span className="font-mono text-[9px] uppercase tracking-widest faint">
        {label}
      </span>
    </div>
  );
}

function Row({ val, bold }: { val: string; bold?: boolean }) {
  return (
    <div className="bg-[var(--bg)] py-2.5 px-3">
      <span
        className={`text-sm ${bold ? "font-display text-base tracking-tight" : "font-mono"}`}
      >
        {val}
      </span>
    </div>
  );
}
