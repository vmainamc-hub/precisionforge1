// §17 / §111 Confidence Calibration — Precision Edge side.
//
// Reads outcomes from the edge journal and returns a per-market confidence
// multiplier bounded to ±15 points. Applied inside verdict.confidence
// post-processing — never rewrites core scoring.

import { listJournal, type JournalEntry } from "./journal";

export interface CalibrationResult {
  /** Multiplicative-style additive delta to apply to confidence, bounded ±15. */
  delta: number;
  /** Number of decided samples used. */
  sampleSize: number;
  /** Realised hit-rate for the market. */
  hitRate: number;
  /** Model's mean confidence for the market at publish time (0..1). */
  meanConfidence: number;
  /** Reason string suitable for a supports / narrative line. */
  narrative: string;
}

const MIN_SAMPLES = 15;
const CAP = 15;

/**
 * Compute the calibration delta (±CAP) for a specific market.
 * If there aren't enough samples, returns delta=0.
 */
export function calibrationForMarket(
  market: string,
  entries: JournalEntry[] = listJournal(),
): CalibrationResult {
  const decided = entries.filter(
    (e) => e.market === market && (e.outcome === "win" || e.outcome === "loss"),
  );
  if (decided.length < MIN_SAMPLES) {
    return {
      delta: 0,
      sampleSize: decided.length,
      hitRate: 0,
      meanConfidence: 0,
      narrative: `Calibration inactive (${decided.length}/${MIN_SAMPLES} decided).`,
    };
  }
  const wins = decided.filter((e) => e.outcome === "win").length;
  const hit = wins / decided.length;
  const meanConf = decided.reduce((a, e) => a + e.confidence / 100, 0) / decided.length;
  // Gap = realised - claimed.  Positive gap → we're under-confident; boost.
  const gap = hit - meanConf;
  // Scale gap into ±CAP. The 40× factor makes a 25-pp gap saturate the cap.
  const delta = Math.max(-CAP, Math.min(CAP, gap * 40));
  const narrative =
    Math.abs(delta) < 1
      ? `Confidence well-calibrated on ${market} (Δ ${delta.toFixed(1)}).`
      : delta > 0
        ? `Boost +${delta.toFixed(1)} — realised hit ${(hit * 100).toFixed(0)}% > mean claim ${(meanConf * 100).toFixed(0)}%.`
        : `Dampen ${delta.toFixed(1)} — realised hit ${(hit * 100).toFixed(0)}% < mean claim ${(meanConf * 100).toFixed(0)}%.`;
  return { delta, sampleSize: decided.length, hitRate: hit, meanConfidence: meanConf, narrative };
}

/**
 * Post-process a claimed confidence (0..100) through the market calibration
 * delta. Bounded to [0, 100].
 */
export function calibrateConfidence(
  claimed: number,
  market: string,
  entries?: JournalEntry[],
): { calibrated: number; result: CalibrationResult } {
  const result = calibrationForMarket(market, entries);
  const calibrated = Math.max(0, Math.min(100, claimed + result.delta));
  return { calibrated, result };
}
