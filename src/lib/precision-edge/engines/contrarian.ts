// CONTRARIAN — the anti-chase veto.
// Detects when the 6-tick burst the bot is about to trade is a LATE-STAGE
// burst likely to mean-revert against the chosen barrier.
import type { Engine, EngineContext, EngineScore } from "../types";
import { BOT_SPEC } from "../bot/spec";
import { clamp, shareOf, withVerdict } from "./bot-helpers";

export const contrarianEngine: Engine = {
  name: "contrarian",
  evaluate(ctx: EngineContext): EngineScore {
    const d = ctx.features.digits;
    const burst = ctx.bot?.burst ?? null;
    const trigger = ctx.bot?.trigger ?? null;

    // How stretched is the side the bot is (about to be) on?
    const side =
      trigger && trigger.direction !== "WAIT" ? trigger.direction : (burst?.side ?? "WAIT");
    const window6 = d.slice(-BOT_SPEC.ticksAnalyzed);
    const window24 = d.slice(-BOT_SPEC.ticksAnalyzed * 4);
    const shortShare =
      side === "OVER"
        ? shareOf(window6, (x) => x >= 5)
        : side === "UNDER"
          ? shareOf(window6, (x) => x <= 4)
          : 0.5;
    const mediumShare =
      side === "OVER"
        ? shareOf(window24, (x) => x >= 5)
        : side === "UNDER"
          ? shareOf(window24, (x) => x <= 4)
          : 0.5;

    // Late stage = the side already dominated the wider window too.
    const extension = clamp((mediumShare - 0.5) * 200) / 100;
    const maturity = burst ? burst.maturity : extension;
    const chaseRisk = clamp(maturity * 60 + extension * 40) / 100;
    const score = clamp(100 - chaseRisk * 100);

    const support = clamp(100 - chaseRisk * 120);
    return {
      name: "contrarian",
      score,
      weight: ctx.config.engineWeights.contrarian ?? 0,
      features: withVerdict(
        {
          side,
          shortShare,
          mediumShare,
          extension,
          maturity,
          chaseRisk,
          lateStage: burst?.lateStage ?? extension > 0.5,
        },
        {
          over: side === "OVER" ? support : 50,
          under: side === "UNDER" ? support : 50,
          veto: clamp(chaseRisk * 100 - 35),
        },
      ),
      reasons: [
        side === "WAIT"
          ? "No burst in play — nothing to chase"
          : `${side} burst: ${(shortShare * 100).toFixed(0)}% of the last 6 ticks, ${(mediumShare * 100).toFixed(0)}% of the last ${BOT_SPEC.ticksAnalyzed * 4}`,
        `Chase risk ${(chaseRisk * 100).toFixed(0)}% — ${chaseRisk > 0.6 ? "entering into likely mean reversion" : "burst still has room"}`,
      ],
      warnings: chaseRisk > 0.65 ? ["Anti-chase: this burst is late stage"] : undefined,
    };
  },
};
