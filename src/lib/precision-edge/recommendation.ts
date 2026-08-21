// Ranks candidate contracts and picks the strongest above threshold.
import type { CandidateContract, CandidateEvaluation, EngineContext } from "./types";
import { contractWinProb, defaultCandidates } from "./probability";
import { findRecovery } from "./engines/recovery";

export function evaluateCandidates(
  ctx: EngineContext,
  marketEdgeScore: number,
): CandidateEvaluation[] {
  const list = ctx.candidates.length ? ctx.candidates : defaultCandidates();
  const w100 = ctx.windows[100] ?? ctx.features.ticks;
  const w1000 = ctx.windows[1000] ?? w100;
  const evals: CandidateEvaluation[] = [];
  for (const c of list) {
    const p = contractWinProb(w100, c);
    const h = contractWinProb(w1000, c);
    const edge = p - h;
    // Candidate quality is a blend of raw win-rate, historical stability, and
    // the market's overall edge score.
    const quality = Math.max(
      0,
      Math.min(
        100,
        60 * p + 25 * (1 - Math.abs(edge)) + (15 * (marketEdgeScore / 100) * 100) / 100,
      ),
    );
    const recovery = findRecovery(c, w1000) ?? undefined;
    evals.push({ candidate: c, probability: p, historicalProb: h, edge, quality, recovery });
  }
  return evals.sort((a, b) => b.quality - a.quality);
}

export function pickRecommendation(
  evals: CandidateEvaluation[],
  marketEdgeScore: number,
  threshold: number,
): CandidateEvaluation | null {
  if (evals.length === 0) return null;
  const top = evals[0];
  if (marketEdgeScore < threshold) return null;
  if (top.quality < threshold) return null;
  return top;
}

export function noSetupCandidate(): CandidateContract {
  return { type: "UNDER", barrier: 0, label: "No High Quality Setup" };
}
