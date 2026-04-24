"use client";
import { useEffect, useState } from "react";

type BIPE = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPE | null>(null);
  const [hidden, setHidden] = useState(false);
  const [iosLike, setIosLike] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pickless_install_dismissed") === "1") {
      setHidden(true);
      return;
    }
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setHidden(true);
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && !/(android)/.test(ua);
    if (isIOS) setIosLike(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPE);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setHidden(true);
    localStorage.setItem("pickless_install_dismissed", "1");
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    dismiss();
  }

  if (hidden) return null;
  if (!evt && !iosLike) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 rise">
      <div className="bg-[var(--bg)] border hairline rounded-sm p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-sm bg-[var(--seal)] flex items-center justify-center text-[var(--bg)] font-jp text-xl shrink-0">
            食
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base tracking-tight mb-0.5">
              Install <em>Pickless</em>
            </p>
            <p className="font-mono text-[10px] uppercase tracking-widest faint">
              {iosLike
                ? "tap share → add to home screen"
                : "one tap · home screen + dock"}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="font-mono text-[10px] uppercase tracking-widest faint hover:text-[var(--ink)] transition-colors shrink-0"
            aria-label="dismiss"
          >
            ✕
          </button>
        </div>
        {!iosLike && evt && (
          <button
            onClick={install}
            className="mt-3 w-full py-2.5 bg-[var(--ink)] text-[var(--bg)] rounded-sm font-mono text-[11px] uppercase tracking-widest hover:bg-[var(--seal)] transition-colors"
          >
            Install →
          </button>
        )}
      </div>
    </div>
  );
}
