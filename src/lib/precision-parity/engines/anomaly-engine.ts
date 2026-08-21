// Precision Parity AI — Anomaly & Z-Score Engine.
// Measures whether current short-term parity behaviour represents a statistically significant anomaly vs long baseline.

export interface ParityAnomalyResult {
  recentEvenRate: number; // short window e.g. 30
  baselineEvenRate: number; // long window e.g. 300
  zScore: number;
  isAnomaly: boolean;
  anomalyDirection: "SURGE_EVEN" | "SURGE_ODD" | "NORMAL";
  significanceLevel: "p > 0.05" | "p < 0.05" | "p < 0.01";
  summary: string;
}

export function runParityAnomalyEngine(
  digits: number[],
  shortWin: number = 30,
  longWin: number = 300,
): ParityAnomalyResult {
  const n = digits.length;
  if (n < shortWin) {
    return {
      recentEvenRate: 0.5,
      baselineEvenRate: 0.5,
      zScore: 0,
      isAnomaly: false,
      anomalyDirection: "NORMAL",
      significanceLevel: "p > 0.05",
      summary: "Insufficient data for anomaly test",
    };
  }

  const shortSample = digits.slice(-shortWin);
  const longSample = digits.slice(-longWin);

  let shortEven = 0;
  for (let i = 0; i < shortSample.length; i++) {
    if (shortSample[i] % 2 === 0) shortEven++;
  }
  const p1 = shortEven / shortSample.length;

  let longEven = 0;
  for (let i = 0; i < longSample.length; i++) {
    if (longSample[i] % 2 === 0) longEven++;
  }
  const p0 = longEven / longSample.length;

  // Two-proportion z-test (comparing short window to baseline expectation)
  const pPooled = Math.max(0.01, Math.min(0.99, p0));
  const se = Math.sqrt((pPooled * (1 - pPooled)) / shortSample.length);
  const zScore = se > 0 ? (p1 - p0) / se : 0;
  const absZ = Math.abs(zScore);

  let isAnomaly = false;
  let significanceLevel: "p > 0.05" | "p < 0.05" | "p < 0.01" = "p > 0.05";
  let anomalyDirection: "SURGE_EVEN" | "SURGE_ODD" | "NORMAL" = "NORMAL";

  if (absZ >= 2.576) {
    isAnomaly = true;
    significanceLevel = "p < 0.01";
    anomalyDirection = zScore > 0 ? "SURGE_EVEN" : "SURGE_ODD";
  } else if (absZ >= 1.96) {
    isAnomaly = true;
    significanceLevel = "p < 0.05";
    anomalyDirection = zScore > 0 ? "SURGE_EVEN" : "SURGE_ODD";
  }

  const summary = `Z=${zScore.toFixed(2)} (${significanceLevel}) — ${anomalyDirection}`;

  return {
    recentEvenRate: p1,
    baselineEvenRate: p0,
    zScore,
    isAnomaly,
    anomalyDirection,
    significanceLevel,
    summary,
  };
}
