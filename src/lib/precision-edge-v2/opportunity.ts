// Precision Edge V3.5 — Opportunity, Quality, Persistence & Recovery layer.
//
// Runs AFTER contract verdicts are computed and the Analyst has published.
// This layer:
//
//   1. Assigns a Signal Quality tier ( Premium / Standard / Developing )
//      per the V3.5 spec — replacing the binary READY/WATCH mental model
//      without changing the underlying state machine.
//
//   2. Estimates DBot Execution Persistence — will the signal still be
//      valid ~30-90 seconds later when the user's DBot actually enters?
//
//   3. Computes Recovery Compatibility — the classic Deriv martingale-style
//      pairs (UNDER 7 → UNDER 5, OVER 2 → OVER 5) and confirms the recovery
//      contract still has structural support if the first trade loses.
//
// This module is PURELY ADDITIVE. It never mutates the verdict's state or
// confidence; it attaches supplementary metadata that the UI can show.

import type { ContractId, ContractVerdict, DigitStatistics, MarketPsychology } from "./types";

// ── Signal Quality ───────────────────────────────────────────────────────
export type QualityTier = "PREMIUM" | "STANDARD" | "DEVELOPING" | "NONE";

export interface SignalQuality {
  tier: QualityTier;
  symbol: "⭐" | "✅" | "👀" | "";
  label: string;
  detail: string;
}

export function classifyQuality(
  v: ContractVerdict,
  hypothesisAlignmentScore: number,
): SignalQuality {
  // Premium: READY + strong confidence + hypothesis alignment ≥ 0.55.
  if (v.state === "READY" && v.confidence >= 82 && hypothesisAlignmentScore >= 0.55) {
    return {
      tier: "PREMIUM",
      symbol: "⭐",
      label: "Premium Setup",
      detail:
        "Strong structural psychology and high hypothesis agreement — suitable for normal DBot operation.",
    };
  }
  // Standard: READY with minor secondary disagreements.
  if (v.state === "READY") {
    return {
      tier: "STANDARD",
      symbol: "✅",
      label: "Standard Setup",
      detail: "Good structural psychology with minor secondary disagreements — still tradable.",
    };
  }
  // Developing: WATCH / BUILDING with net-positive hypothesis alignment.
  if ((v.state === "WATCH" || v.state === "BUILDING") && hypothesisAlignmentScore > 0.1) {
    return {
      tier: "DEVELOPING",
      symbol: "👀",
      label: "Developing Setup",
      detail: "Market is evolving toward a Premium setup — observe, do not enter yet.",
    };
  }
  return { tier: "NONE", symbol: "", label: "", detail: "" };
}

// ── DBot Execution Persistence ──────────────────────────────────────────
// The user needs a signal to remain valid long enough to switch device →
// open DBot → load bot → run ≥ 3 entries. Estimate that window.

export interface PersistenceForecast {
  /** Expected number of ticks the setup should remain valid. */
  expectedTicks: number;
  /** Rough survival probability across the next ~30s / 60s / 90s. */
  survival30s: number;
  survival60s: number;
  survival90s: number;
  /** Human summary. */
  narrative: string;
}

export function forecastPersistence(
  v: ContractVerdict,
  psy: MarketPsychology,
  fluctuation: number,
): PersistenceForecast {
  // Base persistence from the trailing streak, plus momentum and health minus
  // fluctuation and manipulation. Cap between 3 and 60 ticks.
  const base = v.persistenceTicks;
  const health = psy.health / 100;
  const noise = fluctuation + psy.manipulation / 100;
  const momentumBoost = Math.max(-1, Math.min(1, v.momentum * 25));
  const expected = Math.max(
    3,
    Math.min(60, base * 3 + health * 15 + momentumBoost * 6 - noise * 18),
  );

  // Rough exponential decay: at each tick, chance of the story surviving.
  // Deriv Volatility 1s indices tick ~1/s; other markets ~1/2s. Use average.
  const halfLife = Math.max(4, expected);
  const decay = (seconds: number) =>
    Math.max(0.05, Math.min(0.99, Math.pow(0.5, seconds / halfLife)));

  const narrative =
    expected >= 30
      ? `Structure should remain valid ~${expected.toFixed(0)} ticks — comfortable for DBot execution.`
      : expected >= 15
        ? `Structure should hold ~${expected.toFixed(0)} ticks — enter promptly.`
        : `Structure fragile (~${expected.toFixed(0)} ticks) — may not survive DBot startup delay.`;

  return {
    expectedTicks: Math.round(expected),
    survival30s: decay(30),
    survival60s: decay(60),
    survival90s: decay(90),
    narrative,
  };
}

// ── Recovery Compatibility ──────────────────────────────────────────────
// Classic Deriv digit-recovery pairs:
//   OVER 1 → recovery OVER 3
//   OVER 2 → recovery OVER 5     (spec)
//   OVER 3 → recovery OVER 5
//   UNDER 8 → recovery UNDER 6
//   UNDER 7 → recovery UNDER 5   (spec)
//   UNDER 6 → recovery UNDER 5

const RECOVERY_MAP: Record<
  ContractId,
  { side: "OVER" | "UNDER"; barrier: number; winners: number[]; label: string }
> = {
  OVER1: { side: "OVER", barrier: 3, winners: [4, 5, 6, 7, 8, 9], label: "Over 3" },
  OVER2: { side: "OVER", barrier: 5, winners: [6, 7, 8, 9], label: "Over 5" },
  OVER3: { side: "OVER", barrier: 5, winners: [6, 7, 8, 9], label: "Over 5" },
  UNDER8: { side: "UNDER", barrier: 6, winners: [0, 1, 2, 3, 4, 5], label: "Under 6" },
  UNDER7: { side: "UNDER", barrier: 5, winners: [0, 1, 2, 3, 4], label: "Under 5" },
  UNDER6: { side: "UNDER", barrier: 5, winners: [0, 1, 2, 3, 4], label: "Under 5" },
};

export interface RecoveryPlan {
  contract: ContractId;
  recoveryLabel: string;
  /** Empirical win-rate of the recovery contract in the same window. */
  recoveryWinRate: number;
  /** Recovery edge over fair (winners/10). */
  recoveryEdge: number;
  compatible: boolean;
  narrative: string;
}

export function evaluateRecovery(v: ContractVerdict, stats: DigitStatistics): RecoveryPlan {
  const map = RECOVERY_MAP[v.id];
  const fair = map.winners.length / 10;
  const winRate = map.winners.reduce((a, d) => a + stats.pct[d], 0);
  const edge = winRate - fair;
  const compatible = edge >= 0.005;
  return {
    contract: v.id,
    recoveryLabel: map.label,
    recoveryWinRate: winRate,
    recoveryEdge: edge,
    compatible,
    narrative: compatible
      ? `Recovery ${map.label} viable — winners hold ${(winRate * 100).toFixed(1)}% vs ${(fair * 100).toFixed(0)}% fair.`
      : `Recovery ${map.label} weak — winners only ${(winRate * 100).toFixed(1)}% vs ${(fair * 100).toFixed(0)}% fair; martingale not supported.`,
  };
}
