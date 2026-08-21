// Feature Fusion Layer — combines independent engine scores with normalised
// weights. No engine may dominate: caps a single engine's contribution.
import type { EngineScore } from "./types";
import { normaliseWeights } from "./config";

const MAX_SINGLE_CONTRIB = 0.35; // 35% of total

export function fuseScores(
  engineScores: EngineScore[],
  weights: Record<string, number>,
): {
  edgeScore: number;
  appliedWeights: Record<string, number>;
} {
  const filtered: Record<string, number> = {};
  for (const s of engineScores) filtered[s.name] = weights[s.name] ?? 0;
  const norm = normaliseWeights(filtered);
  // Cap each engine's normalised weight, redistribute excess proportionally.
  const capped: Record<string, number> = {};
  let excess = 0;
  const uncapped: string[] = [];
  for (const [k, w] of Object.entries(norm)) {
    if (w > MAX_SINGLE_CONTRIB * 100) {
      capped[k] = MAX_SINGLE_CONTRIB * 100;
      excess += w - MAX_SINGLE_CONTRIB * 100;
    } else {
      capped[k] = w;
      uncapped.push(k);
    }
  }
  const uncappedSum = uncapped.reduce((a, k) => a + capped[k], 0);
  if (excess > 0 && uncappedSum > 0) {
    for (const k of uncapped) capped[k] += (capped[k] / uncappedSum) * excess;
  }
  let edge = 0;
  for (const s of engineScores) edge += (capped[s.name] / 100) * s.score;
  return { edgeScore: Math.max(0, Math.min(100, edge)), appliedWeights: capped };
}
