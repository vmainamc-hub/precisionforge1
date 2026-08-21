// Precision Parity AI — Parity Statistics & Multi-Window Wilson Bounds Engine.
// Truthful measurement: signals only clear when the lower bound clears the required threshold.

import { wilsonScoreInterval, binaryEntropy } from "./wilson";

export interface ParityWindowResult {
  windowSize: number;
  sampleSize: number;
  evenCount: number;
  oddCount: number;
  evenRate: number; // point estimate
  oddRate: number;
  evenWilson: { lower: number; upper: number; margin: number };
  oddWilson: { lower: number; upper: number; margin: number };
  entropy: number; // 0..1
  clearsPayout: boolean;
  favouredSide: "EVEN" | "ODD" | "NEUTRAL";
  edgePp: number; // percentage points above 50% for the favoured side
}

export interface ParityStatsEngineResult {
  windows: Record<number, ParityWindowResult>;
  dominantSide: "EVEN" | "ODD" | "NEUTRAL";
  overallConfidence: number; // 0..100
  lowerBoundPWin: number; // lower bound for dominant side in primary window
  pointEstimatePWin: number;
  primaryWindow: number;
  summary: string;
}

const DEFAULT_WINDOWS = [20, 50, 120, 500] as const;

export function runParityStatsEngine(
  digits: number[],
  requiredPWinHurdle: number = 0.52, // Typical Deriv 0.95 payout requires ~51.28% breakeven
  windows: readonly number[] = DEFAULT_WINDOWS,
): ParityStatsEngineResult {
  const n = digits.length;
  const windowResults: Record<number, ParityWindowResult> = {};

  let weightedEvenScore = 0;
  let totalWeight = 0;

  for (const win of windows) {
    const sample = digits.slice(-win);
    const sampleSize = sample.length;
    if (sampleSize === 0) continue;

    let evenCount = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (sample[i] % 2 === 0) evenCount++;
    }
    const oddCount = sampleSize - evenCount;
    const evenRate = evenCount / sampleSize;
    const oddRate = oddCount / sampleSize;

    const evenWilson = wilsonScoreInterval(evenCount, sampleSize, 0.95);
    const oddWilson = wilsonScoreInterval(oddCount, sampleSize, 0.95);
    const entropy = binaryEntropy(evenRate);

    let favouredSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
    let clearsPayout = false;
    let edgePp = 0;

    if (evenWilson.lower > requiredPWinHurdle) {
      favouredSide = "EVEN";
      clearsPayout = true;
      edgePp = (evenRate - 0.5) * 100;
    } else if (oddWilson.lower > requiredPWinHurdle) {
      favouredSide = "ODD";
      clearsPayout = true;
      edgePp = (oddRate - 0.5) * 100;
    } else if (evenRate > 0.53) {
      favouredSide = "EVEN";
      edgePp = (evenRate - 0.5) * 100;
    } else if (oddRate > 0.53) {
      favouredSide = "ODD";
      edgePp = (oddRate - 0.5) * 100;
    }

    windowResults[win] = {
      windowSize: win,
      sampleSize,
      evenCount,
      oddCount,
      evenRate,
      oddRate,
      evenWilson: { lower: evenWilson.lower, upper: evenWilson.upper, margin: evenWilson.margin },
      oddWilson: { lower: oddWilson.lower, upper: oddWilson.upper, margin: oddWilson.margin },
      entropy,
      clearsPayout,
      favouredSide,
      edgePp,
    };

    // Weight shorter and medium windows more for momentum, longer for stability
    const w = win === 50 ? 3 : win === 120 ? 2.5 : win === 20 ? 1.5 : 1.0;
    const sign = evenRate >= 0.5 ? 1 : -1;
    weightedEvenScore += (evenRate - 0.5) * w;
    totalWeight += w;
  }

  const netLean = totalWeight > 0 ? weightedEvenScore / totalWeight : 0;
  const primaryWin = windowResults[50] ?? windowResults[120] ?? Object.values(windowResults)[0];

  let dominantSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
  let lowerBoundPWin = 0.5;
  let pointEstimatePWin = 0.5;

  if (primaryWin) {
    if (primaryWin.evenRate > primaryWin.oddRate) {
      dominantSide = primaryWin.evenRate >= 0.51 ? "EVEN" : "NEUTRAL";
      pointEstimatePWin = primaryWin.evenRate;
      lowerBoundPWin = primaryWin.evenWilson.lower;
    } else {
      dominantSide = primaryWin.oddRate >= 0.51 ? "ODD" : "NEUTRAL";
      pointEstimatePWin = primaryWin.oddRate;
      lowerBoundPWin = primaryWin.oddWilson.lower;
    }
  }

  // Confidence scaled by sample coverage and lower-bound margin
  const confidence = Math.round(
    Math.min(
      100,
      Math.max(0, 50 + netLean * 150 * (lowerBoundPWin >= requiredPWinHurdle ? 1.2 : 0.8)),
    ),
  );

  const summary = primaryWin
    ? `${dominantSide} lean (W${primaryWin.windowSize}: ${(primaryWin.evenRate * 100).toFixed(1)}% E, ${(primaryWin.oddRate * 100).toFixed(1)}% O, Wilson 95% [${(lowerBoundPWin * 100).toFixed(1)}%, ${((dominantSide === "EVEN" ? primaryWin.evenWilson.upper : primaryWin.oddWilson.upper) * 100).toFixed(1)}%])`
    : "Insufficient tick data for multi-window Wilson bounds";

  return {
    windows: windowResults,
    dominantSide,
    overallConfidence: confidence,
    lowerBoundPWin,
    pointEstimatePWin,
    primaryWindow: primaryWin ? primaryWin.windowSize : 50,
    summary,
  };
}
