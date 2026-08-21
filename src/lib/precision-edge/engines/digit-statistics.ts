// DIGIT STATISTICS — retargeted to the bot.
// Measures how close the 0-4 vs 5-9 split is to 50/50 across every rolling
// window, per-digit deviation from 10%, and specifically how safe the bot's
// four barriers (2, 3, 6, 7) currently are versus their theoretical rates.
import type { Engine, EngineContext, EngineScore } from "../types";
import { digit } from "../rolling-store";
import { BOT_SPEC } from "../bot/spec";
import { clamp, closeness, shareOf, withVerdict } from "./bot-helpers";

export const digitStatisticsEngine: Engine = {
  name: "digitStatistics",
  evaluate(ctx: EngineContext): EngineScore {
    const f = ctx.features;
    const flags = ctx.config.features;
    const reasons: string[] = [];

    // 1. Multi-window zone balance — the bot needs a fair digit regime.
    const windowErrors: number[] = [];
    for (const n of ctx.config.rollingWindows) {
      const w = ctx.windows[n];
      if (!w || w.length < 50) continue;
      const d = w.map((t) => digit(t.price));
      windowErrors.push(Math.abs(shareOf(d, (x) => x >= 5) * 100 - 50));
    }
    const meanWindowError = windowErrors.length
      ? windowErrors.reduce((a, b) => a + b, 0) / windowErrors.length
      : Math.abs(f.zoneB * 100 - 50);
    const balanceScore = closeness(meanWindowError, 0, ctx.config.bot.eMax);
    reasons.push(
      `Mean 0-4 / 5-9 deviation across ${windowErrors.length || 1} windows: ${meanWindowError.toFixed(2)}pp`,
    );

    // 2. Per-digit deviation from the theoretical 10%.
    const perDigitDev = f.pct.reduce((a, p) => a + Math.abs(p - 0.1), 0) / 10;
    const flatnessScore = clamp(100 * (1 - perDigitDev / 0.035));
    if (flags.hotDigits || flags.coldDigits) {
      reasons.push(
        `Per-digit deviation ${(perDigitDev * 100).toFixed(2)}pp (hot ${f.dominant[0]} ${(f.pct[f.dominant[0]] * 100).toFixed(1)}%, cold ${f.weak[0]} ${(f.pct[f.weak[0]] * 100).toFixed(1)}%)`,
      );
    }

    // 3. Barrier safety for the bot's exact contracts.
    const d = f.digits;
    const over2 = shareOf(d, (x) => x > 2); // theory 0.70
    const over3 = shareOf(d, (x) => x > 3); // theory 0.60
    const under6 = shareOf(d, (x) => x < 6); // theory 0.60
    const under7 = shareOf(d, (x) => x < 7); // theory 0.70
    const barrierScores = [
      closeness(over2, BOT_SPEC.theory[2], 0.08),
      closeness(over3, BOT_SPEC.theory[3], 0.08),
      closeness(under6, BOT_SPEC.theory[6], 0.08),
      closeness(under7, BOT_SPEC.theory[7], 0.08),
    ];
    const barrierScore = barrierScores.reduce((a, b) => a + b, 0) / barrierScores.length;
    reasons.push(
      `Barriers — Over 2 ${(over2 * 100).toFixed(1)}% · Over 3 ${(over3 * 100).toFixed(1)}% · Under 6 ${(under6 * 100).toFixed(1)}% · Under 7 ${(under7 * 100).toFixed(1)}%`,
    );

    const rotationScore = flags.digitRotation ? f.digitRotation * 100 : 50;
    const score = clamp(
      0.4 * balanceScore + 0.2 * flatnessScore + 0.3 * barrierScore + 0.1 * rotationScore,
    );

    const over = clamp(
      50 + (over2 - BOT_SPEC.theory[2]) * 400 + (over3 - BOT_SPEC.theory[3]) * 200,
    );
    const under = clamp(
      50 + (under7 - BOT_SPEC.theory[7]) * 400 + (under6 - BOT_SPEC.theory[6]) * 200,
    );
    const veto = clamp((meanWindowError - ctx.config.bot.bands.acceptable) * 25);

    return {
      name: "digitStatistics",
      score,
      weight: ctx.config.engineWeights.digitStatistics ?? 0,
      features: withVerdict(
        {
          meanWindowError,
          perDigitDeviation: perDigitDev,
          over2,
          over3,
          under6,
          under7,
          entropyNorm: f.entropyNorm,
          digitRotation: f.digitRotation,
          dominant: f.dominant.join(","),
          weak: f.weak.join(","),
        },
        { over, under, veto },
      ),
      reasons,
    };
  },
};
