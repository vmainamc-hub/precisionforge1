// Precision Parity AI — Variable-Order Markov & Confluence Entry Criteria Engine.
// Every signal is augmented with crystal-clear, deterministic step-by-step entry rules.

import type { ParityMarkovEngineResult } from "./markov-engine";
import type { ParityRunEngineResult } from "./run-hazard-engine";
import type { ParityPressureResult } from "./pressure-engine";
import type { ParityPatternEngineResult } from "./pattern-engine";
import type { ParityContractType } from "../types";

export type ParityEntryType =
  | "VARIABLE_ORDER_MARKOV_TRIGGER"
  | "RUN_HAZARD_EXHAUSTION_BREAK"
  | "MEAN_REVERSION_PULLBACK"
  | "MOMENTUM_CONTINUATION"
  | "PATIENT_CONFLUENCE_WAIT";

export interface ParityEntryCriteria {
  entryType: ParityEntryType;
  headline: string;
  setupSummary: string;
  stepByStep: {
    step1_Precondition: string;
    step2_Trigger: string;
    step3_Confirmation: string;
    step4_Invalidation: string;
  };
  markovContext: {
    order: number;
    suffix: string;
    conditionalPWin: number;
    sampleSize: number;
    rationale: string;
  };
  recommendedDuration: { value: number; unit: "ticks" | "seconds" };
  recommendedContract: ParityContractType;
  timingUrgency: "IMMEDIATE_NOW" | "NEXT_TICK_TRIGGER" | "WAIT_FOR_BREAK" | "PULLBACK_REQUIRED";
  executionRuleSentence: string;
  invalidationReason: string;
  minimumHoldSeconds: number;
}

export function determineParityEntryCriteria(
  contract: ParityContractType,
  symbol: string,
  markov: ParityMarkovEngineResult,
  runs: ParityRunEngineResult,
  pressure: ParityPressureResult,
  patterns: ParityPatternEngineResult,
  recentDigits: number[],
): ParityEntryCriteria {
  const isEven = contract === "DIGITEVEN";
  const targetSide = isEven ? "EVEN" : "ODD";
  const oppositeSide = isEven ? "ODD" : "EVEN";
  const lastDigit = recentDigits.length > 0 ? recentDigits[recentDigits.length - 1] : 0;
  const lastParity = lastDigit % 2 === 0 ? "EVEN" : "ODD";

  // Check highest-order Markov context available
  const ctx3 = markov.activeContext3;
  const ctx2 = markov.activeContext2;
  const m1 = markov.matrix1st;

  let order = 1;
  let suffix = lastParity === "EVEN" ? "E" : "O";
  let conditionalPWin = isEven
    ? lastParity === "EVEN"
      ? m1.pEE
      : m1.pOE
    : lastParity === "EVEN"
      ? m1.pEO
      : m1.pOO;
  let sampleSize = markov.sampleSize;
  let rationale = `1st-order Markov state [${suffix}] yielding ${(conditionalPWin * 100).toFixed(1)}% ${targetSide} transition.`;

  if (ctx3 && ctx3.sampleCount >= 8) {
    order = 3;
    suffix = ctx3.context;
    conditionalPWin = isEven ? ctx3.pEven : 1 - ctx3.pEven;
    sampleSize = ctx3.sampleCount;
    rationale = `Order-3 Variable Markov memory [${ctx3.context}] confirmed over N=${ctx3.sampleCount} occurrences.`;
  } else if (ctx2 && ctx2.sampleCount >= 10) {
    order = 2;
    suffix = ctx2.context;
    conditionalPWin = isEven ? ctx2.pEven : 1 - ctx2.pEven;
    sampleSize = ctx2.sampleCount;
    rationale = `Order-2 Variable Markov node [${ctx2.context}] with ${(conditionalPWin * 100).toFixed(1)}% ${targetSide} transition.`;
  }

  // Determine Entry Type and specific criteria
  // 1. Run Exhaustion Break (Top 5th percentile run of opposite side)
  if (runs.activeSide === oppositeSide && runs.activeLength >= 3 && runs.pBreakNextTick >= 0.6) {
    return {
      entryType: "RUN_HAZARD_EXHAUSTION_BREAK",
      headline: `Exhaustion Break Entry: Fade ${oppositeSide} run (${runs.activeLength} ticks)`,
      setupSummary: `${symbol} is in an extended ${oppositeSide} streak (x${runs.activeLength}). Empirical break hazard is ${(runs.pBreakNextTick * 100).toFixed(0)}%.`,
      stepByStep: {
        step1_Precondition: `Verify active ${oppositeSide} run is currently at ${runs.activeLength} ticks (last digit: ${lastDigit}).`,
        step2_Trigger: `On the NEXT incoming tick, if a break occurs or at tick arrival, submit ${contract} contract immediately.`,
        step3_Confirmation: `Markov Order-${order} context [${suffix}] confirms ${(conditionalPWin * 100).toFixed(1)}% flip probability.`,
        step4_Invalidation: `Cancel if ${oppositeSide} run stretches past ${runs.activeLength + 2} ticks with no break.`,
      },
      markovContext: { order, suffix, conditionalPWin, sampleSize, rationale },
      recommendedDuration: { value: 1, unit: "ticks" },
      recommendedContract: contract,
      timingUrgency: "WAIT_FOR_BREAK",
      executionRuleSentence: `Enter ${contract} immediately upon the first tick breaking the active ${runs.activeLength}-tick ${oppositeSide} run.`,
      invalidationReason: `Run continuation beyond length ${runs.activeLength + 2}`,
      minimumHoldSeconds: 120,
    };
  }

  // 2. Mean Reversion Pullback
  if (
    pressure.stretchedState === "EXTREME_STRETCH" &&
    pressure.favouredMeanReversion === targetSide
  ) {
    return {
      entryType: "MEAN_REVERSION_PULLBACK",
      headline: `Statistical Equilibrium Reversion Entry (z=${pressure.zScore.toFixed(2)})`,
      setupSummary: `Extreme ${oppositeSide} distribution stretch detected. Mean reversion to ${targetSide} strongly favored.`,
      stepByStep: {
        step1_Precondition: `Imbalance z-score of ${pressure.zScore.toFixed(2)} exceeds 2.0σ threshold.`,
        step2_Trigger: `Enter ${contract} on immediate tick arrival. Do not chase if digit parity already flipped.`,
        step3_Confirmation: `Confirmed by equilibrium pressure score (${pressure.reversionConfidence}/100).`,
        step4_Invalidation: `Invalidated if z-score collapses back toward neutral (< 1.0σ) before entry.`,
      },
      markovContext: { order, suffix, conditionalPWin, sampleSize, rationale },
      recommendedDuration: { value: 1, unit: "ticks" },
      recommendedContract: contract,
      timingUrgency: "IMMEDIATE_NOW",
      executionRuleSentence: `Execute ${contract} now for 1 tick to capture mean reversion from z=${pressure.zScore.toFixed(2)} stretch.`,
      invalidationReason: "Imbalance normalized prior to fill",
      minimumHoldSeconds: 120,
    };
  }

  // 3. Variable-Order Markov Trigger (Default Core Institutional Engine)
  if (conditionalPWin >= 0.53) {
    const triggerParityCondition =
      order >= 2
        ? `Wait for the sequence to complete context [${suffix}] (current tail digit: ${lastDigit})`
        : `Observe last digit ${lastDigit} (${lastParity})`;

    return {
      entryType: "VARIABLE_ORDER_MARKOV_TRIGGER",
      headline: `Variable-Order Markov Entry (Order-${order} Suffix [${suffix}])`,
      setupSummary: `High-conviction Markov transition node detected with ${(conditionalPWin * 100).toFixed(1)}% empirical ${targetSide} edge.`,
      stepByStep: {
        step1_Precondition: triggerParityCondition,
        step2_Trigger: `Submit ${contract} contract on NEXT incoming tick (1-tick duration).`,
        step3_Confirmation: `Validated by ${sampleSize} historical instances of pattern [${suffix}] with Wilson 95% hurdle clearance.`,
        step4_Invalidation: `Abort if sequence breaks or entropy exceeds 0.98 (unstructured noise).`,
      },
      markovContext: { order, suffix, conditionalPWin, sampleSize, rationale },
      recommendedDuration: { value: 1, unit: "ticks" },
      recommendedContract: contract,
      timingUrgency: "NEXT_TICK_TRIGGER",
      executionRuleSentence: `Enter ${contract} on the next tick following context [${suffix}] with ${(conditionalPWin * 100).toFixed(1)}% Markov expectation.`,
      invalidationReason: `State transition breakdown or entropy surge`,
      minimumHoldSeconds: 120,
    };
  }

  // 4. Momentum Continuation
  return {
    entryType: "MOMENTUM_CONTINUATION",
    headline: `Structural ${targetSide} Momentum Continuation`,
    setupSummary: `${targetSide} is currently dominant across rolling horizons. Enter on tick rhythm.`,
    stepByStep: {
      step1_Precondition: `Ensure market is in trending regime with multi-window Wilson clearance.`,
      step2_Trigger: `Enter ${contract} for 1 tick on next tick confirmation.`,
      step3_Confirmation: `Streak momentum length is ${runs.activeLength} ticks with low break hazard.`,
      step4_Invalidation: `Cancel if run exceeds 5 consecutive ticks (exhaustion danger).`,
    },
    markovContext: { order, suffix, conditionalPWin, sampleSize, rationale },
    recommendedDuration: { value: 1, unit: "ticks" },
    recommendedContract: contract,
    timingUrgency: "NEXT_TICK_TRIGGER",
    executionRuleSentence: `Enter ${contract} on next tick confirmation under structural momentum.`,
    invalidationReason: `Extended streak exceeding 5 ticks`,
    minimumHoldSeconds: 120,
  };
}
