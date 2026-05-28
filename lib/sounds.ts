/**
 * Tiny synthesized UI sounds via the Web Audio API — no audio files to ship.
 * Sounds are short + subtle. Browsers block audio until a user gesture, so the
 * context is created/resumed lazily; if it's still blocked the call is a no-op.
 */
type WindowWithWebkit = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Schedule one note with a quick attack/decay envelope. */
function note(
  c: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  type: OscillatorType = "sine",
  peak = 0.14,
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Subtle two-note "ping" — a new order arrived. */
export function playNewOrder() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 880, t, 0.16, "sine", 0.12);
  note(c, 1318.5, t + 0.12, 0.2, "sine", 0.12);
}

/** Bright rising triad — "cha-ching", delivery complete. */
export function playChaChing() {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  note(c, 659.25, t, 0.12, "triangle", 0.13);
  note(c, 987.77, t + 0.09, 0.12, "triangle", 0.13);
  note(c, 1318.51, t + 0.18, 0.32, "triangle", 0.16);
}

/** Haptic buzz, where supported (mobile). */
export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}
