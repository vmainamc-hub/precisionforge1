// SIGNAL QUALITY METRICS — the numbers behind the operator's Edge,
// Manipulation, Fluctuation and Persistence settings. Pure functions only:
// every gate that uses them lives in veto.ts.
import type { EquilibriumReading } from "./equilibrium";
import type { SimResult } from "./simulator";
import { digitRoleStats } from "@/lib/digit-roles";
import { readEdgeBalance, type EdgeBalanceReading } from "./edges";
import type { BotSignalConfig } from "./config";

export interface QualityMetrics {
  /** 0-100 distribution-anomaly score. Higher = more manipulated tape. */
  manipulation: number;
  /** Realised edge per bot trade, in percent of stake. */
  edgePct: number;
  /** 0..1 disagreement between measurement windows. Higher = noisier. */
  fluctuation: number;
  /** Raw pp spread of Over-4% across measured windows. */
  fluctuationSpreadPp: number;
  /** Longest simulated winning run on the canonical window. */
  persistence: number;
  /** PRIMARY LAW 2 — balance between the 0/1 and 8/9 edges. */
  edgeBalance: EdgeBalanceReading;
}

/**
 * Distribution anomaly, 0-100. Chi-square of the digit histogram against a
 * uniform expectation, plus a zone-alternation-collapse term.
 */
export function manipulationScore(digits: number[]): number {
  const n = digits.length;
  if (n < 50) return 0;
  const freq = new Array(10).fill(0);
  digits.forEach((d) => freq[d]++);
  const exp = n / 10;
  let chi2 = 0;
  for (const c of freq) chi2 += ((c - exp) * (c - exp)) / exp;
  // df = 9 → chi2 ≈ 9 under randomness, ≥ 27 is a strong anomaly.
  const chiTerm = clamp01((chi2 - 9) / 18);

  let flips = 0;
  for (let i = 1; i < n; i++) if (digits[i] >= 5 !== digits[i - 1] >= 5) flips++;
  const alternation = flips / Math.max(1, n - 1);
  const collapse = clamp01(Math.abs(alternation - 0.5) * 4);

  return Math.round(clamp01(chiTerm * 0.7 + collapse * 0.3) * 100);
}

/** Realised edge per trade, in percent of stake, from the canonical replay. */
export function edgePct(sim: SimResult | null): number {
  if (!sim || sim.trades <= 0) return 0;
  return sim.expectancy * 100;
}

/**
 * Fluctuation: how much the Equilibrium reading disagrees across the measured
 * windows. 0 = every window agrees, 1 = 5pp or more of spread.
 */
export function fluctuationOf(eq: EquilibriumReading): {
  fluctuation: number;
  spreadPp: number;
} {
  // Only windows with enough samples to be meaningful. A 200-tick window has a
  // ~3.5pp standard error on its own, so including it made "disagreement"
  // mostly sampling noise and blocked healthy tapes.
  const measured = eq.windows.filter((w) => w.samples >= 500);
  if (measured.length < 2) return { fluctuation: 0, spreadPp: 0 };
  const values = measured.map((w) => w.over4Pct);
  const spreadPp = Math.max(...values) - Math.min(...values);
  return { fluctuation: clamp01(spreadPp / 5), spreadPp };
}

export function computeQuality(
  digits: number[],
  eq: EquilibriumReading,
  canonicalSim: SimResult | null,
  cfg: BotSignalConfig,
): QualityMetrics {
  const { fluctuation, spreadPp } = fluctuationOf(eq);
  return {
    manipulation: manipulationScore(digits),
    edgePct: edgePct(canonicalSim),
    fluctuation,
    fluctuationSpreadPp: spreadPp,
    persistence: canonicalSim?.longestWinStreak ?? 0,
    edgeBalance: readEdgeBalance(digits, cfg.maxEdgeImbalance, cfg.edgeEMax),
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
