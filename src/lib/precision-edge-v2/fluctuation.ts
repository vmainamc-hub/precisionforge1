// Fluctuation Engine — detects instability in the reasoning itself.
// A signal produced during high fluctuation is fragile and must never
// be promoted to READY.

import type { DigitStatistics, TraderBehaviour } from "./types";

export interface FluctuationReport {
  score: number; // 0..1 — higher = more unstable
  reasons: string[];
}

interface History {
  overPressure: number[];
  underPressure: number[];
  edge: number[];
}

const history = new Map<string, History>();
const MAX = 8;

function push(h: History, k: keyof History, v: number) {
  h[k].push(v);
  if (h[k].length > MAX) h[k].shift();
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length;
}

function reversals(xs: number[]): number {
  let n = 0;
  for (let i = 2; i < xs.length; i++) {
    if (Math.sign(xs[i] - xs[i - 1]) !== Math.sign(xs[i - 1] - xs[i - 2])) n++;
  }
  return n;
}

export function measureFluctuation(
  market: string,
  stats: DigitStatistics,
  behaviour: TraderBehaviour,
  primaryEdge: number,
): FluctuationReport {
  const h = history.get(market) ?? ({ overPressure: [], underPressure: [], edge: [] } as History);
  push(h, "overPressure", behaviour.overPressure);
  push(h, "underPressure", behaviour.underPressure);
  push(h, "edge", primaryEdge);
  history.set(market, h);

  const reasons: string[] = [];
  const vEdge = variance(h.edge);
  const revOver = reversals(h.overPressure);
  const revUnder = reversals(h.underPressure);
  const contradictory = behaviour.overPressure > 0.01 && behaviour.underPressure > 0.01 ? 1 : 0;

  let score = 0;
  score += Math.min(1, vEdge * 400) * 0.35;
  score += ((revOver + revUnder) / (2 * MAX)) * 0.35;
  score += contradictory * 0.2;
  // Manipulation-driven noise: last-window vs long-window entropy divergence.
  const dominantAnomaly = Math.abs(stats.pct[stats.dominant] - stats.recentPct[stats.dominant]);
  score += Math.min(1, dominantAnomaly * 8) * 0.1;

  if (vEdge > 0.0005)
    reasons.push(`Edge variance ${(vEdge * 1000).toFixed(2)}‰ across recent scans`);
  if (revOver + revUnder >= 3)
    reasons.push(`Trader pressure has reversed ${revOver + revUnder}× recently`);
  if (contradictory) reasons.push("Over and Under groups are both strengthening (contradiction)");
  if (dominantAnomaly > 0.05)
    reasons.push(`Dominant digit ${stats.dominant} unstable across windows`);

  return { score: Math.max(0, Math.min(1, score)), reasons };
}
