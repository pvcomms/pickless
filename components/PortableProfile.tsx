"use client";
import { useRef, useState } from "react";

const SCHEMA = "https://picklessai.vercel.app/schema/portable-profile-v0.1";

type Portable = {
  $schema: string;
  version: "0.1";
  exportedAt: string;
  exportedBy: string;
  prefs: any;
  tasteProfile: any;
  loves: any[];
  pastPicks: any[];
  orders: any[];
  history: any[];
  location: {
    city?: string;
    neighborhood?: string;
    country?: string;
    countryCode?: string;
  };
  connected: string[];
};

function compose(): Portable {
  const get = (k: string) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };
  const loc = get("pickless_location") || {};
  return {
    $schema: SCHEMA,
    version: "0.1",
    exportedAt: new Date().toISOString(),
    exportedBy: "pickless.ai",
    prefs: get("pickless_prefs"),
    tasteProfile: get("pickless_taste_profile"),
    loves: get("pickless_loved") || [],
    pastPicks: get("pickless_history") || [],
    orders: get("pickless_orders") || [],
    history: get("pickless_history") || [],
    location: {
      city: loc.city,
      neighborhood: loc.neighborhood,
      country: loc.country,
      countryCode: loc.countryCode,
    },
    connected: get("pickless_connected") || [],
  };
}

function applyImport(p: Portable) {
  if (p.prefs) localStorage.setItem("pickless_prefs", JSON.stringify(p.prefs));
  if (p.tasteProfile)
    localStorage.setItem(
      "pickless_taste_profile",
      JSON.stringify(p.tasteProfile),
    );
  if (Array.isArray(p.loves) && p.loves.length)
    localStorage.setItem("pickless_loved", JSON.stringify(p.loves));
  const picks = Array.isArray(p.pastPicks)
    ? p.pastPicks
    : Array.isArray(p.history)
      ? p.history
      : [];
  if (picks.length)
    localStorage.setItem("pickless_history", JSON.stringify(picks));
  if (Array.isArray(p.orders) && p.orders.length)
    localStorage.setItem("pickless_orders", JSON.stringify(p.orders));
  if (Array.isArray(p.connected) && p.connected.length)
    localStorage.setItem("pickless_connected", JSON.stringify(p.connected));
  if (p.location?.city) {
    const cur = JSON.parse(localStorage.getItem("pickless_location") || "{}");
    localStorage.setItem(
      "pickless_location",
      JSON.stringify({ ...cur, ...p.location }),
    );
  }
}

export function PortableProfile() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  function exportNow() {
    const p = compose();
    const blob = new Blob([JSON.stringify(p, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pickless-profile-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`exported ${p.orders.length} orders + profile`);
    setTimeout(() => setStatus(null), 3000);
  }

  function viewProfile() {
    const p = compose();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>Your Pickless profile</title>
      <style>body{background:#0f0f0d;color:#eeeae0;font:14px/1.5 'JetBrains Mono',monospace;padding:24px;margin:0}
      pre{white-space:pre-wrap;word-break:break-word;background:#161613;border:1px solid #444;border-radius:4px;padding:20px;}
      h1{font:300 28px/1 serif;margin:0 0 8px;color:#eeeae0}
      .sub{color:#7a7668;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:24px}</style></head>
      <body><h1>Your portable profile</h1>
      <p class="sub">spec: pickless-portable-profile v0.1 · plug-and-play across any agent</p>
      <pre>${JSON.stringify(p, null, 2).replace(/[<&]/g, (c) => ({ "<": "&lt;", "&": "&amp;" })[c]!)}</pre></body></html>`,
    );
    w.document.close();
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result)) as Portable;
        if (
          !p.$schema?.startsWith(
            "https://picklessai.vercel.app/schema/portable-profile",
          )
        ) {
          throw new Error("not a Pickless portable profile");
        }
        applyImport(p);
        setStatus(
          `imported ${p.orders?.length || 0} orders + profile · reloading…`,
        );
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) {
        setStatus(`import failed: ${(e as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mt-12 w-full max-w-md text-left border hairline rounded-sm p-5 bg-[var(--paper)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--seal)] mb-1">
            ● Portable profile
          </p>
          <p className="font-display text-base tracking-tight">
            Your taste, <em>portable</em>.
          </p>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest faint shrink-0">
          v0.1 · open spec
        </span>
      </div>

      <p className="text-xs faint leading-relaxed mb-4">
        MCP/Aadhaar for the cyborg human. Download the JSON, plug it into any
        agent. The platforms can keep selling — you keep your preferences.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={exportNow}
          className="font-mono text-[10px] uppercase tracking-widest px-2 py-2.5 border border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)] rounded-sm hover:bg-[var(--seal)] hover:border-transparent transition-colors"
        >
          Export
        </button>
        <button
          onClick={viewProfile}
          className="font-mono text-[10px] uppercase tracking-widest px-2 py-2.5 border hairline rounded-sm hover:bg-[var(--bg)] transition-colors"
        >
          View JSON
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="font-mono text-[10px] uppercase tracking-widest px-2 py-2.5 border hairline rounded-sm hover:bg-[var(--bg)] transition-colors"
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {status && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-emerald-500">
          ● {status}
        </p>
      )}
    </div>
  );
}
