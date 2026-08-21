// ZONE — the multi-window evidence feed for the Equilibrium Doctrine.
// Direct 0-4 vs 5-9 balance measured on every configured window.
import type { Engine, EngineContext, EngineScore } from "../types";
import { digit } from "../rolling-store";
import { clamp, closeness, shareOf, withVerdict } from "./bot-helpers";

export const zoneEngine: Engine = {
  name: "zone",
  evaluate(ctx: EngineContext): EngineScore {
    if (!ctx.config.features.zoneBalance) {
      return {
        name: "zone",
        score: 50,
        weight: ctx.config.engineWeights.zone ?? 0,
        features: withVerdict({}, { over: 0, under: 0, veto: 0 }),
        reasons: ["disabled"],
      };
    }
    const cfg = ctx.config.bot;
    const rows: { window: number; high: number; error: number }[] = [];
    for (const n of ctx.config.rollingWindows) {
      const w = ctx.windows[n];
      if (!w || w.length < 40) continue;
      const d = w.map((t) => digit(t.price));
      const high = shareOf(d, (x) => x >= 5) * 100;
      rows.push({ window: n, high, error: Math.abs(high - 50) });
    }
    const meanError = rows.length
      ? rows.reduce((a, r) => a + r.error, 0) / rows.length
      : Math.abs(ctx.features.zoneB * 100 - 50);
    const worstError = rows.length ? Math.max(...rows.map((r) => r.error)) : meanError;
    const agreement = rows.length
      ? (rows.filter((r) => r.error <= cfg.bands.prime).length / rows.length) * 100
      : 0;

    // Zone transition rate: a healthy random regime alternates zones ~50%.
    let transitions = 0;
    let prev = -1;
    for (const d of ctx.features.digits) {
      const z = d <= 4 ? 0 : 1;
      if (prev !== -1 && z !== prev) transitions++;
      prev = z;
    }
    const rotation = transitions / Math.max(1, ctx.features.digits.length - 1);
    const rotationScore = closeness(rotation, 0.5, 0.25);

    const score = clamp(
      0.5 * closeness(meanError, 0, cfg.eMax) +
        0.2 * closeness(worstError, 0, cfg.eMax * 1.5) +
        0.15 * agreement +
        0.15 * rotationScore,
    );

    const canonical = rows.find((r) => r.window === cfg.canonicalWindow) ?? rows[rows.length - 1];
    const highBias = canonical ? canonical.high - 50 : 0;
    const windowFeatures: Record<string, number> = {};
    for (const r of rows) windowFeatures[`w${r.window}High`] = r.high;

    return {
      name: "zone",
      score,
      weight: ctx.config.engineWeights.zone ?? 0,
      features: withVerdict(
        {
          meanError,
          worstError,
          agreement,
          rotation,
          transitions,
          zoneA: ctx.features.zoneA,
          zoneB: ctx.features.zoneB,
          ...windowFeatures,
        },
        {
          // Persistent high-digit dominance quietly erodes UNDER legs, and vice versa.
          over: clamp(50 - highBias * 8),
          under: clamp(50 + highBias * 8),
          veto: clamp((meanError - cfg.bands.acceptable) * 30),
        },
      ),
      reasons: [
        rows.length
          ? rows.map((r) => `${r.window}t ${r.high.toFixed(1)}% high`).join(" · ")
          : `Zone A ${(ctx.features.zoneA * 100).toFixed(1)}% / Zone B ${(ctx.features.zoneB * 100).toFixed(1)}%`,
        `Window agreement ${agreement.toFixed(0)}%, zone alternation ${(rotation * 100).toFixed(0)}%`,
      ],
    };
  },
};
