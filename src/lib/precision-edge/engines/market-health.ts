// MARKET HEALTH — overall tradability FOR THE BOT.
// Equilibrium + stability + entropy + absence of clustering. The
// excellent/good/average/weak/avoid label is kept, but now grades bot fitness.
import type { Engine, EngineContext, EngineScore } from "../types";
import { clamp, closeness, withVerdict } from "./bot-helpers";

export const marketHealthEngine: Engine = {
  name: "marketHealth",
  evaluate(ctx: EngineContext): EngineScore {
    const f = ctx.features;
    const eq = ctx.bot?.equilibrium ?? null;
    const cfg = ctx.config.bot;

    const equilibriumScore = eq ? eq.score : closeness(Math.abs(f.zoneB * 100 - 50), 0, cfg.eMax);
    const bandStability = eq ? eq.stability : 50;
    const entropy = ctx.config.features.entropy ? f.entropyNorm * 100 : 90;
    const distStab = ctx.config.features.distributionStability ? f.distributionStability * 100 : 80;
    const tickStab = f.tickConsistency * 100;

    // Clustering: consecutive repeats of the same zone beyond chance.
    let repeats = 0;
    for (let i = 1; i < f.digits.length; i++) {
      if (f.digits[i] >= 5 === f.digits[i - 1] >= 5) repeats++;
    }
    const repeatRate = repeats / Math.max(1, f.digits.length - 1);
    const clusterFreedom = closeness(repeatRate, 0.5, 0.2);

    const score = clamp(
      0.34 * equilibriumScore +
        0.18 * bandStability +
        0.16 * entropy +
        0.14 * distStab +
        0.08 * tickStab +
        0.1 * clusterFreedom,
    );

    return {
      name: "marketHealth",
      score,
      weight: ctx.config.engineWeights.marketHealth ?? 0,
      features: withVerdict(
        {
          label: healthLabel(score),
          equilibriumScore,
          bandStability,
          entropyNorm: f.entropyNorm,
          distributionStability: f.distributionStability,
          tickConsistency: f.tickConsistency,
          repeatRate,
          clusterFreedom,
        },
        {
          over: score,
          under: score,
          veto: clamp(70 - score),
        },
      ),
      reasons: [
        `Bot tradability ${healthLabel(score)} (${score.toFixed(0)}/100)`,
        `Equilibrium ${equilibriumScore.toFixed(0)} · multi-window agreement ${bandStability.toFixed(0)}% · entropy ${entropy.toFixed(0)}%`,
        `Zone clustering ${(repeatRate * 100).toFixed(0)}% repeats (50% is random)`,
      ],
    };
  },
};

/** Label defined against BOT performance, not generic market quality. */
export function healthLabel(score: number): "excellent" | "good" | "average" | "weak" | "avoid" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "average";
  if (score >= 40) return "weak";
  return "avoid";
}
