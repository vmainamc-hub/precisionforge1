// Phase 7 — Conformal Prediction Wrapper
// Provides finite-sample valid prediction intervals over model win-probability estimates.

import { listParityJournal, type ParityJournalEntry } from "./journal";

export interface ConformalReport {
  pointEstimate: number; // 0..1
  intervalLow: number; // 0..1
  intervalHigh: number; // 0..1
  coverageTarget: number; // e.g. 0.90 (1 - alpha)
  width: number; // intervalHigh - intervalLow
  downgraded: boolean; // true if width > 0.18
  sampleSize: number;
  narrative: string;
}

const ALPHA = 0.1; // 90% target coverage
const WIDTH_THRESHOLD = 0.18; // if width > 0.18, downgrade

export function computeConformalInterval(
  pointEstimate: number,
  market: string = "default",
  entries: ParityJournalEntry[] = listParityJournal(),
): ConformalReport {
  const p = Math.max(0.01, Math.min(0.99, pointEstimate));
  const decided = entries.filter((e) => e.outcome === "win" || e.outcome === "loss");

  if (decided.length < 15) {
    // Cold start conservative fallback: Wilson score interval heuristic
    const halfWidth = 0.12;
    const intervalLow = Math.max(0, p - halfWidth);
    const intervalHigh = Math.min(1, p + halfWidth);
    const width = intervalHigh - intervalLow;
    return {
      pointEstimate: p,
      intervalLow,
      intervalHigh,
      coverageTarget: 1 - ALPHA,
      width,
      downgraded: width > WIDTH_THRESHOLD,
      sampleSize: decided.length,
      narrative: `Conformal calibration cold-start (N=${decided.length}/15). Defaulting to conservative ±${(halfWidth * 100).toFixed(0)}% tolerance interval.`,
    };
  }

  // Compute nonconformity scores: s_i = |y_i - p_i|
  const scores: number[] = decided.map((e) => {
    const y = e.outcome === "win" ? 1.0 : 0.0;
    return Math.abs(y - e.pModel);
  });

  scores.sort((a, b) => a - b);

  // Compute (1 - alpha) * (1 + 1/n) quantile
  const n = scores.length;
  const quantileIdx = Math.min(n - 1, Math.max(0, Math.ceil((1 - ALPHA) * (n + 1)) - 1));
  const qHat = scores[quantileIdx];

  const intervalLow = Math.max(0, p - qHat);
  const intervalHigh = Math.min(1, p + qHat);
  const width = intervalHigh - intervalLow;
  const downgraded = width > WIDTH_THRESHOLD;

  const narrative = `Conformal 90% coverage interval [${(intervalLow * 100).toFixed(1)}% - ${(intervalHigh * 100).toFixed(1)}%] (width ${(width * 100).toFixed(1)}%, q̂=${qHat.toFixed(3)}, N=${n}). ${
    downgraded
      ? `High conformal uncertainty (width > ${(WIDTH_THRESHOLD * 100).toFixed(0)}%): Intelligence grade downgraded 1 level and runs capped at 1.`
      : `Interval within tight precision threshold.`
  }`;

  return {
    pointEstimate: p,
    intervalLow,
    intervalHigh,
    coverageTarget: 1 - ALPHA,
    width,
    downgraded,
    sampleSize: n,
    narrative,
  };
}
