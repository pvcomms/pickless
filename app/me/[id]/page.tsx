"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Hanko } from "@/components/Hanko";
import { setUserId } from "@/lib/userId";
import { pullCloud, writeLocal } from "@/lib/cloudSync";
import type { CloudSnapshot } from "@/app/api/sync/route";

export default function ClaimTaste() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || "").toLowerCase();
  const [snap, setSnap] = useState<CloudSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "found" | "missing">(
    "loading",
  );

  useEffect(() => {
    if (!id || !/^[a-z0-9]{4,32}$/.test(id)) {
      setState("missing");
      return;
    }
    void (async () => {
      const remote = await pullCloud(id);
      if (remote) {
        setSnap(remote);
        setState("found");
      } else {
        setState("missing");
      }
    })();
  }, [id]);

  function claim() {
    if (!snap) return;
    setUserId(id);
    writeLocal(snap);
    router.push("/app");
  }

  const lovedCount = snap?.loved?.length || 0;
  const historyCount = snap?.history?.length || 0;

  return (
    <main className="min-h-screen text-[var(--ink)] flex flex-col">
      <nav className="px-8 sm:px-12 py-6 flex items-center justify-between border-b hairline">
        <Link href="/" className="font-display text-lg tracking-tight">
          pickless<span className="text-[var(--seal)]">.ai</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest faint">
          taste · portable
        </span>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 max-w-2xl mx-auto w-full text-center">
        <Hanko size={56} label="味" />

        {state === "loading" && (
          <p className="mt-10 font-mono text-[10px] uppercase tracking-widest faint">
            loading taste · {id}
          </p>
        )}

        {state === "missing" && (
          <>
            <p className="mt-10 font-display text-3xl tracking-tight">
              No taste lives at <em>{id}</em>.
            </p>
            <p className="mt-4 faint text-sm">
              Either the link is wrong, or the profile expired.
            </p>
            <Link
              href="/app?guest=1"
              className="mt-10 px-10 py-5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
            >
              Start fresh
            </Link>
          </>
        )}

        {state === "found" && snap && (
          <>
            <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-[var(--seal)]">
              ● Taste profile · {id}
            </p>
            <p className="mt-4 font-display text-3xl sm:text-4xl tracking-tight max-w-md leading-tight">
              Bring this <em className="text-[var(--seal)]">taste</em> to this
              device.
            </p>

            <div className="mt-10 w-full max-w-sm grid grid-cols-2 gap-px bg-[var(--line)] border hairline text-left">
              <Stat k="Loves" v={lovedCount > 0 ? `${lovedCount}` : "—"} />
              <Stat
                k="Past picks"
                v={historyCount > 0 ? `${historyCount}` : "—"}
              />
              <Stat k="Diet" v={snap.prefs?.diet || "any"} />
              <Stat
                k="Budget"
                v={snap.prefs?.budgetMax ? `≤ ₹${snap.prefs.budgetMax}` : "—"}
              />
              <Stat
                k="Synced"
                v={
                  snap.updatedAt
                    ? new Date(snap.updatedAt).toLocaleDateString()
                    : "—"
                }
              />
              <Stat
                k="Cuisines"
                v={
                  snap.prefs?.cuisines?.length
                    ? `${snap.prefs.cuisines.length}`
                    : "—"
                }
              />
            </div>

            {lovedCount > 0 && (
              <div className="mt-8 max-w-md text-left w-full">
                <p className="font-mono text-[10px] uppercase tracking-widest faint mb-3">
                  Top loves
                </p>
                <div className="space-y-px bg-[var(--line)]">
                  {snap.loved!.slice(0, 4).map((l: any, i: number) => (
                    <div
                      key={i}
                      className="bg-[var(--bg)] py-2.5 px-3 flex justify-between items-baseline gap-3"
                    >
                      <span className="font-display text-base tracking-tight truncate">
                        {l.dish}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest faint truncate">
                        {l.restaurant}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={claim}
              className="mt-10 px-10 py-5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-xs uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
            >
              Use this taste here
            </button>

            <p className="mt-4 font-mono text-[9px] uppercase tracking-widest faint max-w-md">
              your taste lives in one place · this device becomes another window
              into it
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-[var(--bg)] py-3 px-4">
      <p className="font-mono text-[9px] uppercase tracking-widest faint mb-1">
        {k}
      </p>
      <p className="font-display text-base tracking-tight">{v}</p>
    </div>
  );
}
