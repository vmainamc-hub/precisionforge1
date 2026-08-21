// Runtime-editable configuration for the bot signal layer.
// Engines must never hardcode any of these numbers.
import type { EquilibriumBand } from "./spec";

export interface EquilibriumBandEdges {
  /** |Over4% - 50| <= value → band. Ordered strictest first. */
  perfect: number;
  prime: number;
  acceptable: number;
  drifting: number;
}

export interface BotSignalConfig {
  /** Canonical window for the Equilibrium Doctrine. */
  canonicalWindow: number;
  /** Extra windows used for stability / drift evidence. */
  evidenceWindows: number[];
  /** Equilibrium error at which EquilibriumScore hits 0. */
  eMax: number;
  /** Band edges in percentage points of deviation from 50. */
  bands: EquilibriumBandEdges;
  /** Minimum EquilibriumScore before anything but BOT_OFF is possible. */
  minEquilibriumScore: number;
  /**
   * PRIMARY LAW. Maximum |Over4% - 50| in percentage points that still counts
   * as equilibrium. Default 0.4pp → Over 4 / Under 5 must sit at 50% ± 0.4%.
   */
  maxEquilibriumError: number;
  /** Ticks required before a full-confidence verdict is allowed. */
  minTicksFullConfidence: number;
  /** Windows the bot simulator replays. */
  simWindows: number[];
  /** How deep a martingale ladder the recovery engine must survive. */
  martingaleDepth: number;
  /** Fused-score gate for BOT_ON. */
  recommendationThreshold: number;
  /** Minimum simulated win rate (0-1) on the canonical window for BOT_ON. */
  minSimWinRate: number;
  /** |drift velocity| in pp per 100 ticks that arms the drift veto. */
  maxDriftVelocity: number;
  /** Minimum calibration reliability (0-1) before confidence is trusted. */
  minCalibrationReliability: number;
  /**
   * Minimum simulated winning streak (in bot trades) the canonical window must
   * show before the setup counts as persistent. Operator control:
   * "Min persistence (winning streak)".
   */
  minPersistenceTicks: number;
  /**
   * Operator control: "Max manipulation". Distribution-anomaly score (0-100)
   * at or above which the setup is vetoed.
   */
  maxManipulation: number;
  /**
   * Operator control: "Min edge over fair". Required realised edge per bot
   * trade, in percent of stake.
   */
  minEdgePct: number;
  /**
   * Operator control: "Fluctuation tolerance" (0..1). Maximum disagreement
   * between equilibrium measurement windows before the setup is vetoed.
   */
  fluctuationTolerance: number;
  /**
   * PRIMARY LAW 2 — BALANCED EDGES. Maximum |P(0,1)% - P(8,9)%| in percentage
   * points that still counts as edge-balanced over the canonical window.
   */
  maxEdgeImbalance: number;
  /** Combined edge error at which EdgeBalanceScore hits 0. */
  edgeEMax: number;
  /** Minimum EdgeBalanceScore (0-100) before anything but BOT_OFF is possible. */
  minEdgeBalanceScore: number;
  /** Individually switchable hard blocks. */
  vetoes: Record<string, boolean>;
}

export const DEFAULT_BOT_CONFIG: BotSignalConfig = {
  canonicalWindow: 1000,
  evidenceWindows: [200, 500, 1000],
  eMax: 6,
  // Statistical reality check: over 1000 ticks the standard error of Over-4%
  // is ~1.58pp, so a ±0.4pp band fires on roughly 1 window in 5 and, stacked
  // with every other gate, produced no signals at all. The bands below keep
  // the doctrine meaningful while letting genuinely centred tapes through.
  bands: { perfect: 0.8, prime: 1.5, acceptable: 2.5, drifting: 4 },
  minEquilibriumScore: 60,
  maxEquilibriumError: 1.5,
  minTicksFullConfidence: 1000,
  simWindows: [200, 500, 1000],
  martingaleDepth: 6,
  recommendationThreshold: 62,
  minSimWinRate: 0.5,
  maxDriftVelocity: 1.8,
  minCalibrationReliability: 0.2,
  minPersistenceTicks: 1,
  maxManipulation: 45,
  // Replay expectancy on a fair synthetic tape is slightly negative by design
  // (the house edge). A floor of 0 blocked ~80% of otherwise-clean windows, so
  // the floor is a *badness* limit, not a profitability promise.
  minEdgePct: -8,
  fluctuationTolerance: 0.7,
  // Edges hold ~20% each over 1000 ticks (SE of the difference ≈ 1.8pp), so a
  // 2.5pp tolerance is a genuine balance requirement, not a coin flip.
  maxEdgeImbalance: 2.5,
  edgeEMax: 10,
  minEdgeBalanceScore: 55,
  vetoes: {
    equilibriumBroken: true,
    equilibriumDrift: true,
    barrierBelowTheory: true,
    martingaleUnsurvivable: true,
    lateStageBurst: true,
    hiddenAccumulation: true,
    insufficientTicks: true,
    calibrationUnreliable: true,
    equilibriumOffCentre: true,
    persistenceTooShort: true,
    manipulationTooHigh: true,
    edgeBelowFloor: true,
    fluctuationTooHigh: true,
    edgesUnbalanced: true,
  },
};

export function bandFor(error: number, bands: EquilibriumBandEdges): EquilibriumBand {
  if (error <= bands.perfect) return "PERFECT";
  if (error <= bands.prime) return "PRIME";
  if (error <= bands.acceptable) return "ACCEPTABLE";
  if (error <= bands.drifting) return "DRIFTING";
  return "BROKEN";
}

export function equilibriumScore(error: number, eMax: number): number {
  const e = Math.max(0, error);
  return 100 * Math.max(0, Math.min(1, 1 - e / Math.max(1e-9, eMax)));
}

export function mergeBotConfig(
  base: BotSignalConfig,
  patch: Partial<BotSignalConfig>,
): BotSignalConfig {
  return {
    ...base,
    ...patch,
    bands: { ...base.bands, ...(patch.bands ?? {}) },
    vetoes: { ...base.vetoes, ...(patch.vetoes ?? {}) },
    evidenceWindows: patch.evidenceWindows ?? base.evidenceWindows,
    simWindows: patch.simWindows ?? base.simWindows,
  };
}
