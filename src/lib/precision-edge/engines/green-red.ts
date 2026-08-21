// GREEN / RED — retargeted as trend-contamination detection.
// Price up/down balance is a proxy for directional drift leaking into the digit
// stream. The bot needs a non-trending regime: one-sided drift is penalised.
import type { Engine, EngineContext, EngineScore } from "../types";
import { clamp, closeness, withVerdict } from "./bot-helpers";

export const greenRedEngine: Engine = {
  name: "greenRed",
  evaluate(ctx: EngineContext): EngineScore {
    if (!ctx.config.features.greenRed) {
      return {
        name: "greenRed",
        score: 50,
        weight: ctx.config.engineWeights.greenRed ?? 0,
        features: withVerdict({}, { over: 0, under: 0, veto: 0 }),
        reasons: ["disabled"],
      };
    }
    const f = ctx.features;
    const imbalance = Math.abs(f.greenPct - 0.5) * 2; // 0..1
    const mom = ctx.config.features.momentum ? Math.abs(f.momentum) : 0;
    const acc = ctx.config.features.acceleration ? Math.abs(f.acceleration) : 0;

    // 100 = perfectly balanced, non-trending. 0 = strong directional drift.
    const score = clamp(
      0.5 * closeness(f.greenPct, 0.5, 0.12) + 0.3 * (1 - mom) * 100 + 0.2 * (1 - acc) * 100,
    );

    const drift = (f.greenPct - 0.5) * 2; // +ve = up-trending
    return {
      name: "greenRed",
      score,
      weight: ctx.config.engineWeights.greenRed ?? 0,
      features: withVerdict(
        {
          greenPct: f.greenPct,
          redPct: f.redPct,
          imbalance,
          momentum: f.momentum,
          acceleration: f.acceleration,
          direction: f.momentum > 0 ? "up" : f.momentum < 0 ? "down" : "flat",
        },
        {
          // A trending tape contaminates the side it runs against.
          over: clamp(50 - drift * 40),
          under: clamp(50 + drift * 40),
          veto: clamp((imbalance - 0.2) * 200 + mom * 40),
        },
      ),
      reasons: [
        `Green ${(f.greenPct * 100).toFixed(1)}% / Red ${(f.redPct * 100).toFixed(1)}% — ${imbalance < 0.1 ? "no directional contamination" : "directional drift present"}`,
        `Momentum ${f.momentum.toFixed(2)}, acceleration ${f.acceleration.toFixed(2)}`,
      ],
      warnings:
        imbalance > 0.25
          ? ["Trend contamination: the digit stream is not behaving symmetrically"]
          : undefined,
    };
  },
};
