// WebAudio sound engine — synthesised, no assets.
// Ported from Patil Eats. Soft, restrained, ritual-feeling.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envGain(c: AudioContext, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  const now = c.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  return g;
}

function muted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return JSON.parse(localStorage.getItem("pickless_muted") || "false");
  } catch {
    return false;
  }
}

export const sfx = {
  muted,
  setMuted(v: boolean) {
    try {
      localStorage.setItem("pickless_muted", JSON.stringify(!!v));
    } catch {}
  },

  // soft "thunk" for reel landing
  thunk() {
    if (muted()) return;
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    [80, 140].forEach((freq, i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.setValueAtTime(freq * 1.4, t0);
      o.frequency.exponentialRampToValueAtTime(freq, t0 + 0.12);
      const g = envGain(c, 0.35 - i * 0.1, 0.005, 0.22);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.3);
    });
    const buf = c.createBuffer(1, 0.04 * c.sampleRate, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.2));
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 2200;
    const g = c.createGain();
    g.gain.value = 0.2;
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t0);
  },

  // ticking step during spin
  tick() {
    if (muted()) return;
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = 1800;
    const g = envGain(c, 0.025, 0.002, 0.04);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.06);
  },

  // bell for reveal
  bell() {
    if (muted()) return;
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = envGain(c, 0.12 - i * 0.03, 0.01, 1.2 + i * 0.2);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 1.6);
    });
  },

  // soft pop for mood chip tap
  pop() {
    if (muted()) return;
    const c = getCtx();
    if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.06);
    const g = envGain(c, 0.08, 0.005, 0.08);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.15);
  },
};

// Daily streak — tracks consecutive days with at least one Feed Me action.
export const streak = {
  read(): number {
    if (typeof window === "undefined") return 0;
    try {
      return JSON.parse(localStorage.getItem("pickless_streak") || "0");
    } catch {
      return 0;
    }
  },
  bump(): number {
    if (typeof window === "undefined") return 0;
    const today = new Date().toDateString();
    const last = localStorage.getItem("pickless_streak_last");
    const cur = streak.read();
    if (last === today) return cur;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const next = last === yesterday ? cur + 1 : 1;
    localStorage.setItem("pickless_streak", String(next));
    localStorage.setItem("pickless_streak_last", today);
    return next;
  },
};
