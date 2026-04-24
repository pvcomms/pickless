"use client";
import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";

type Props = {
  userId: string;
  syncedAt: string | null;
};

export function TasteSyncBadge({ userId, syncedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && userId) {
      setShareUrl(`${window.location.origin}/me/${userId}`);
    }
  }, [userId]);

  if (!userId) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      sfx.pop();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] flex items-center gap-2 transition-colors"
        title="your taste · synced everywhere"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--seal)] pulse-soft inline-block" />
        Taste · {userId.slice(0, 4)}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-80 bg-[var(--bg)] border hairline rounded-sm shadow-2xl p-5 z-50 text-left">
          <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
            ● Your taste · portable
          </p>
          <p className="text-sm leading-snug mb-4">
            One profile. Every device. No platform owns it — you do.
          </p>

          <div className="bg-[var(--paper)] border hairline rounded-sm p-3 mb-3 break-all font-mono text-[10px]">
            {shareUrl}
          </div>

          <div className="flex gap-2">
            <button
              onClick={copy}
              className={`flex-1 font-mono text-[10px] uppercase tracking-widest px-3 py-2 border rounded-sm transition-all ${
                copied
                  ? "border-emerald-500 text-emerald-500"
                  : "hairline faint hover:text-[var(--ink)] hover:border-[var(--ink)]"
              }`}
            >
              {copied ? "✓ copied" : "Copy link"}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener"
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-2 border hairline rounded-sm faint hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
            >
              Open →
            </a>
          </div>

          <p className="mt-4 font-mono text-[9px] uppercase tracking-widest faint">
            {syncedAt
              ? `last sync · ${new Date(syncedAt).toLocaleTimeString()}`
              : "syncing…"}
          </p>
        </div>
      )}
    </div>
  );
}
