// Precision Parity AI — Confidence Decay Engine.
// Decays signal confidence as ticks elapse without entry execution. Stale signals auto-expire.

export interface SignalDecayResult {
  ticksElapsed: number;
  initialConfidence: number;
  decayedConfidence: number;
  isExpired: boolean;
  decayPenalty: number;
  remainingValidTicks: number;
  status: "FRESH" | "DECAYING" | "EXPIRED";
}

export function runSignalDecayEngine(
  initialConfidence: number,
  ticksElapsed: number,
  maxLifetimeTicks: number = 8,
): SignalDecayResult {
  const isExpired = ticksElapsed >= maxLifetimeTicks;
  // Non-linear exponential decay after tick 2
  const decayRate = 3.5; // points per tick after tick 2
  const effectiveTicks = Math.max(0, ticksElapsed - 1);
  const decayPenalty = Math.round(effectiveTicks * decayRate);
  const decayedConfidence = Math.max(50, initialConfidence - decayPenalty);
  const remainingTicks = Math.max(0, maxLifetimeTicks - ticksElapsed);

  let status: "FRESH" | "DECAYING" | "EXPIRED" = "FRESH";
  if (isExpired) {
    status = "EXPIRED";
  } else if (ticksElapsed >= 2) {
    status = "DECAYING";
  }

  return {
    ticksElapsed,
    initialConfidence,
    decayedConfidence,
    isExpired,
    decayPenalty,
    remainingValidTicks: remainingTicks,
    status,
  };
}
