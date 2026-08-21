// BALANCED EDGES ENGINE — the second Primary Law of the signal doctrine.
//
// The "edges" of the digit distribution are the two extreme pairs:
//
//   LOW EDGE  = digits 0 and 1
//   HIGH EDGE = digits 8 and 9
//
// Under a fair tape each pair holds 20% of the window, so together they hold
// 40%. A tape is *edge-balanced* when the two pairs sit on top of each other:
//
//   imbalance = |LowEdge% - HighEdge%|
//
// Imbalance is what breaks martingale recovery: if one edge is starving while
// the other is feeding, the barrier ladder is being fed a one-sided tape even
// when the Over-4 / Under-5 split looks perfectly centred. Equilibrium alone
// cannot see this — the pairs can cancel out inside the 50/50 split — which is
// why edge balance is measured and gated separately.
//
// Pure functions only. Every gate that consumes this lives in veto.ts.

export type EdgeBand = "PERFECT" | "PRIME" | "ACCEPTABLE" | "SKEWED" | "BROKEN";

export interface EdgeBalanceReading {
  /** Window actually measured. */
  samples: number;
  /** Percentage of the window held by digits 0 and 1. */
  lowPct: number;
  /** Percentage of the window held by digits 8 and 9. */
  highPct: number;
  /** lowPct + highPct. Fair value is 40%. */
  totalPct: number;
  /** |lowPct - highPct| in percentage points. THE gated number. */
  imbalancePp: number;
  /** |totalPct - 40| in percentage points — edges collectively over/under-fed. */
  massErrorPp: number;
  /** Which edge is heavier. */
  heavySide: "LOW" | "HIGH" | "EVEN";
  band: EdgeBand;
  /** 0-100. 100 = the two edges are identical. */
  score: number;
}

export const EDGE_LOW_DIGITS = [0, 1] as const;
export const EDGE_HIGH_DIGITS = [8, 9] as const;

/** Percentage of a digit window held by a set of digits. */
function pctOf(digits: number[], members: readonly number[]): number {
  if (!digits.length) return 0;
  let n = 0;
  for (const d of digits) if (members.includes(d)) n++;
  return (n / digits.length) * 100;
}

export function edgeBand(imbalancePp: number, tolerance: number): EdgeBand {
  if (imbalancePp <= tolerance) return "PERFECT";
  if (imbalancePp <= tolerance * 2) return "PRIME";
  if (imbalancePp <= tolerance * 3.5) return "ACCEPTABLE";
  if (imbalancePp <= tolerance * 6) return "SKEWED";
  return "BROKEN";
}

export function edgeBalanceScore(imbalancePp: number, massErrorPp: number, eMax: number): number {
  const e = Math.max(0, imbalancePp) + Math.max(0, massErrorPp) * 0.35;
  return Math.round(100 * Math.max(0, Math.min(1, 1 - e / Math.max(1e-9, eMax))));
}

/**
 * Full balanced-edges reading over a digit window.
 * @param tolerance pp of |low - high| that still counts as balanced.
 * @param eMax pp of combined error at which the score hits 0.
 */
export function readEdgeBalance(
  digits: number[],
  tolerance: number,
  eMax: number,
): EdgeBalanceReading {
  const lowPct = pctOf(digits, EDGE_LOW_DIGITS);
  const highPct = pctOf(digits, EDGE_HIGH_DIGITS);
  const totalPct = lowPct + highPct;
  const imbalancePp = Math.abs(lowPct - highPct);
  const massErrorPp = Math.abs(totalPct - 40);
  const delta = lowPct - highPct;

  return {
    samples: digits.length,
    lowPct,
    highPct,
    totalPct,
    imbalancePp,
    massErrorPp,
    heavySide: delta > tolerance / 2 ? "LOW" : delta < -tolerance / 2 ? "HIGH" : "EVEN",
    band: edgeBand(imbalancePp, tolerance),
    score: edgeBalanceScore(imbalancePp, massErrorPp, eMax),
  };
}

/** Human one-liner used by narratives and readiness blockers. */
export function describeEdgeBalance(e: EdgeBalanceReading): string {
  return `Edges 0/1 = ${e.lowPct.toFixed(2)}% vs 8/9 = ${e.highPct.toFixed(2)}% (imbalance ${e.imbalancePp.toFixed(2)}pp, ${e.band})`;
}
