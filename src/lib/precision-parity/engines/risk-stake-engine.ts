// Precision Parity AI — Risk & Stake Sizing Engine.
// Implements Fractional Kelly criterion sizing with conservative risk tiers, consecutive loss cooldowns,
// and hard maximum stake guards.

export interface ParityStakeResult {
  tier: 1 | 2 | 3;
  suggestedStake: number; // in account currency units (e.g. $1.00 - $10.00 base)
  kellyFraction: number; // full theoretical Kelly fraction
  appliedFraction: number; // fractional Kelly (e.g. 1/4 or 1/8 Kelly)
  capReason?: string;
  isCooldownActive: boolean;
  maxRecommendedRuns: number; // consecutive trades allowed
  summary: string;
}

export function runParityStakeEngine(
  calibratedConfidencePct: number, // 0..100
  payoutRate: number = 0.95, // e.g. 0.95 for 0.95:1 payout
  consecutiveLosses: number = 0,
  baseUnit: number = 1.0,
): ParityStakeResult {
  const p = Math.max(0.5, Math.min(0.99, calibratedConfidencePct / 100));
  const b = payoutRate; // net odds

  // Kelly formula: f* = (p * b - (1 - p)) / b = p - (1-p)/b = (p * (b + 1) - 1) / b
  const fullKelly = Math.max(0, (p * (b + 1) - 1) / b);

  // Conservative 1/4 Fractional Kelly
  const fractionalKelly = fullKelly * 0.25;

  let tier: 1 | 2 | 3 = 1;
  let suggested = baseUnit;
  let capReason: string | undefined;
  let isCooldownActive = false;
  let maxRuns = 1;

  if (consecutiveLosses >= 3) {
    isCooldownActive = true;
    tier = 1;
    suggested = baseUnit * 0.5;
    capReason = `Loss cooldown active (${consecutiveLosses} consecutive losses)`;
    maxRuns = 1;
  } else if (calibratedConfidencePct >= 72 && fractionalKelly >= 0.04) {
    tier = 3;
    suggested = Math.round(baseUnit * 3.0 * 100) / 100;
    maxRuns = 3;
  } else if (calibratedConfidencePct >= 62 && fractionalKelly >= 0.02) {
    tier = 2;
    suggested = Math.round(baseUnit * 2.0 * 100) / 100;
    maxRuns = 2;
  } else {
    tier = 1;
    suggested = baseUnit;
    maxRuns = 1;
  }

  // Hard safety cap: never exceed 5x base unit
  if (suggested > baseUnit * 5) {
    suggested = baseUnit * 5;
    capReason = "Capped at 5x base risk ceiling";
  }

  const summary = `Stake Tier ${tier} (${suggested.toFixed(2)} units, 1/4-Kelly ${(fractionalKelly * 100).toFixed(1)}%)${capReason ? ` [${capReason}]` : ""}`;

  return {
    tier,
    suggestedStake: suggested,
    kellyFraction: Number(fullKelly.toFixed(4)),
    appliedFraction: Number(fractionalKelly.toFixed(4)),
    capReason,
    isCooldownActive,
    maxRecommendedRuns: maxRuns,
    summary,
  };
}
