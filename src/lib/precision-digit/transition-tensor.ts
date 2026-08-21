// Phase 10.1 — Transition Tensor Engine
// 10x10 first-order & 10x10x10 second-order digit transition tensors with Dirichlet(0.5) smoothing and Chi-Square FDR.

import { benjaminiHochberg } from "../precision-parity/significance";
import { erfc } from "./math-utils";

export interface DigitDistributionReport {
  probs: number[]; // P(next = d) for d = 0..9
  low: number[]; // Wilson 90% lower bound
  high: number[]; // Wilson 90% upper bound
  significantRows: boolean[]; // row-level chi-square FDR significance
  transitionMatrix: number[][]; // 10x10 smoothed matrix
  tensor: number[][][]; // 10x10x10 smoothed second-order tensor
  dominantTransitions: { from: number; to: number; prob: number; qValue: number }[];
  narrative: string;
}

// Chi-square survival function approximation (df = 9)
function chiSquarePValue(stat: number, df: number = 9): number {
  if (stat <= 0) return 1.0;
  // Gamma regularized approximation for 9 degrees of freedom
  const x = stat / 2;
  const k = df / 2; // 4.5
  // Simple polynomial approximation for standard chi-sq CDF
  const z = Math.sqrt(2 * stat) - Math.sqrt(2 * df - 1);
  // Normal approx to tail
  const p = 0.5 * erfc(z / Math.SQRT2);
  return Math.max(1e-6, Math.min(1.0, p));
}

export function computeTransitionTensor(digits: number[] = []): DigitDistributionReport {
  const clean = (digits ?? [])
    .map((d) => (typeof d === "number" && Number.isFinite(d) ? Math.abs(Math.floor(d)) % 10 : 0))
    .slice(-500);

  const n = clean.length;
  const alpha = 0.5; // Dirichlet prior

  // 1. Build 10x10 raw count matrix
  const rawCounts: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  const rowTotals: number[] = new Array(10).fill(0);

  for (let i = 0; i + 1 < n; i++) {
    const a = clean[i];
    const b = clean[i + 1];
    rawCounts[a][b]++;
    rowTotals[a]++;
  }

  // 2. Build 10x10x10 second-order count tensor
  const tensorRaw: number[][][] = Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => new Array(10).fill(0)),
  );
  for (let i = 0; i + 2 < n; i++) {
    const a = clean[i];
    const b = clean[i + 1];
    const c = clean[i + 2];
    tensorRaw[a][b][c]++;
  }

  // 3. Dirichlet-smoothed transition matrix
  const transitionMatrix: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0.1));
  const rowPValues: number[] = new Array(10).fill(1.0);

  for (let a = 0; a < 10; a++) {
    const total = rowTotals[a];
    const denom = total + 10 * alpha;

    let chiStat = 0;
    const expected = total / 10;

    for (let b = 0; b < 10; b++) {
      transitionMatrix[a][b] = (rawCounts[a][b] + alpha) / denom;
      if (total >= 20 && expected > 0) {
        chiStat += (rawCounts[a][b] - expected) ** 2 / expected;
      }
    }

    rowPValues[a] = total >= 20 ? chiSquarePValue(chiStat, 9) : 1.0;
  }

  // Multiple-comparison correction across rows
  const rowQValues = benjaminiHochberg(rowPValues);
  const significantRows = rowQValues.map((q) => q < 0.05);

  // 4. Dirichlet-smoothed 3D tensor
  const tensor: number[][][] = Array.from({ length: 10 }, (_, a) =>
    Array.from({ length: 10 }, (_, b) => {
      const pairTotal = tensorRaw[a][b].reduce((acc, c) => acc + c, 0);
      const pairDenom = pairTotal + 10 * 0.2;
      return Array.from({ length: 10 }, (_, c) => (tensorRaw[a][b][c] + 0.2) / pairDenom);
    }),
  );

  // 5. Compute next digit distribution given recent context
  const lastDigit = n > 0 ? clean[n - 1] : 0;
  const secondLastDigit = n > 1 ? clean[n - 2] : 0;

  const probs: number[] = new Array(10).fill(0.1);
  const low: number[] = new Array(10).fill(0);
  const high: number[] = new Array(10).fill(0);

  for (let d = 0; d < 10; d++) {
    // 60% 2nd-order + 40% 1st-order transition
    const p1 = transitionMatrix[lastDigit][d];
    const p2 = tensor[secondLastDigit][lastDigit][d];
    probs[d] = 0.6 * p2 + 0.4 * p1;

    // Wilson 90% confidence interval
    const z = 1.645;
    const count = rawCounts[lastDigit][d];
    const total = Math.max(1, rowTotals[lastDigit]);
    const pEmp = count / total;
    const denom = 1 + (z * z) / total;
    const center = (pEmp + (z * z) / (2 * total)) / denom;
    const margin =
      (z * Math.sqrt((pEmp * (1 - pEmp)) / total + (z * z) / (4 * total * total))) / denom;

    low[d] = Math.max(0, center - margin);
    high[d] = Math.min(1, center + margin);
  }

  const dominantTransitions: { from: number; to: number; prob: number; qValue: number }[] = [];
  for (let a = 0; a < 10; a++) {
    if (significantRows[a]) {
      let maxB = 0;
      let maxP = 0;
      for (let b = 0; b < 10; b++) {
        if (transitionMatrix[a][b] > maxP) {
          maxP = transitionMatrix[a][b];
          maxB = b;
        }
      }
      dominantTransitions.push({
        from: a,
        to: maxB,
        prob: maxP,
        qValue: rowQValues[a],
      });
    }
  }

  const narrative =
    dominantTransitions.length > 0
      ? `Discovered ${dominantTransitions.length} FDR-significant digit transition rules (e.g. digit ${dominantTransitions[0].from} → ${dominantTransitions[0].to} with ${(dominantTransitions[0].prob * 100).toFixed(1)}% prob, q=${dominantTransitions[0].qValue.toFixed(4)}).`
      : `Digit transitions are statistically uniform across all 10 rows (no row rejected FDR q < 0.05).`;

  return {
    probs,
    low,
    high,
    significantRows,
    transitionMatrix,
    tensor,
    dominantTransitions,
    narrative,
  };
}
