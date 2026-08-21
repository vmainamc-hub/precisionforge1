import { useEffect, useRef } from "react";

// Shared AudioContext + gesture unlock so the alert survives browser autoplay
// policies. Any pointer/keyboard interaction anywhere in the app primes audio.
let sharedCtx: AudioContext | null = null;
let unlocked = false;
const pending: Array<() => void> = [];

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedCtx) return sharedCtx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  try {
    sharedCtx = new AC();
  } catch {
    return null;
  }
  return sharedCtx;
}

function unlock() {
  const ctx = ensureCtx();
  if (!ctx) return;
  const finish = () => {
    if (unlocked) return;
    unlocked = true;
    while (pending.length) pending.shift()!();
  };
  if (ctx.state === "suspended") ctx.resume().then(finish).catch(finish);
  else finish();
}

if (typeof window !== "undefined") {
  const kick = () => unlock();
  window.addEventListener("pointerdown", kick, { passive: true });
  window.addEventListener("keydown", kick);
  window.addEventListener("touchstart", kick, { passive: true });
}

function playBeep() {
  const ctx = ensureCtx();
  if (!ctx) return;
  const emit = () => {
    const now = ctx.currentTime;
    const play = (freq: number, start: number, dur = 0.2) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    };
    play(880, 0);
    play(1320, 0.2);
    play(1760, 0.4, 0.24);
  };
  if (!unlocked || ctx.state === "suspended") {
    pending.push(emit);
    ctx.resume().catch(() => {});
    return;
  }
  emit();
}

/** Play a two-tone alert whenever `triggerKey` changes (skips first mount). */
export function useAlertSound(triggerKey: string, enabled = true) {
  const prevKey = useRef<string>("");
  const armed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!armed.current) {
      armed.current = true;
      prevKey.current = triggerKey;
      return;
    }
    if (!triggerKey || triggerKey === prevKey.current) return;
    prevKey.current = triggerKey;
    try {
      playBeep();
    } catch {}
  }, [triggerKey, enabled]);
}
