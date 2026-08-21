// EQUILIBRIUM ENGINE — the Primary Law made into a registered engine.
// Score = EquilibriumScore of the canonical window, penalised by drift and by
// disagreement between windows. It is ALSO a hard gate: the orchestrator caps
// the fused score when this engine reports a broken band.
import type { Engine, EngineContext, EngineScore } from "../types";
import { clamp, neutralScore, withVerdict } from "./bot-helpers";

export const equilibriumEngine: Engine = {
  name: "equilibrium",
  evaluate(ctx: EngineContext): EngineScore {
    const ev = ctx.bot;
    if (!ev) return neutralScore("equilibrium", ctx, "No bot evidence — equilibrium unmeasured");
    const eq = ev.equilibrium;
    const cfg = ctx.config.bot;

    const driftPenalty = clamp(
      (Math.abs(eq.driftVelocity) / Math.max(1e-9, cfg.maxDriftVelocity)) * 30,
      0,
      30,
    );
    const disagreement = 100 - eq.stability;
    const score = clamp(eq.score - driftPenalty - disagreement * 0.15);

    // Drift direction is a directional warning, not a directional signal:
    // Over4% walking DOWN threatens OVER legs, walking UP threatens UNDER legs.
    const driftMag = clamp(
      (Math.abs(eq.driftVelocity) / Math.max(1e-9, cfg.maxDriftVelocity)) * 100,
    );
    const over = eq.driftSide === "LOW" ? clamp(50 - driftMag / 2) : clamp(50 + driftMag / 4);
    const under = eq.driftSide === "HIGH" ? clamp(50 - driftMag / 2) : clamp(50 + driftMag / 4);
    const veto =
      eq.band === "BROKEN"
        ? 100
        : eq.band === "DRIFTING"
          ? 70
          : eq.score < cfg.minEquilibriumScore
            ? 60
            : driftMag * 0.4;

    return {
      name: "equilibrium",
      score,
      weight: ctx.config.engineWeights.equilibrium ?? 0,
      features: withVerdict(
        {
          over4Pct: eq.over4Pct,
          under5Pct: eq.under5Pct,
          error: eq.error,
          band: eq.band,
          window: eq.window,
          samples: eq.samples,
          stability: eq.stability,
          driftVelocity: eq.driftVelocity,
          driftSide: eq.driftSide,
          filteredOver4: eq.filteredOver4,
          uncertainty: eq.uncertainty,
          timeInBandMs: eq.timeInBandMs,
        },
        { over, under, veto },
      ),
      reasons: [
        `Over 4 ${eq.over4Pct.toFixed(2)}% / Under 5 ${eq.under5Pct.toFixed(2)}% over ${eq.samples} ticks — E ${eq.error.toFixed(2)}pp (${eq.band})`,
        `Drift ${eq.driftVelocity >= 0 ? "+" : ""}${eq.driftVelocity.toFixed(2)}pp/100t towards ${eq.driftSide}; ${eq.stability.toFixed(0)}% of windows in the prime band`,
      ],
      warnings:
        eq.band === "BROKEN" || eq.band === "DRIFTING"
          ? [`Equilibrium band ${eq.band} — the bot's edge is not present`]
          : undefined,
    };
  },
};
