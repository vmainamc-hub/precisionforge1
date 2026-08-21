// APEX SENTINEL — OPERATOR LEARNING VISIBILITY (read-only view model).
//
// PURE PRESENTATION AGGREGATION. It reads the EXISTING operator-learning
// patterns and the EXISTING feedback store. It does not persist anything,
// does not create trades, does not change thresholds, and does not produce
// any new influence maths — every number below already exists in the engine.
import { operatorPatterns, type OperatorPattern } from "./operator-learning";

/** Thresholds mirrored (read-only) from operator-learning.ts status logic. */
const SUPPORTED_TRADES = 6;
const VALIDATED_TRADES = 12;
/** Minimum subsequent confirmed trades before a hypothesis can be tested at all. */
const TESTABLE_TRADES = 3;

export interface OperatorLearningCounts {
  /** Total written operator observations remembered across all buckets. */
  observationsRemembered: number;
  beingTested: number;
  supported: number;
  validated: number;
  discounted: number;
}

export interface OperatorPatternProgress {
  pattern: OperatorPattern;
  /** Existing status, unchanged. */
  status: OperatorPattern["status"];
  /** Confirmed trades that happened AFTER the first observation. */
  subsequentTrades: number;
  /** Next status this bucket could reach, or null when terminal. */
  nextStage: "BEING TESTED" | "SUPPORTED" | "VALIDATED" | null;
  /** Confirmed trades required for that next stage (existing thresholds). */
  requiredForNextStage: number | null;
  /** Additional trades still missing (never negative). */
  tradesRemaining: number | null;
  explanation: string;
}

export interface OperatorLearningSummary {
  counts: OperatorLearningCounts;
  /** Buckets not yet supported/validated/discounted, most recent first. */
  inProgress: OperatorPatternProgress[];
  /** Most recently observed operator note (verbatim) with its existing status. */
  mostRecent: {
    text: string;
    status: OperatorPattern["status"];
    pattern: OperatorPattern;
  } | null;
  /** Bounded influence currently offered by operator learning. */
  influence: {
    entry: number;
    ranking: number;
    active: boolean;
  };
}

function progressFor(p: OperatorPattern): OperatorPatternProgress {
  const subsequentTrades = p.relatedTrades;
  let nextStage: OperatorPatternProgress["nextStage"] = null;
  let requiredForNextStage: number | null = null;

  if (p.status === "DISCOUNTED" || p.status === "VALIDATED") {
    nextStage = null;
  } else if (p.status === "OBSERVATION") {
    nextStage = "BEING TESTED";
    requiredForNextStage = TESTABLE_TRADES;
  } else if (p.status === "EMERGING") {
    nextStage = "SUPPORTED";
    requiredForNextStage = SUPPORTED_TRADES;
  } else {
    nextStage = "VALIDATED";
    requiredForNextStage = VALIDATED_TRADES;
  }

  const tradesRemaining =
    requiredForNextStage === null ? null : Math.max(0, requiredForNextStage - subsequentTrades);

  const explanation =
    p.status === "DISCOUNTED"
      ? "Subsequent confirmed trades contradicted this observation, so its influence is discounted."
      : p.status === "VALIDATED"
        ? "Enough consistent subsequent confirmed trades to support bounded future influence."
        : tradesRemaining && tradesRemaining > 0
          ? `Feedback remembered and awaiting sufficient subsequent evidence — ${tradesRemaining} more confirmed trade${tradesRemaining === 1 ? "" : "s"} in this exact market, contract and entry-digit bucket.`
          : "Evidence is remembered, but the sample is not yet consistent enough for strong statistical inference.";

  return {
    pattern: p,
    status: p.status,
    subsequentTrades,
    nextStage,
    requiredForNextStage,
    tradesRemaining,
    explanation,
  };
}

export function summariseOperatorLearning(patterns: OperatorPattern[]): OperatorLearningSummary {
  const counts: OperatorLearningCounts = {
    observationsRemembered: patterns.reduce((a, p) => a + p.observations, 0),
    beingTested: patterns.filter((p) => p.status === "OBSERVATION" || p.status === "EMERGING")
      .length,
    supported: patterns.filter((p) => p.status === "SUPPORTED").length,
    validated: patterns.filter((p) => p.status === "VALIDATED").length,
    discounted: patterns.filter((p) => p.status === "DISCOUNTED").length,
  };

  const inProgress = patterns
    .filter((p) => p.status === "OBSERVATION" || p.status === "EMERGING")
    .sort((a, b) => b.lastObservedAt - a.lastObservedAt)
    .map(progressFor);

  // Bounded values already produced by the engine — summed for display only.
  const entry = Math.round(patterns.reduce((a, p) => a + p.entryAdjustment, 0) * 10) / 10;
  const ranking = Math.round(patterns.reduce((a, p) => a + p.rankingAdjustment, 0) * 10) / 10;

  const latest = [...patterns].sort((a, b) => b.lastObservedAt - a.lastObservedAt)[0];
  const mostRecent =
    latest && latest.samples[0]
      ? { text: latest.samples[0], status: latest.status, pattern: latest }
      : null;

  return {
    counts,
    inProgress,
    mostRecent,
    influence: {
      entry,
      ranking,
      active: Math.abs(entry) >= 0.5 || Math.abs(ranking) >= 0.5,
    },
  };
}

/** Live summary derived from the existing persisted store. */
export function operatorLearningSummary(now = Date.now()): OperatorLearningSummary {
  return summariseOperatorLearning(operatorPatterns(now));
}
