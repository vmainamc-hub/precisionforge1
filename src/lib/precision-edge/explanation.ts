// Turns engine scores + recommendation into human-readable reasons.
import type { CandidateEvaluation, EngineScore, RecoveryPlan } from "./types";

export function buildExplanation(
  engines: EngineScore[],
  recommended: CandidateEvaluation | null,
  recovery: RecoveryPlan | null,
  marketHealth: number,
  edgeScore: number,
  threshold: number,
): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (recommended) {
    reasons.push(
      `Recommended ${recommended.candidate.label} @ quality ${recommended.quality.toFixed(1)}`,
    );
    reasons.push(
      `Rolling P(win) ${(recommended.probability * 100).toFixed(1)}% vs historical ${(recommended.historicalProb * 100).toFixed(1)}%`,
    );
  } else {
    reasons.push(`No candidate cleared threshold ${threshold}`);
  }
  if (recovery) {
    reasons.push(
      `Recovery ${recovery.primary.label} → ${recovery.recovery.label} @ ${(recovery.probability * 100).toFixed(1)}%`,
    );
  }
  reasons.push(`Market health ${marketHealth.toFixed(1)}/100`);
  reasons.push(`Overall edge ${edgeScore.toFixed(1)}/100`);
  for (const e of engines) {
    if (e.reasons?.length) reasons.push(`[${e.name}] ${e.reasons[0]}`);
    if (e.warnings?.length) warnings.push(...e.warnings.map((w) => `[${e.name}] ${w}`));
  }
  if (marketHealth < 55) warnings.push("Market health below average — confidence reduced");
  if (edgeScore < threshold) warnings.push(`Edge ${edgeScore.toFixed(1)} < threshold ${threshold}`);
  return { reasons, warnings };
}
