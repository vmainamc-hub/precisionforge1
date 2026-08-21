// Phase 8 — Payout-Aware EV & Quarter-Kelly Gate
// Enforces positive expected value using conservative conformal bounds and statistical gating.

import type { ConformalReport } from "./conformal";
import type { SignificanceReport } from "./significance";
import type { ParticleReport } from "./particle-filter";
import type { DriftReport } from "./drift";

export interface EVGateReport {
  evPoint: number;
  evLow: number;
  breakEvenProb: number;
  kellyFraction: number;
  quarterKelly: number;
  varianceAdjustedScore: number;
  status: "READY" | "HOLD";
  reasons: string[];
  recommendedStakePct: number; // e.g. 1.25% of bankroll
  narrative: string;
}

export function evaluateEVGate(args: {
  conformal: ConformalReport;
  significance: SignificanceReport;
  particles: ParticleReport;
  drift: DriftReport;
  payoutRate?: number; // default 0.95
  baseBankroll?: number;
}): EVGateReport {
  const payout = args.payoutRate ?? 0.95;
  const breakEvenProb = 1 / (1 + payout); // 0.5128 for 0.95

  const pPoint = args.conformal.pointEstimate;
  const pLow = args.conformal.intervalLow;

  // EV = p * payout - (1 - p) * 1.0
  const evPoint = pPoint * payout - (1 - pPoint);
  const evLow = pLow * payout - (1 - pLow);

  // Full Kelly fraction: f* = (p * (1 + b) - 1) / b, where b = payout
  const rawKelly = (pPoint * (1 + payout) - 1) / payout;
  const kellyFraction = Math.max(0, Math.min(0.25, rawKelly));
  const quarterKelly = Math.max(0, Math.min(0.05, kellyFraction * 0.25));
  const recommendedStakePct = Math.max(0.25, Math.round(quarterKelly * 10000) / 100);

  // Variance from binomial: p * (1 - p) * (1 + payout)^2
  const variance = Math.max(0.01, pPoint * (1 - pPoint) * (1 + payout) ** 2);
  const varianceAdjustedScore = evLow / Math.sqrt(variance);

  const reasons: string[] = [];

  if (evLow <= 0.02) {
    reasons.push(
      `Conformal lower bound EV (${(evLow * 100).toFixed(2)}%) is below institutional threshold (+2.00%).`,
    );
  }
  if (!args.significance.significant) {
    reasons.push(
      `Failed statistical significance gate (q=${args.significance.qValue.toFixed(4)}, bootstrap 5th%=${(args.significance.bootstrapLow * 100).toFixed(1)}%).`,
    );
  }
  if (args.particles.weightCollapse) {
    reasons.push(
      `SMC Particle Filter weight collapse (ESS ${args.particles.effectiveParticles.toFixed(0)} < 10%).`,
    );
  }
  if (args.drift.severity === "MAJOR") {
    reasons.push(`Major structural regime break detected by two-sided CUSUM / Page-Hinkley.`);
  }

  const isReady = reasons.length === 0;
  const status: "READY" | "HOLD" = isReady ? "READY" : "HOLD";

  const narrative = isReady
    ? `ALL GATES PASSED: Conformal lower-bound EV is +${(evLow * 100).toFixed(2)}% (point EV +${(evPoint * 100).toFixed(2)}%). Recommended Quarter-Kelly stake: ${recommendedStakePct.toFixed(2)}% of account capital.`
    : `EXECUTION HELD: ${reasons.join(" ")}`;

  return {
    evPoint,
    evLow,
    breakEvenProb,
    kellyFraction,
    quarterKelly,
    varianceAdjustedScore,
    status,
    reasons,
    recommendedStakePct,
    narrative,
  };
}
