// Two-tone Web Audio chime for new precision signals. No external audio file.
export function playPrecisionAlert() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    function tone(freq: number, startTime: number, duration: number, gain: number) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    const now = ctx.currentTime;
    tone(880, now, 0.18, 0.3);
    tone(1108.73, now + 0.2, 0.25, 0.2);

    setTimeout(() => ctx.close(), 600);
  } catch {
    // AudioContext blocked (no user interaction yet) — fail silently.
  }
}
