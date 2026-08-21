// §56 Signal Frequency Management.
//
// Applies three rules to any candidate publication:
//   1. Cooldown after last published signal per market
//   2. Minimum-hold-through-tick counter (candidate must persist ≥ N ticks)
//   3. Per-hour signal budget (global)
//
// Pure functions over an explicit `SignalFrequencyState`. The scan hook holds
// one state per session and calls `evaluateCandidate` before publishing.

export interface SignalFrequencyConfig {
  /** Cooldown per market in ms. */
  cooldownMs: number;
  /** Minimum consecutive ticks a candidate must persist before publish. */
  minHoldTicks: number;
  /** Maximum signals published per rolling 60-minute window. */
  hourlyBudget: number;
}

export const DEFAULT_FREQUENCY_CONFIG: SignalFrequencyConfig = {
  cooldownMs: 90_000,
  minHoldTicks: 3,
  hourlyBudget: 12,
};

export interface SignalFrequencyState {
  /** Last published timestamp per market. */
  lastPublished: Record<string, number>;
  /** Rolling hold counters keyed by `${market}|${contract}`. */
  hold: Record<string, number>;
  /** Timestamps (ms) of published signals within the trailing hour. */
  publishedTs: number[];
}

export function createFrequencyState(): SignalFrequencyState {
  return { lastPublished: {}, hold: {}, publishedTs: [] };
}

export interface FrequencyDecision {
  allow: boolean;
  reason: string;
  /** Suggested next state (immutable-update style). */
  next: SignalFrequencyState;
}

export interface Candidate {
  market: string;
  contract: string;
  now?: number;
}

/**
 * Called every tick with the currently-preferred candidate (or null if the
 * scan has no candidate this tick). Returns whether to publish now, plus the
 * next state to store.
 */
export function evaluateCandidate(
  state: SignalFrequencyState,
  candidate: Candidate | null,
  cfg: SignalFrequencyConfig = DEFAULT_FREQUENCY_CONFIG,
): FrequencyDecision {
  const now = candidate?.now ?? Date.now();
  // Purge old publishedTs entries (> 1h).
  const publishedTs = state.publishedTs.filter((t) => now - t <= 3_600_000);
  // Decay hold counters for keys that aren't the current candidate.
  const hold: Record<string, number> = {};
  if (candidate) {
    const key = `${candidate.market}|${candidate.contract}`;
    hold[key] = (state.hold[key] ?? 0) + 1;
  }
  const nextBase: SignalFrequencyState = {
    lastPublished: { ...state.lastPublished },
    hold,
    publishedTs,
  };

  if (!candidate) {
    return { allow: false, reason: "no candidate this tick", next: nextBase };
  }

  const key = `${candidate.market}|${candidate.contract}`;
  const holdCount = hold[key];

  // Rule 1: cooldown per market.
  const last = state.lastPublished[candidate.market] ?? 0;
  if (now - last < cfg.cooldownMs) {
    const remaining = Math.round((cfg.cooldownMs - (now - last)) / 1000);
    return {
      allow: false,
      reason: `market cooldown (${remaining}s remaining)`,
      next: nextBase,
    };
  }
  // Rule 2: minimum-hold ticks.
  if (holdCount < cfg.minHoldTicks) {
    return {
      allow: false,
      reason: `held ${holdCount}/${cfg.minHoldTicks} ticks`,
      next: nextBase,
    };
  }
  // Rule 3: hourly budget.
  if (publishedTs.length >= cfg.hourlyBudget) {
    return {
      allow: false,
      reason: `hourly budget exhausted (${publishedTs.length}/${cfg.hourlyBudget})`,
      next: nextBase,
    };
  }
  // Green light — record publication in the next state.
  const nextAllowed: SignalFrequencyState = {
    lastPublished: { ...state.lastPublished, [candidate.market]: now },
    hold: { ...hold, [key]: 0 },
    publishedTs: [...publishedTs, now],
  };
  return { allow: true, reason: "cleared", next: nextAllowed };
}
