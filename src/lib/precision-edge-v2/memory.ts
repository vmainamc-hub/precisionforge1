// Market Memory — rolling multi-window statistics per market.
// Used by pattern-library and historical-agreement gate. Never predicts;
// it only remembers so the engine can compare present vs past states.

import type { DigitStatistics } from "./types";

export const MEMORY_WINDOWS = [20, 50, 100, 200, 500, 1000] as const;
export type MemoryWindow = (typeof MEMORY_WINDOWS)[number];

export interface WindowStats {
  n: number;
  pct: number[]; // length 10
  entropyNorm: number;
  zoneA: number;
  oddPct: number;
  dominant: number;
  suppressed: number;
}

export type MarketMemory = Record<MemoryWindow, WindowStats>;

export function computeMemory(digits: number[]): MarketMemory {
  const out = {} as MarketMemory;
  for (const w of MEMORY_WINDOWS) {
    const slice = digits.slice(-w);
    const total = Math.max(1, slice.length);
    const freq = new Array(10).fill(0);
    slice.forEach((d) => freq[d]++);
    const pct = freq.map((f) => f / total);
    const entropy = -pct.reduce((a, p) => (p > 0 ? a + p * Math.log2(p) : a), 0);
    const zoneA = pct.slice(0, 5).reduce((a, b) => a + b, 0);
    const oddPct = [1, 3, 5, 7, 9].reduce((a, d) => a + pct[d], 0);
    out[w] = {
      n: slice.length,
      pct,
      entropyNorm: entropy / Math.log2(10),
      zoneA,
      oddPct,
      dominant: pct.indexOf(Math.max(...pct)),
      suppressed: pct.indexOf(Math.min(...pct)),
    };
  }
  return out;
}

/** Historical agreement: how closely the recent window matches the deep window.
 *  Returns 0..1, where 1 = current state is consistent with long history. */
export function historicalAgreement(mem: MarketMemory): number {
  const shortW = mem[100];
  const longW = mem[1000];
  if (!shortW.n || !longW.n) return 0.5;
  // Bhattacharyya-style coefficient across digit distributions.
  let bc = 0;
  for (let d = 0; d < 10; d++) bc += Math.sqrt(shortW.pct[d] * longW.pct[d]);
  return Math.max(0, Math.min(1, bc));
}
