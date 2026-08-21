// Precision Parity AI — Contract Selector Engine.
// Evaluates EV across available Deriv contract types (DIGITEVEN, DIGITODD, DIGITOVER, DIGITUNDER, DIGITDIFF, DIGITMATCH)
// and chooses the contract maximizing expected mathematical value.

import { wilsonScoreInterval } from "./wilson";

export type DerivContractType =
  "DIGITEVEN" | "DIGITODD" | "DIGITOVER" | "DIGITUNDER" | "DIGITMATCH" | "DIGITDIFF";

export interface CandidateContractEval {
  contract: DerivContractType;
  barrier?: number;
  payoutRate: number; // net multiplier, e.g. 0.95 for Even/Odd, 3.5 for Over 7, etc.
  pointProbability: number;
  lowerBoundProbability: number;
  expectedValue: number; // lower bound EV
  rankScore: number;
  narrative: string;
}

export interface ContractSelectorResult {
  bestContract: DerivContractType;
  barrier?: number;
  bestEV: number;
  bestProbability: { point: number; lower: number; upper: number; sampleSize: number };
  payoutRate: number;
  allEvaluations: CandidateContractEval[];
  summary: string;
}

export function runContractSelectorEngine(
  digits: number[],
  favouredParity: "EVEN" | "ODD",
  parityLowerBound: number,
  parityPointEstimate: number,
  forcedContract?: DerivContractType,
): ContractSelectorResult {
  const sample = digits.slice(-100);
  const n = sample.length || 1;

  // Tally digit frequencies 0..9
  const digitCounts = new Array(10).fill(0);
  for (let i = 0; i < sample.length; i++) {
    digitCounts[sample[i]]++;
  }

  const evals: CandidateContractEval[] = [];

  // 1. DIGITEVEN & DIGITODD (Standard 0.95 payout)
  const evenCount =
    digitCounts[0] + digitCounts[2] + digitCounts[4] + digitCounts[6] + digitCounts[8];
  const oddCount = n - evenCount;

  const wEven = wilsonScoreInterval(evenCount, n, 0.95);
  const wOdd = wilsonScoreInterval(oddCount, n, 0.95);

  evals.push({
    contract: "DIGITEVEN",
    payoutRate: 0.95,
    pointProbability: wEven.point,
    lowerBoundProbability: wEven.lower,
    expectedValue: wEven.lower * 1.95 - 1,
    rankScore: (wEven.lower * 1.95 - 1) * 100,
    narrative: `DIGITEVEN: Point ${(wEven.point * 100).toFixed(1)}%, Lower ${(wEven.lower * 100).toFixed(1)}%, EV ${((wEven.lower * 1.95 - 1) * 100).toFixed(1)}%`,
  });

  evals.push({
    contract: "DIGITODD",
    payoutRate: 0.95,
    pointProbability: wOdd.point,
    lowerBoundProbability: wOdd.lower,
    expectedValue: wOdd.lower * 1.95 - 1,
    rankScore: (wOdd.lower * 1.95 - 1) * 100,
    narrative: `DIGITODD: Point ${(wOdd.point * 100).toFixed(1)}%, Lower ${(wOdd.lower * 100).toFixed(1)}%, EV ${((wOdd.lower * 1.95 - 1) * 100).toFixed(1)}%`,
  });

  // 2. DIGITUNDER / DIGITOVER candidates if digits are skewed
  // Under 7 (digits 0..6, prob ~70%, payout ~0.38)
  const under7Count = digitCounts.slice(0, 7).reduce((a, b) => a + b, 0);
  const wUnder7 = wilsonScoreInterval(under7Count, n, 0.95);
  const evUnder7 = wUnder7.lower * 1.38 - 1;
  evals.push({
    contract: "DIGITUNDER",
    barrier: 7,
    payoutRate: 0.38,
    pointProbability: wUnder7.point,
    lowerBoundProbability: wUnder7.lower,
    expectedValue: evUnder7,
    rankScore: evUnder7 * 100,
    narrative: `DIGITUNDER 7: Point ${(wUnder7.point * 100).toFixed(1)}%, EV ${(evUnder7 * 100).toFixed(1)}%`,
  });

  // Over 2 (digits 3..9, prob ~70%, payout ~0.38)
  const over2Count = digitCounts.slice(3).reduce((a, b) => a + b, 0);
  const wOver2 = wilsonScoreInterval(over2Count, n, 0.95);
  const evOver2 = wOver2.lower * 1.38 - 1;
  evals.push({
    contract: "DIGITOVER",
    barrier: 2,
    payoutRate: 0.38,
    pointProbability: wOver2.point,
    lowerBoundProbability: wOver2.lower,
    expectedValue: evOver2,
    rankScore: evOver2 * 100,
    narrative: `DIGITOVER 2: Point ${(wOver2.point * 100).toFixed(1)}%, EV ${(evOver2 * 100).toFixed(1)}%`,
  });

  // Differ candidate for the coldest digit (payout ~0.08)
  let coldestDigit = 0;
  let minCount = digitCounts[0];
  for (let d = 1; d <= 9; d++) {
    if (digitCounts[d] < minCount) {
      minCount = digitCounts[d];
      coldestDigit = d;
    }
  }
  const diffCount = n - minCount;
  const wDiff = wilsonScoreInterval(diffCount, n, 0.95);
  const evDiff = wDiff.lower * 1.085 - 1;
  evals.push({
    contract: "DIGITDIFF",
    barrier: coldestDigit,
    payoutRate: 0.085,
    pointProbability: wDiff.point,
    lowerBoundProbability: wDiff.lower,
    expectedValue: evDiff,
    rankScore: evDiff * 100,
    narrative: `DIGITDIFF ${coldestDigit}: Point ${(wDiff.point * 100).toFixed(1)}%, EV ${(evDiff * 100).toFixed(1)}%`,
  });

  // Sort by expected value
  evals.sort((a, b) => b.expectedValue - a.expectedValue);

  // Preference filter: prioritize pure parity contract (DIGITEVEN / DIGITODD) unless an alternative has >= +1.5% higher EV
  const primaryParity: DerivContractType =
    forcedContract ?? (favouredParity === "EVEN" ? "DIGITEVEN" : "DIGITODD");
  const parityEval = evals.find((e) => e.contract === primaryParity) ?? evals[0];
  const topEval = evals[0];

  let chosen = parityEval;
  if (!forcedContract) {
    if (
      topEval.contract !== primaryParity &&
      topEval.expectedValue >= parityEval.expectedValue + 0.015
    ) {
      chosen = topEval;
    }
  }

  const wChosen = wilsonScoreInterval(
    chosen.contract === "DIGITEVEN"
      ? evenCount
      : chosen.contract === "DIGITODD"
        ? oddCount
        : Math.round(chosen.pointProbability * n),
    n,
    0.95,
  );

  const summary = `Selected ${chosen.contract}${chosen.barrier !== undefined ? ` (Barrier ${chosen.barrier})` : ""} | Payout ${chosen.payoutRate.toFixed(2)}:1 | Lower EV +${(chosen.expectedValue * 100).toFixed(1)}%`;

  return {
    bestContract: chosen.contract,
    barrier: chosen.barrier,
    bestEV: chosen.expectedValue,
    bestProbability: {
      point: chosen.pointProbability,
      lower: chosen.lowerBoundProbability,
      upper: wChosen.upper,
      sampleSize: n,
    },
    payoutRate: chosen.payoutRate,
    allEvaluations: evals,
    summary,
  };
}
