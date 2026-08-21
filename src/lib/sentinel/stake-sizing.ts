// APEX SENTINEL — STAKE-SIZING ENGINE (FRACTIONAL KELLY).
//
// Purpose:
// calibration.ts already produces a real calibrated win probability from
// realized outcomes (isotonic regression + Brier/ECE tracking). Nothing in
// Sentinel previously used that probability for anything but display — sizing
// was left entirely to a separate pipeline (precision-parity's
// risk-stake-engine.ts). This engine lets calibration.ts's own output decide
// stake size, so the number the operator sees is driven by the SAME evidence
// that produced the calibrated probability, not a second, disconnected model.
//
// This is advisory only — it recommends a stake, it does not place a trade.
// Sentinel never touches execution.
//
// Kelly criterion, fixed-odds form:
//   f* = p − (1 − p) / b
//   where p = calibrated win probability, b = net payout odds (win pays b
//   units per 1 unit staked; a 0.95:1 payout is b = 0.95).
//
// Fractional Kelly (applying only a fraction of f*) is the standard
// real-world adjustment: full Kelly is provably optimal only under a
// long-run, perfectly-known-p assumption neither of which holds for a
// calibrated-from-a-finite-sample estimate, so full Kelly overstates
// confidence in the estimate itself and produces ruinous variance.

export type StakeGuardReason =
  | "INSUFFICIENT_CALIBRATION"
  | "NEGATIVE_EDGE"
  | "LOSING_SIDE_HOSTILE"
  | "COOLDOWN_ACTIVE"
  | "NONE";

export interface StakeSizingInputs {
  /** 0..1 — from calibration.ts's CalibrationResult.calibratedProbability. */
  calibratedProbability: number;
  /** From calibration.ts's CalibrationResult.reliabilityState. */
  reliabilityState: "CALIBRATED" | "PROVISIONAL" | "INSUFFICIENT CALIBRATION DATA";
  /** Sample size behind the calibration, for transparency in the summary. */
  sampleSize: number;
  /** Net payout odds b (win pays b units per 1 staked). */
  payoutRatio: number;
  /** Fraction of full Kelly to actually apply. Default 0.25 (quarter-Kelly). */
  kellyFraction?: number;
  /** Hard ceiling on stake as a fraction of bankroll, regardless of Kelly. */
  maxBankrollFraction?: number;
  /** Current bankroll in account currency, for a concrete stake figure. */
  bankroll?: number;
  /** Consecutive losses on this exact combination — triggers a cooldown. */
  consecutiveLosses?: number;
  /** Losing-side pressure state (see losing-side-pressure.ts), if available —
   * a HOSTILE losing side zeroes the recommended stake even if Kelly is
   * positive, mirroring the same hard gate applied in entry-clearance.ts. */
  losingSideState?: "CALM" | "BUILDING" | "PRESSURED" | "HOSTILE" | null;
}

export interface StakeSizingReport {
  /** Full, unclamped Kelly fraction — informational, never itself the stake. */
  fullKelly: number;
  /** fullKelly × kellyFraction, before any guard/cap is applied. */
  appliedKellyFraction: number;
  /** Final recommended stake as a fraction of bankroll, 0 when guarded off. */
  recommendedFraction: number;
  /** Final recommended stake in currency units, when bankroll is supplied. */
  recommendedStake: number | null;
  guard: StakeGuardReason;
  summary: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const DEFAULT_KELLY_FRACTION = 0.25;
const DEFAULT_MAX_BANKROLL_FRACTION = 0.03; // hard ceiling: never stake >3% of bankroll on one signal
const COOLDOWN_LOSS_THRESHOLD = 3;

export function computeStakeSizing(input: StakeSizingInputs): StakeSizingReport {
  const {
    calibratedProbability,
    reliabilityState,
    sampleSize,
    payoutRatio,
    kellyFraction = DEFAULT_KELLY_FRACTION,
    maxBankrollFraction = DEFAULT_MAX_BANKROLL_FRACTION,
    bankroll,
    consecutiveLosses = 0,
    losingSideState = null,
  } = input;

  const p = clamp(calibratedProbability, 0, 1);
  const b = Math.max(0.01, payoutRatio);

  const fullKelly = p - (1 - p) / b;
  const appliedKellyFraction = fullKelly * kellyFraction;

  // ── Guards, evaluated in order of severity ─────────────────────────────
  let guard: StakeGuardReason = "NONE";
  let recommendedFraction = 0;

  if (reliabilityState === "INSUFFICIENT CALIBRATION DATA") {
    guard = "INSUFFICIENT_CALIBRATION";
  } else if (consecutiveLosses >= COOLDOWN_LOSS_THRESHOLD) {
    guard = "COOLDOWN_ACTIVE";
  } else if (losingSideState === "HOSTILE") {
    guard = "LOSING_SIDE_HOSTILE";
  } else if (fullKelly <= 0) {
    guard = "NEGATIVE_EDGE";
  } else {
    recommendedFraction = clamp(appliedKellyFraction, 0, maxBankrollFraction);
    // PROVISIONAL calibration (below combination-learning's full sample
    // threshold) still earns a stake, but is halved on top of the Kelly
    // fraction — extra caution while the estimate itself is still settling.
    if (reliabilityState === "PROVISIONAL") recommendedFraction *= 0.5;
  }

  const recommendedStake =
    bankroll != null ? Math.round(bankroll * recommendedFraction * 100) / 100 : null;

  const guardText: Record<StakeGuardReason, string> = {
    INSUFFICIENT_CALIBRATION: `No stake — calibration sample (N=${sampleSize}) is below the threshold to trust ${(p * 100).toFixed(1)}% as a real probability yet.`,
    NEGATIVE_EDGE: `No stake — full Kelly is ${(fullKelly * 100).toFixed(2)}% (≤0): at p=${(p * 100).toFixed(1)}% and payout ${b.toFixed(2)}:1 there is no positive edge to size.`,
    LOSING_SIDE_HOSTILE: "No stake — losing-side digit pressure is HOSTILE, overriding a positive Kelly fraction.",
    COOLDOWN_ACTIVE: `No stake — ${consecutiveLosses} consecutive losses triggered the cooldown guard.`,
    NONE: `Stake ${(recommendedFraction * 100).toFixed(2)}% of bankroll (${kellyFraction}× Kelly of ${(fullKelly * 100).toFixed(2)}%, capped at ${(maxBankrollFraction * 100).toFixed(1)}%)${reliabilityState === "PROVISIONAL" ? ", halved for PROVISIONAL calibration" : ""}.`,
  };

  return {
    fullKelly: Number(fullKelly.toFixed(4)),
    appliedKellyFraction: Number(appliedKellyFraction.toFixed(4)),
    recommendedFraction: Number(recommendedFraction.toFixed(4)),
    recommendedStake,
    guard,
    summary: guardText[guard],
  };
}
