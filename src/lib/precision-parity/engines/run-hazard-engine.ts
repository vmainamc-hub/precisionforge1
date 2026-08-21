// Precision Parity AI — Run/Streak Lifecycle & Hazard Rate Engine.
// Core predictive engine for parity: analyzes active run length and the empirical hazard function P(run ends | length >= k).

import { wilsonScoreInterval } from "./wilson";

export interface RunLengthStat {
  length: number;
  totalReached: number; // number of runs that reached at least this length
  terminatedHere: number; // number of runs that ended exactly at this length
  hazardRate: number; // P(ends at length | reached length) = terminated / totalReached
  hazardWilson: { lower: number; upper: number };
}

export interface ParityRunEngineResult {
  activeSide: "EVEN" | "ODD";
  activeLength: number;
  longestRunHistorical: { even: number; odd: number };
  averageRunLength: { even: number; odd: number };
  totalRunsObserved: number;
  empiricalHazard: RunLengthStat | null;
  pBreakNextTick: number; // probability the current run ends on the next tick
  pContinueNextTick: number;
  hazardConfidenceBounds: { lower: number; upper: number };
  sampleSizeAtThisLength: number;
  runStatus: "FRESH" | "DEVELOPING" | "EXTENDED" | "EXHAUSTION_WARNING";
  suggestedAction: "RIDE_RUN" | "FADE_RUN" | "WAIT_FOR_BREAK" | "NEUTRAL";
  summary: string;
}

export function runParityRunEngine(digits: number[]): ParityRunEngineResult {
  const n = digits.length;
  if (n === 0) {
    return {
      activeSide: "EVEN",
      activeLength: 0,
      longestRunHistorical: { even: 0, odd: 0 },
      averageRunLength: { even: 1, odd: 1 },
      totalRunsObserved: 0,
      empiricalHazard: null,
      pBreakNextTick: 0.5,
      pContinueNextTick: 0.5,
      hazardConfidenceBounds: { lower: 0.5, upper: 0.5 },
      sampleSizeAtThisLength: 0,
      runStatus: "FRESH",
      suggestedAction: "NEUTRAL",
      summary: "No ticks available for run analysis",
    };
  }

  // Parse all historical runs
  const runs: Array<{ side: "EVEN" | "ODD"; length: number }> = [];
  let curSide: "EVEN" | "ODD" = digits[0] % 2 === 0 ? "EVEN" : "ODD";
  let curLen = 1;

  for (let i = 1; i < n; i++) {
    const s = digits[i] % 2 === 0 ? "EVEN" : "ODD";
    if (s === curSide) {
      curLen++;
    } else {
      runs.push({ side: curSide, length: curLen });
      curSide = s;
      curLen = 1;
    }
  }

  const activeSide = curSide;
  const activeLength = curLen;

  let maxEvenRun = 0;
  let maxOddRun = 0;
  let sumEvenRun = 0;
  let sumOddRun = 0;
  let countEvenRuns = 0;
  let countOddRuns = 0;

  // Run length distribution map for same side
  const lengthReached: Record<number, number> = {};
  const lengthTerminated: Record<number, number> = {};

  for (const r of runs) {
    if (r.side === "EVEN") {
      if (r.length > maxEvenRun) maxEvenRun = r.length;
      sumEvenRun += r.length;
      countEvenRuns++;
    } else {
      if (r.length > maxOddRun) maxOddRun = r.length;
      sumOddRun += r.length;
      countOddRuns++;
    }

    if (r.side === activeSide) {
      for (let l = 1; l <= r.length; l++) {
        lengthReached[l] = (lengthReached[l] || 0) + 1;
      }
      lengthTerminated[r.length] = (lengthTerminated[r.length] || 0) + 1;
    }
  }

  const avgEven = countEvenRuns > 0 ? sumEvenRun / countEvenRuns : 1.0;
  const avgOdd = countOddRuns > 0 ? sumOddRun / countOddRuns : 1.0;

  // Compute hazard for activeLength
  const reached = lengthReached[activeLength] || 0;
  const term = lengthTerminated[activeLength] || 0;

  let pBreak = 0.5;
  let wilsonBounds = { lower: 0.45, upper: 0.55 };

  if (reached >= 5) {
    const w = wilsonScoreInterval(term, reached, 0.95);
    pBreak = w.point;
    wilsonBounds = { lower: w.lower, upper: w.upper };
  } else {
    // Theoretical geometric distribution baseline: pBreak = 0.5 with high uncertainty
    pBreak = Math.min(0.9, 0.5 + (activeLength - 1) * 0.08);
    wilsonBounds = {
      lower: Math.max(0.4, pBreak - 0.2),
      upper: Math.min(0.95, pBreak + 0.2),
    };
  }

  let runStatus: "FRESH" | "DEVELOPING" | "EXTENDED" | "EXHAUSTION_WARNING" = "FRESH";
  let suggestedAction: "RIDE_RUN" | "FADE_RUN" | "WAIT_FOR_BREAK" | "NEUTRAL" = "NEUTRAL";

  if (activeLength === 1) {
    runStatus = "FRESH";
    suggestedAction = "NEUTRAL";
  } else if (activeLength <= 3) {
    runStatus = "DEVELOPING";
    suggestedAction = "RIDE_RUN";
  } else if (activeLength <= 5) {
    runStatus = "EXTENDED";
    suggestedAction = "WAIT_FOR_BREAK";
  } else {
    runStatus = "EXHAUSTION_WARNING";
    suggestedAction = "FADE_RUN";
  }

  const summary = `Active ${activeSide} run len=${activeLength}. Hazard of termination next tick: ${(pBreak * 100).toFixed(1)}% [${(wilsonBounds.lower * 100).toFixed(1)}%, ${(wilsonBounds.upper * 100).toFixed(1)}%] (N=${reached})`;

  return {
    activeSide,
    activeLength,
    longestRunHistorical: {
      even: Math.max(maxEvenRun, activeSide === "EVEN" ? activeLength : 0),
      odd: Math.max(maxOddRun, activeSide === "ODD" ? activeLength : 0),
    },
    averageRunLength: {
      even: Number(avgEven.toFixed(2)),
      odd: Number(avgOdd.toFixed(2)),
    },
    totalRunsObserved: runs.length,
    empiricalHazard:
      reached > 0
        ? {
            length: activeLength,
            totalReached: reached,
            terminatedHere: term,
            hazardRate: pBreak,
            hazardWilson: wilsonBounds,
          }
        : null,
    pBreakNextTick: pBreak,
    pContinueNextTick: 1 - pBreak,
    hazardConfidenceBounds: wilsonBounds,
    sampleSizeAtThisLength: reached,
    runStatus,
    suggestedAction,
    summary,
  };
}
