// Precision Parity AI — Parity Shannon Entropy Engine.
// Evaluates signal disorder vs predictable structure. High entropy = veto, low entropy = tradeable structure.

import { binaryEntropy } from "./wilson";

export interface ParityEntropyResult {
  entropy20: number; // 0..1
  entropy50: number;
  entropy120: number;
  entropy500: number;
  aggregateEntropy: number;
  isHighEntropyVeto: boolean;
  structureStrength: "VERY_STRONG" | "STRONG" | "MODERATE" | "DIFFUSE_NOISE";
  summary: string;
}

export function runParityEntropyEngine(
  digits: number[],
  vetoThreshold: number = 0.985, // near-perfect 1.0 entropy implies uniform noise
): ParityEntropyResult {
  function getEntropy(win: number): number {
    const sample = digits.slice(-win);
    if (sample.length === 0) return 1.0;
    let evens = 0;
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] % 2 === 0) evens++;
    }
    const p = evens / sample.length;
    return binaryEntropy(p);
  }

  const entropy20 = getEntropy(20);
  const entropy50 = getEntropy(50);
  const entropy120 = getEntropy(120);
  const entropy500 = getEntropy(500);

  // Weighted aggregate
  const aggregateEntropy =
    entropy20 * 0.2 + entropy50 * 0.4 + entropy120 * 0.25 + entropy500 * 0.15;

  const isHighEntropyVeto = aggregateEntropy >= vetoThreshold && entropy50 >= vetoThreshold;

  let structureStrength: "VERY_STRONG" | "STRONG" | "MODERATE" | "DIFFUSE_NOISE" = "DIFFUSE_NOISE";
  if (aggregateEntropy < 0.88) {
    structureStrength = "VERY_STRONG";
  } else if (aggregateEntropy < 0.94) {
    structureStrength = "STRONG";
  } else if (aggregateEntropy < 0.975) {
    structureStrength = "MODERATE";
  } else {
    structureStrength = "DIFFUSE_NOISE";
  }

  const summary = `Entropy: ${(aggregateEntropy * 100).toFixed(1)}% (${structureStrength})${isHighEntropyVeto ? " [VETO: High noise/entropy]" : ""}`;

  return {
    entropy20,
    entropy50,
    entropy120,
    entropy500,
    aggregateEntropy,
    isHighEntropyVeto,
    structureStrength,
    summary,
  };
}
