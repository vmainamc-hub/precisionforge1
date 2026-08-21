// Bridges the Settings drawer (PrecisionSettings) into the bot signal layer.
// Every control in the drawer must have a real effect on signal production —
// nothing in the engine may hardcode a gate that the operator can see.
import type { PrecisionSettings } from "@/hooks/usePrecisionSettings";
import type { BotSignalConfig } from "./config";

/** Settings → bot config (Equilibrium Doctrine, vetoes, quality gates). */
export function botConfigFromSettings(s: PrecisionSettings): Partial<BotSignalConfig> {
  const window = Math.max(100, Math.round(s.botWindowTicks));
  return {
    canonicalWindow: window,
    minTicksFullConfidence: window,
    // Bands are derived from the operator's tolerance so the UI band labels and
    // the hard gate can never disagree.
    maxEquilibriumError: s.equilibriumTolerance,
    bands: {
      perfect: s.equilibriumTolerance,
      prime: s.equilibriumTolerance * 2,
      acceptable: s.equilibriumTolerance * 5,
      drifting: s.equilibriumTolerance * 10,
    },
    eMax: Math.max(1, s.equilibriumTolerance * 15),
    // Manipulation tolerance maps onto the equilibrium-score floor AND is
    // enforced directly as a hard veto against the distribution-anomaly score.
    minEquilibriumScore: Math.max(0, Math.min(100, 100 - s.maxManipulation)),
    maxManipulation: Math.max(1, Math.min(100, s.maxManipulation)),
    // Required edge over fair (in percentage points) lifts the simulated
    // win-rate floor on top of the operator's base requirement, and is also a
    // hard veto against the realised per-trade edge.
    minSimWinRate: Math.max(
      0.01,
      Math.min(0.99, s.minSimWinRate + Math.max(0, s.minEdgePct) / 100),
    ),
    minEdgePct: s.minEdgePct,
    // Cross-window disagreement tolerance — hard veto.
    fluctuationTolerance: Math.max(0, Math.min(1, s.fluctuationTolerance)),
    maxDriftVelocity: s.maxDriftVelocity,
    martingaleDepth: Math.round(s.martingaleDepth),
    minCalibrationReliability: s.minCalibrationReliability,
    // Operator persistence floor — enforced as a hard veto on every code path.
    minPersistenceTicks: Math.max(0, Math.round(s.minPersistenceTicks)),
    // PRIMARY LAW 2 — balanced edges (0,1 vs 8,9).
    maxEdgeImbalance: Math.max(0.1, s.edgeImbalanceTolerance),
    edgeEMax: Math.max(2, s.edgeImbalanceTolerance * 4),
    recommendationThreshold: s.threshold,
    vetoes: { ...s.botVetoes },
  };
}

/** Settings engine weights → orchestrator engine weights. */
export function engineWeightsFromSettings(s: PrecisionSettings): Record<string, number> {
  const w = s.weights;
  return {
    digitStatistics: w.digitStatistics,
    psychology: w.psychology,
    contrarian: w.contrarian,
    greenRed: w.barMomentum,
    zone: w.digitZones,
    recovery: w.recoveryFit,
    botSimulator: w.botCompatibility,
    setupStability: w.persistence,
    marketHealth: w.marketHealth,
  };
}
