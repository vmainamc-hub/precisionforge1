// PROBABILITY — retargeted to the bot's four exact contracts.
// Empirical rolling win rate of Over 2, Over 3, Under 6 and Under 7 versus
// theory (70 / 60 / 60 / 70). Flags any contract trading below theory.
import type { Engine, EngineContext, EngineScore } from "../types";
import { digit } from "../rolling-store";
import { BOT_SPEC, type BotBarrier } from "../bot/spec";
import { clamp, shareOf, withVerdict } from "./bot-helpers";

const CONTRACTS: { barrier: BotBarrier; dir: "OVER" | "UNDER"; label: string }[] = [
  { barrier: 2, dir: "OVER", label: "Over 2" },
  { barrier: 3, dir: "OVER", label: "Over 3" },
  { barrier: 6, dir: "UNDER", label: "Under 6" },
  { barrier: 7, dir: "UNDER", label: "Under 7" },
];

function winRate(digits: number[], dir: "OVER" | "UNDER", barrier: number): number {
  return shareOf(digits, (d) => (dir === "OVER" ? d > barrier : d < barrier));
}

export const probabilityEngine: Engine = {
  name: "probability",
  evaluate(ctx: EngineContext): EngineScore {
    const short = (ctx.windows[200] ?? ctx.features.ticks).map((t) => digit(t.price));
    const long = (ctx.windows[1000] ?? ctx.windows[500] ?? ctx.features.ticks).map((t) =>
      digit(t.price),
    );

    const rows = CONTRACTS.map((c) => {
      const rolling = winRate(short, c.dir, c.barrier);
      const historical = winRate(long, c.dir, c.barrier);
      const theory = BOT_SPEC.theory[c.barrier];
      return { ...c, rolling, historical, theory, gap: rolling - theory };
    });

    const belowTheory = rows.filter((r) => r.gap < -0.03);
    const perContract = rows.map((r) => clamp(50 + Math.max(-0.12, Math.min(0.06, r.gap)) * 500));
    const score = clamp(
      perContract.reduce((a, b) => a + b, 0) / perContract.length - belowTheory.length * 6,
    );

    const sideScore = (rs: typeof rows) =>
      clamp(50 + (rs.reduce((a, r) => a + r.gap, 0) / Math.max(1, rs.length)) * 500);

    const featureMap: Record<string, number> = { contractsBelowTheory: belowTheory.length };
    for (const r of rows) {
      featureMap[`${r.label} rolling`] = r.rolling;
      featureMap[`${r.label} historical`] = r.historical;
    }

    return {
      name: "probability",
      score,
      weight: ctx.config.engineWeights.probability ?? 0,
      features: withVerdict(featureMap, {
        over: sideScore(rows.filter((r) => r.dir === "OVER")),
        under: sideScore(rows.filter((r) => r.dir === "UNDER")),
        veto: clamp(belowTheory.length * 30),
      }),
      reasons: rows.map(
        (r) =>
          `${r.label}: ${(r.rolling * 100).toFixed(1)}% rolling / ${(r.historical * 100).toFixed(1)}% long vs theory ${(r.theory * 100).toFixed(0)}%`,
      ),
      warnings: belowTheory.length
        ? [`Below theory: ${belowTheory.map((r) => r.label).join(", ")}`]
        : undefined,
    };
  },
};
