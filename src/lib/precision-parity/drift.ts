// Phase 5 — Drift Detection (Two-Sided CUSUM + Page-Hinkley)
// Tracks real-time regime drift and structural breaks to invalidate signals mid-run.

export interface DriftReport {
  cusumPos: number; // positive cumulative sum (shift toward EVEN)
  cusumNeg: number; // negative cumulative sum (shift toward ODD)
  pageHinkley: number; // gradual concept drift statistic
  breakDetected: boolean;
  ticksSinceBreak: number;
  severity: "NONE" | "MINOR" | "MAJOR";
  narrative: string;
}

interface MarketDriftState {
  cusumPos: number;
  cusumNeg: number;
  minCumulative: number;
  cumulativeSum: number;
  ticksSinceBreak: number;
  lastBreakIndex: number;
}

const driftStates = new Map<string, MarketDriftState>();

const CUSUM_K = 0.05; // slack parameter
const CUSUM_H_MINOR = 3.5; // minor threshold
const CUSUM_H_MAJOR = 6.0; // major structural break threshold
const PH_DELTA = 0.05; // Page-Hinkley magnitude parameter
const PH_LAMBDA = 12.0; // Page-Hinkley alarm threshold

export function runDriftDetection(
  digits: number[],
  market: string = "default",
  targetContract: "BUY_EVEN" | "BUY_ODD" | "DIGITEVEN" | "DIGITODD" | "NO_TRADE" = "BUY_EVEN",
): DriftReport {
  const n = digits.length;
  if (n < 20) {
    return {
      cusumPos: 0,
      cusumNeg: 0,
      pageHinkley: 0,
      breakDetected: false,
      ticksSinceBreak: n,
      severity: "NONE",
      narrative: "Baseline sample initializing (N < 20).",
    };
  }

  // Target reference value: centered at 0.0 (EVEN = +0.5, ODD = -0.5)
  const window = digits.slice(-100);
  let cusumPos = 0;
  let cusumNeg = 0;
  let phSum = 0;
  let phMin = Infinity;
  let maxPH = 0;

  // Compute reference mean from historical window
  const refWindow = digits.slice(0, Math.max(10, digits.length - 50));
  let refEvens = 0;
  for (let i = 0; i < refWindow.length; i++) {
    if (refWindow[i] % 2 === 0) refEvens++;
  }
  const refMean = refWindow.length > 0 ? refEvens / refWindow.length : 0.5;

  let lastBreakIdx = 0;

  for (let i = 0; i < window.length; i++) {
    const x = window[i] % 2 === 0 ? 1 : 0;
    const diff = x - refMean;

    // Two-sided CUSUM
    cusumPos = Math.max(0, cusumPos + diff - CUSUM_K);
    cusumNeg = Math.max(0, cusumNeg - diff - CUSUM_K);

    // Page-Hinkley test
    phSum += diff - PH_DELTA;
    if (phSum < phMin) phMin = phSum;
    const phStat = phSum - phMin;
    if (phStat > maxPH) maxPH = phStat;

    if (cusumPos > CUSUM_H_MAJOR || cusumNeg > CUSUM_H_MAJOR || phStat > PH_LAMBDA) {
      lastBreakIdx = i;
    }
  }

  const breakDetected =
    cusumPos >= CUSUM_H_MINOR || cusumNeg >= CUSUM_H_MINOR || maxPH >= PH_LAMBDA * 0.7;

  let severity: "NONE" | "MINOR" | "MAJOR" = "NONE";
  if (cusumPos >= CUSUM_H_MAJOR || cusumNeg >= CUSUM_H_MAJOR || maxPH >= PH_LAMBDA) {
    severity = "MAJOR";
  } else if (breakDetected) {
    severity = "MINOR";
  }

  const ticksSinceBreak = window.length - lastBreakIdx;

  const narrative =
    severity === "MAJOR"
      ? `CRITICAL STRUCTURAL BREAK: Two-sided CUSUM breached major threshold (S+=${cusumPos.toFixed(2)}, S-=${cusumNeg.toFixed(2)}, PH=${maxPH.toFixed(2)}). Live signals must immediately invalidate.`
      : severity === "MINOR"
        ? `Moderate concept drift detected (S+=${cusumPos.toFixed(2)}, S-=${cusumNeg.toFixed(2)}). Edge stability is fragile.`
        : `Drift within controlled tolerances (CUSUM S+=${cusumPos.toFixed(2)}, S-=${cusumNeg.toFixed(2)}, PH=${maxPH.toFixed(2)} < threshold).`;

  return {
    cusumPos,
    cusumNeg,
    pageHinkley: maxPH,
    breakDetected,
    ticksSinceBreak,
    severity,
    narrative,
  };
}

export function resetDriftMemory(market?: string): void {
  if (market) {
    driftStates.delete(market);
  } else {
    driftStates.clear();
  }
}
