// §102 Persistence Model — Kalman-based expected-ticks estimator.
//
// Replaces the exponential heuristic in `opportunity.ts::forecastPersistence`.
// The public function keeps the same signature and return shape so the swap is
// invisible to call sites — but internally we now maintain a filtered belief
// over the "health" of the setup and derive expected remaining ticks, decay
// rate, and 68/95% confidence intervals from it.

import type { ContractVerdict, MarketPsychology } from "./types";
import type { PersistenceForecast } from "./opportunity";

export interface PersistenceKalmanResult extends PersistenceForecast {
  /** Filtered setup-health belief in [0,1]. */
  belief: number;
  /** Instantaneous decay rate λ (per tick). */
  decay: number;
  /** 68% CI on expected remaining ticks. */
  ci68Ticks: [number, number];
  /** 95% CI on expected remaining ticks. */
  ci95Ticks: [number, number];
}

/**
 * Kalman-flavoured persistence forecast. Same signature as the legacy
 * `forecastPersistence` for drop-in replacement.
 */
export function forecastPersistenceKalman(
  v: ContractVerdict,
  psy: MarketPsychology,
  fluctuation: number,
): PersistenceKalmanResult {
  // ── Observation: health of the setup right now, in [0,1]. ─────────────
  const streak = clamp01(v.persistenceTicks / 20); // saturates at 20 ticks
  const health = clamp01(psy.health / 100);
  const noise = clamp01(fluctuation + psy.manipulation / 100);
  const momentum = clamp01(0.5 + v.momentum * 5);
  const rawObs = clamp01(0.35 * streak + 0.3 * health + 0.2 * momentum - 0.35 * noise + 0.35);

  // ── Kalman update over a single latent "belief" scalar. ───────────────
  // Prior belief ~ 0.5, prior variance 0.25. Process noise depends on
  // fluctuation (a noisy market decays confidence in the belief faster).
  const priorMean = 0.5;
  const priorVar = 0.25;
  const q = 0.005 + 0.02 * noise; // process noise
  const r = 0.02 + 0.05 * (1 - health); // observation noise
  const predVar = priorVar + q;
  const k = predVar / (predVar + r);
  const belief = clamp01(priorMean + k * (rawObs - priorMean));
  const beliefVar = (1 - k) * predVar;
  const beliefSigma = Math.sqrt(beliefVar);

  // ── Map belief → decay rate λ (per tick). ────────────────────────────
  // High belief (0.9) → λ≈0.02 (half-life ~35 ticks).
  // Low belief (0.1)  → λ≈0.25 (half-life ~3 ticks).
  const lambda = clamp(0.01, 0.35, 0.3 * (1 - belief) + 0.02);
  const expected = clamp(3, 90, 1 / lambda);

  // 1σ bands on ticks derived from 1σ bands on belief.
  const beliefLo = clamp01(belief - beliefSigma);
  const beliefHi = clamp01(belief + beliefSigma);
  const lambdaLo = clamp(0.01, 0.5, 0.3 * (1 - beliefHi) + 0.02);
  const lambdaHi = clamp(0.01, 0.5, 0.3 * (1 - beliefLo) + 0.02);
  const ticksLo68 = clamp(2, 120, 1 / lambdaHi);
  const ticksHi68 = clamp(2, 120, 1 / lambdaLo);

  const belief95Lo = clamp01(belief - 2 * beliefSigma);
  const belief95Hi = clamp01(belief + 2 * beliefSigma);
  const lambda95Lo = clamp(0.01, 0.5, 0.3 * (1 - belief95Hi) + 0.02);
  const lambda95Hi = clamp(0.01, 0.5, 0.3 * (1 - belief95Lo) + 0.02);
  const ticksLo95 = clamp(2, 120, 1 / lambda95Hi);
  const ticksHi95 = clamp(2, 120, 1 / lambda95Lo);

  // ── Survival probabilities: exp(-λ * seconds). ───────────────────────
  // Deriv volatility indices tick roughly once per second on 1s indices
  // and ~2s on standard indices; use 1.5s as an even estimate.
  const survival = (seconds: number) => clamp(0.05, 0.99, Math.exp(-lambda * (seconds / 1.5)));

  const narrative =
    expected >= 30
      ? `Filtered setup-belief ${(belief * 100).toFixed(0)}% — expect ~${expected.toFixed(0)} ticks (95% CI ${ticksLo95.toFixed(0)}–${ticksHi95.toFixed(0)}).`
      : expected >= 15
        ? `Setup-belief ${(belief * 100).toFixed(0)}% — hold ~${expected.toFixed(0)} ticks; enter promptly.`
        : `Setup-belief low (${(belief * 100).toFixed(0)}%); ~${expected.toFixed(0)} ticks — may not survive DBot startup.`;

  return {
    expectedTicks: Math.round(expected),
    survival30s: survival(30),
    survival60s: survival(60),
    survival90s: survival(90),
    narrative,
    belief,
    decay: lambda,
    ci68Ticks: [Math.round(ticksLo68), Math.round(ticksHi68)],
    ci95Ticks: [Math.round(ticksLo95), Math.round(ticksHi95)],
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function clamp(lo: number, hi: number, x: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
