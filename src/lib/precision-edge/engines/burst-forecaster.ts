// BURST FORECASTER ENGINE — will the bot's own 6-tick trigger fire soon, on
// which side, and is that burst fresh (good) or late-stage (bad)?
import type { Engine, EngineContext, EngineScore } from "../types";
import { clamp, neutralScore, withVerdict } from "./bot-helpers";

export const burstForecasterEngine: Engine = {
  name: "burstForecaster",
  evaluate(ctx: EngineContext): EngineScore {
    const ev = ctx.bot;
    if (!ev) return neutralScore("burstForecaster", ctx, "No bot evidence — burst unmeasured");
    const b = ev.burst;

    // Fresh, imminent bursts score high; extended ones score low.
    const freshness = clamp((1 - b.maturity) * 100);
    const imminence = clamp(b.probability * 100);
    const liveBonus = b.ticksToFire === 0 ? 15 : 0;
    const score = clamp(0.55 * freshness + 0.35 * imminence + liveBonus);

    const sideStrength = clamp(b.probability * 100 * (1 - b.maturity * 0.5));
    const over = b.side === "OVER" ? sideStrength : clamp(30 - b.maturity * 20);
    const under = b.side === "UNDER" ? sideStrength : clamp(30 - b.maturity * 20);
    const veto = b.lateStage ? clamp(60 + b.maturity * 40) : clamp(b.maturity * 50);

    return {
      name: "burstForecaster",
      score,
      weight: ctx.config.engineWeights.burstForecaster ?? 0,
      features: withVerdict(
        {
          side: b.side,
          probability: b.probability,
          ticksToFire: b.ticksToFire,
          current: b.current,
          currentHighPct: b.currentHighPct,
          maturity: b.maturity,
          lateStage: b.lateStage,
          pHigh: b.pHigh,
        },
        { over, under, veto },
      ),
      reasons: [
        b.ticksToFire === 0
          ? `Trigger LIVE on ${b.side} — ${b.currentHighPct.toFixed(0)}% high digits in the bot's 6-tick window`
          : `${b.side} trigger forecast in ${b.ticksToFire} tick(s) at ${(b.probability * 100).toFixed(0)}%`,
        `Burst maturity ${(b.maturity * 100).toFixed(0)}% — ${b.lateStage ? "late stage, reversion risk" : "fresh"}`,
      ],
      warnings: b.lateStage
        ? ["Late-stage burst: the bot would be chasing an exhausted move"]
        : undefined,
    };
  },
};
