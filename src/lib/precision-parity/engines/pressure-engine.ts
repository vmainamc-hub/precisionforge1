// Precision Parity AI — Pressure & Buildup Engine.
// Tracks cumulative parity imbalances relative to expected random-walk variance.

export interface ParityPressureResult {
  cumulativeImbalance: number; // sum of (Even - Odd) over window
  zScore: number; // deviation normalized by sqrt(N * p * (1-p)) = sqrt(N * 0.25)
  stretchedState: "NONE" | "MODERATE_STRETCH" | "EXTREME_STRETCH";
  favouredMeanReversion: "EVEN" | "ODD" | "NEUTRAL";
  favouredMomentum: "EVEN" | "ODD" | "NEUTRAL";
  reversionConfidence: number; // 0..100
  momentumConfidence: number; // 0..100
  summary: string;
}

export function runParityPressureEngine(
  digits: number[],
  windowSize: number = 100,
): ParityPressureResult {
  const sample = digits.slice(-windowSize);
  const n = sample.length;
  if (n === 0) {
    return {
      cumulativeImbalance: 0,
      zScore: 0,
      stretchedState: "NONE",
      favouredMeanReversion: "NEUTRAL",
      favouredMomentum: "NEUTRAL",
      reversionConfidence: 50,
      momentumConfidence: 50,
      summary: "No data for pressure calculation",
    };
  }

  let evenCount = 0;
  for (let i = 0; i < n; i++) {
    if (sample[i] % 2 === 0) evenCount++;
  }
  const oddCount = n - evenCount;
  const imbalance = evenCount - oddCount; // e.g. +14 even surplus

  // Standard deviation of Bernoulli sum under H0 (p=0.5): sigma = sqrt(N * 0.25) = 0.5 * sqrt(N)
  const expectedStdDev = 0.5 * Math.sqrt(n);
  const zScore = expectedStdDev > 0 ? imbalance / expectedStdDev : 0;
  const absZ = Math.abs(zScore);

  let stretchedState: "NONE" | "MODERATE_STRETCH" | "EXTREME_STRETCH" = "NONE";
  if (absZ >= 2.58) {
    stretchedState = "EXTREME_STRETCH"; // 99% significance
  } else if (absZ >= 1.96) {
    stretchedState = "MODERATE_STRETCH"; // 95% significance
  }

  const favouredMomentum = imbalance > 0 ? "EVEN" : imbalance < 0 ? "ODD" : "NEUTRAL";
  const favouredMeanReversion = imbalance > 0 ? "ODD" : imbalance < 0 ? "EVEN" : "NEUTRAL";

  const reversionConfidence = Math.min(
    95,
    Math.max(50, 50 + (absZ >= 1.5 ? (absZ - 1.5) * 20 : 0)),
  );
  const momentumConfidence = Math.min(95, Math.max(50, 50 + (absZ <= 2.0 ? absZ * 15 : 0)));

  const summary = `Imbalance: ${imbalance > 0 ? "+" : ""}${imbalance} (z=${zScore.toFixed(2)}, ${stretchedState})`;

  return {
    cumulativeImbalance: imbalance,
    zScore,
    stretchedState,
    favouredMeanReversion,
    favouredMomentum,
    reversionConfidence,
    momentumConfidence,
    summary,
  };
}
