// Precision Parity AI — Confluence & Evidence Fusion Engine.
// Aggregates votes, weights, and sample counts across all specialist parity engines.

import type { ParityStatsEngineResult } from "./stats-engine";
import type { ParityMarkovEngineResult } from "./markov-engine";
import type { ParityRunEngineResult } from "./run-hazard-engine";
import type { ParityPressureResult } from "./pressure-engine";
import type { ParityPatternEngineResult } from "./pattern-engine";
import type { ParityRegimeResult } from "./regime-engine";
import type { ParityAnomalyResult } from "./anomaly-engine";

export interface SupportingEngineVote {
  name: string;
  vote: string; // e.g. "EVEN (58.4% Win, Wilson LB 53.1%)"
  weight: number;
  sampleSize: number;
  side: "EVEN" | "ODD" | "NEUTRAL";
  rawSignal: number; // -1 (strong odd) to +1 (strong even)
}

export interface ParityConfluenceResult {
  favouredSide: "EVEN" | "ODD" | "NO_TRADE";
  compositeScore: number; // 0..100 (50 is neutral, >50 Even, <50 Odd)
  rawConfidence: number; // 0..100
  agreementRatio: number; // fraction of engines that agree (0..1)
  supportingEngines: SupportingEngineVote[];
  opposingEngines: SupportingEngineVote[];
  neutralEngines: SupportingEngineVote[];
  summary: string;
}

export function runParityConfluenceEngine(
  stats: ParityStatsEngineResult,
  markov: ParityMarkovEngineResult,
  runs: ParityRunEngineResult,
  pressure: ParityPressureResult,
  patterns: ParityPatternEngineResult,
  regime: ParityRegimeResult,
  anomaly: ParityAnomalyResult,
  discountFactor: number = 1.0,
): ParityConfluenceResult {
  const votes: SupportingEngineVote[] = [];
  const rw = regime.engineWeights;

  // 1. Multi-Window Stats Engine
  const statsSide = stats.dominantSide;
  const statsSignal =
    statsSide === "EVEN"
      ? (stats.pointEstimatePWin - 0.5) * 2
      : statsSide === "ODD"
        ? -(stats.pointEstimatePWin - 0.5) * 2
        : 0;
  votes.push({
    name: "Wilson Bounds Stats",
    vote: `${statsSide} (LB ${(stats.lowerBoundPWin * 100).toFixed(1)}%, Point ${(stats.pointEstimatePWin * 100).toFixed(1)}%)`,
    weight: (rw.stats ?? 1.0) * 1.5 * discountFactor,
    sampleSize: stats.windows[stats.primaryWindow]?.sampleSize ?? 50,
    side: statsSide,
    rawSignal: statsSignal,
  });

  // 2. Markov Transitions Engine
  const markovSide = markov.favouredSide;
  const markovSignal =
    markovSide === "EVEN"
      ? (markov.pointEstimatePWin - 0.5) * 2
      : markovSide === "ODD"
        ? -(markov.pointEstimatePWin - 0.5) * 2
        : 0;
  votes.push({
    name: `Markov Transitions (Ord-${markov.preferredOrder})`,
    vote: `${markovSide} (P=${(markov.pointEstimatePWin * 100).toFixed(1)}%, LB ${(markov.lowerBoundPWin * 100).toFixed(1)}%)`,
    weight: (rw.markov ?? 1.0) * 1.4,
    sampleSize: markov.sampleSize,
    side: markovSide,
    rawSignal: markovSignal,
  });

  // 3. Run Hazard & Lifecycle Engine
  let runSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
  let runSignal = 0;
  if (runs.suggestedAction === "FADE_RUN" || runs.suggestedAction === "WAIT_FOR_BREAK") {
    // Fade active side
    runSide = runs.activeSide === "EVEN" ? "ODD" : "EVEN";
    runSignal =
      runSide === "EVEN" ? (runs.pBreakNextTick - 0.5) * 2 : -(runs.pBreakNextTick - 0.5) * 2;
  } else if (runs.suggestedAction === "RIDE_RUN") {
    runSide = runs.activeSide;
    runSignal =
      runSide === "EVEN" ? (runs.pContinueNextTick - 0.5) * 2 : -(runs.pContinueNextTick - 0.5) * 2;
  }
  votes.push({
    name: "Run Lifecycle & Hazard",
    vote: `${runSide} (Action: ${runs.suggestedAction}, Hazard ${(runs.pBreakNextTick * 100).toFixed(1)}%)`,
    weight: (rw.runs ?? 1.0) * 1.6,
    sampleSize: runs.sampleSizeAtThisLength,
    side: runSide,
    rawSignal: runSignal,
  });

  // 4. Pressure & Imbalance Engine
  const pressureSide = pressure.favouredMeanReversion;
  const pressureSignal =
    pressureSide === "EVEN"
      ? Math.min(1, Math.abs(pressure.zScore) / 3)
      : pressureSide === "ODD"
        ? -Math.min(1, Math.abs(pressure.zScore) / 3)
        : 0;
  votes.push({
    name: "Pressure & Imbalance",
    vote: `${pressureSide} (Imbalance ${pressure.cumulativeImbalance > 0 ? "+" : ""}${pressure.cumulativeImbalance}, z=${pressure.zScore.toFixed(2)})`,
    weight: (rw.pressure ?? 1.0) * 1.2 * discountFactor,
    sampleSize: 100,
    side: pressureSide,
    rawSignal: pressureSignal,
  });

  // 5. Sequence & Motif Mining
  const patSide = patterns.favouredSide;
  const patSignal =
    patSide === "EVEN"
      ? (patterns.pointEstimatePWin - 0.5) * 2
      : patSide === "ODD"
        ? -(patterns.pointEstimatePWin - 0.5) * 2
        : 0;
  votes.push({
    name: "Pattern & Motif Mining",
    vote: patterns.topMotif
      ? `${patSide} [${patterns.topMotif.ngram}] (P=${(patterns.pointEstimatePWin * 100).toFixed(1)}%)`
      : "NEUTRAL",
    weight: (rw.patterns ?? 1.0) * 1.2,
    sampleSize: patterns.sampleSize,
    side: patSide,
    rawSignal: patSignal,
  });

  // 6. Anomaly & Z-Score
  const anomalySide =
    anomaly.anomalyDirection === "SURGE_EVEN"
      ? "EVEN"
      : anomaly.anomalyDirection === "SURGE_ODD"
        ? "ODD"
        : "NEUTRAL";
  votes.push({
    name: "Anomaly Z-Score",
    vote: `${anomalySide} (z=${anomaly.zScore.toFixed(2)}, ${anomaly.significanceLevel})`,
    weight: 1.0 * discountFactor,
    sampleSize: 30,
    side: anomalySide,
    rawSignal: anomalySide === "EVEN" ? 0.5 : anomalySide === "ODD" ? -0.5 : 0,
  });

  // Weighted aggregation
  let totalWeightedSignal = 0;
  let totalWeight = 0;

  for (const v of votes) {
    totalWeightedSignal += v.rawSignal * v.weight;
    totalWeight += v.weight;
  }

  const netNormalized = totalWeight > 0 ? totalWeightedSignal / totalWeight : 0;
  const compositeScore = Math.round(50 + netNormalized * 50);

  let favouredSide: "EVEN" | "ODD" | "NO_TRADE" = "NO_TRADE";
  let rawConfidence = 50;

  if (compositeScore >= 53) {
    favouredSide = "EVEN";
    rawConfidence = compositeScore;
  } else if (compositeScore <= 47) {
    favouredSide = "ODD";
    rawConfidence = 100 - compositeScore;
  }

  const supportingEngines = votes.filter((v) => v.side === favouredSide);
  const opposingEngines = votes.filter((v) => v.side !== "NEUTRAL" && v.side !== favouredSide);
  const neutralEngines = votes.filter((v) => v.side === "NEUTRAL");

  const agreementRatio = votes.length > 0 ? supportingEngines.length / votes.length : 0;

  const summary = `Confluence: ${favouredSide} (${supportingEngines.length}/${votes.length} engines aligned, Raw Conf ${rawConfidence}%)`;

  return {
    favouredSide,
    compositeScore,
    rawConfidence,
    agreementRatio,
    supportingEngines,
    opposingEngines,
    neutralEngines,
    summary,
  };
}
