// Precision Parity AI — Payout-Aware Expected Value Gate Engine.
// Single most important rule: Deriv contracts pay ~0.95:1 (or variable). A 51% hit rate on 0.95 payout loses money.
// Signals with expected value <= 0 are strictly suppressed.

export interface EVGateResult {
  payoutRate: number; // e.g. 0.95 (net return per unit stake on win)
  breakevenProbability: number; // 1 / (1 + payoutRate) = ~51.28% for 0.95 payout
  pointEstimateEV: number; // EV per unit stake using point estimate p
  lowerBoundEV: number; // EV per unit stake using Wilson lower bound p_lower
  clearsGate: boolean;
  edgePercentagePoints: number; // (p_lower - breakeven) * 100
  vetoReason: string | null;
  summary: string;
}

export function runEVGateEngine(
  lowerProbability: number,
  pointProbability: number,
  payoutRate: number = 0.95,
): EVGateResult {
  // Breakeven probability: p * (1 + payoutRate) = 1  =>  p = 1 / (1 + payoutRate)
  const breakeven = 1 / (1 + payoutRate);

  // Expected value = p * payoutRate - (1 - p) * 1 = p * (1 + payoutRate) - 1
  const pointEV = pointProbability * (1 + payoutRate) - 1;
  const lowerEV = lowerProbability * (1 + payoutRate) - 1;

  // We require the lower bound EV to be positive (or minimally non-negative) for high-conviction signals
  const clearsGate = lowerEV > 0;
  const edgePp = (lowerProbability - breakeven) * 100;

  let vetoReason: string | null = null;
  if (!clearsGate) {
    if (pointEV <= 0) {
      vetoReason = `Negative EV: point probability ${(pointProbability * 100).toFixed(1)}% is below breakeven ${(breakeven * 100).toFixed(1)}% for payout ${payoutRate.toFixed(2)}:1 (EV = ${(pointEV * 100).toFixed(2)}%)`;
    } else {
      vetoReason = `Insufficient statistical edge: Wilson lower bound ${(lowerProbability * 100).toFixed(1)}% fails payout breakeven ${(breakeven * 100).toFixed(1)}% (Lower EV = ${(lowerEV * 100).toFixed(2)}%)`;
    }
  }

  const summary = clearsGate
    ? `EV Gate CLEARED: Edge +${edgePp.toFixed(1)}pp over breakeven (Lower EV +${(lowerEV * 100).toFixed(1)}% per unit)`
    : `EV Gate BLOCKED: ${vetoReason}`;

  return {
    payoutRate,
    breakevenProbability: breakeven,
    pointEstimateEV: pointEV,
    lowerBoundEV: lowerEV,
    clearsGate,
    edgePercentagePoints: edgePp,
    vetoReason,
    summary,
  };
}
