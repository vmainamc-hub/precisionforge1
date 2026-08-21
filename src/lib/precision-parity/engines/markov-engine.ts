// Precision Parity AI — Parity Markov Transitions Engine (1st, 2nd, 3rd Order).
// Measures P(next = Even | recent parity sequence) with sample counts and Wilson bounds.

import { wilsonScoreInterval } from "./wilson";

export interface MarkovContextNode {
  context: string; // e.g. "E", "OE", "OOE"
  order: 1 | 2 | 3;
  sampleCount: number;
  evenCount: number;
  oddCount: number;
  pEven: number;
  pOdd: number;
  wilsonEven: { lower: number; upper: number };
}

export interface ParityMarkovEngineResult {
  activeContext1: MarkovContextNode | null;
  activeContext2: MarkovContextNode | null;
  activeContext3: MarkovContextNode | null;
  preferredOrder: 1 | 2 | 3;
  favouredSide: "EVEN" | "ODD" | "NEUTRAL";
  pointEstimatePWin: number;
  lowerBoundPWin: number;
  sampleSize: number;
  matrix1st: {
    pEE: number;
    pEO: number;
    pOE: number;
    pOO: number;
    counts: { EE: number; EO: number; OE: number; OO: number };
  };
  summary: string;
}

export function runParityMarkovEngine(digits: number[]): ParityMarkovEngineResult {
  const parities = digits.map((d) => (d % 2 === 0 ? "E" : "O"));
  const n = parities.length;

  const counts1: Record<string, { even: number; odd: number }> = {
    E: { even: 0, odd: 0 },
    O: { even: 0, odd: 0 },
  };

  const counts2: Record<string, { even: number; odd: number }> = {
    EE: { even: 0, odd: 0 },
    EO: { even: 0, odd: 0 },
    OE: { even: 0, odd: 0 },
    OO: { even: 0, odd: 0 },
  };

  const counts3: Record<string, { even: number; odd: number }> = {};

  // Build empirical transitions
  for (let i = 0; i < n - 1; i++) {
    const c1 = parities[i];
    const next = parities[i + 1];
    if (next === "E") counts1[c1].even++;
    else counts1[c1].odd++;

    if (i < n - 2) {
      const c2 = parities[i] + parities[i + 1];
      const next2 = parities[i + 2];
      if (counts2[c2]) {
        if (next2 === "E") counts2[c2].even++;
        else counts2[c2].odd++;
      }
    }

    if (i < n - 3) {
      const c3 = parities[i] + parities[i + 1] + parities[i + 2];
      const next3 = parities[i + 3];
      if (!counts3[c3]) counts3[c3] = { even: 0, odd: 0 };
      if (next3 === "E") counts3[c3].even++;
      else counts3[c3].odd++;
    }
  }

  // Active current contexts
  const cur1 = n >= 1 ? parities[n - 1] : "";
  const cur2 = n >= 2 ? parities[n - 2] + parities[n - 1] : "";
  const cur3 = n >= 3 ? parities[n - 3] + parities[n - 2] + parities[n - 1] : "";

  function makeNode(
    ctx: string,
    order: 1 | 2 | 3,
    counts: { even: number; odd: number } | undefined,
  ): MarkovContextNode | null {
    if (!ctx || !counts) return null;
    const total = counts.even + counts.odd;
    if (total === 0) return null;
    // Laplace smoothing (+1)
    const pEven = (counts.even + 1) / (total + 2);
    const pOdd = 1 - pEven;
    const w = wilsonScoreInterval(counts.even, total, 0.95);
    return {
      context: ctx,
      order,
      sampleCount: total,
      evenCount: counts.even,
      oddCount: counts.odd,
      pEven,
      pOdd,
      wilsonEven: { lower: w.lower, upper: w.upper },
    };
  }

  const node1 = makeNode(cur1, 1, counts1[cur1]);
  const node2 = makeNode(cur2, 2, counts2[cur2]);
  const node3 = makeNode(cur3, 3, counts3[cur3]);

  // Select best order based on sample adequacy: order 3 needs N>=15, order 2 needs N>=25, else order 1
  let chosenNode: MarkovContextNode | null = node1;
  let preferredOrder: 1 | 2 | 3 = 1;

  if (node3 && node3.sampleCount >= 18 && Math.abs(node3.pEven - 0.5) > 0.06) {
    chosenNode = node3;
    preferredOrder = 3;
  } else if (node2 && node2.sampleCount >= 25 && Math.abs(node2.pEven - 0.5) > 0.04) {
    chosenNode = node2;
    preferredOrder = 2;
  } else if (node1) {
    chosenNode = node1;
    preferredOrder = 1;
  }

  let favouredSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
  let pointEstimatePWin = 0.5;
  let lowerBoundPWin = 0.5;
  const sampleSize = chosenNode ? chosenNode.sampleCount : 0;

  if (chosenNode) {
    if (chosenNode.pEven >= 0.52) {
      favouredSide = "EVEN";
      pointEstimatePWin = chosenNode.pEven;
      lowerBoundPWin = chosenNode.wilsonEven.lower;
    } else if (chosenNode.pOdd >= 0.52) {
      favouredSide = "ODD";
      pointEstimatePWin = chosenNode.pOdd;
      lowerBoundPWin = 1 - chosenNode.wilsonEven.upper;
    }
  }

  // 1st order matrix breakdown
  const eeT = counts1.E.even + counts1.E.odd || 1;
  const ooT = counts1.O.even + counts1.O.odd || 1;
  const pEE = counts1.E.even / eeT;
  const pEO = counts1.E.odd / eeT;
  const pOE = counts1.O.even / ooT;
  const pOO = counts1.O.odd / ooT;

  const summary = chosenNode
    ? `Markov Ord-${preferredOrder} [${chosenNode.context}] -> P(${favouredSide === "NEUTRAL" ? "Even" : favouredSide})=${(pointEstimatePWin * 100).toFixed(1)}% (N=${sampleSize}, Wilson LB ${(lowerBoundPWin * 100).toFixed(1)}%)`
    : "Markov transitions neutral / insufficient depth";

  return {
    activeContext1: node1,
    activeContext2: node2,
    activeContext3: node3,
    preferredOrder,
    favouredSide,
    pointEstimatePWin,
    lowerBoundPWin,
    sampleSize,
    matrix1st: {
      pEE,
      pEO,
      pOE,
      pOO,
      counts: {
        EE: counts1.E.even,
        EO: counts1.E.odd,
        OE: counts1.O.even,
        OO: counts1.O.odd,
      },
    },
    summary,
  };
}
