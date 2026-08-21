// Precision Parity AI — Comprehensive Signal Builder.
// Fuses all specialist engines into the canonical ParitySignal object.

import type { Tick } from "@/lib/analytics";
import { derivBus } from "@/lib/deriv/tick-bus";
import type { ParitySignal, ParitySignalVerdict } from "../types";
import { runParityStatsEngine } from "./stats-engine";
import { runParityMarkovEngine } from "./markov-engine";
import { runParityRunEngine } from "./run-hazard-engine";
import { runParityPressureEngine } from "./pressure-engine";
import { runParityEntropyEngine } from "./entropy-engine";
import { runParityPatternEngine } from "./pattern-engine";
import { runParityAnomalyEngine } from "./anomaly-engine";
import { runParityRegimeEngine } from "./regime-engine";
import { runParityChangepointEngine } from "./changepoint-engine";
import { runMarketQualityEngine } from "./market-quality-engine";
import { runMultiHorizonEngine } from "./multi-horizon-engine";
import { runParityDangerEngine } from "./danger-engine";
import { runEVGateEngine } from "./ev-gate-engine";
import { runContractSelectorEngine } from "./contract-selector-engine";
import { runParityTimingEngine } from "./timing-engine";
import { runParityStakeEngine } from "./risk-stake-engine";
import { ParityCalibrationTracker } from "./calibration-engine";
import { determineParityEntryCriteria } from "./entry-criteria-engine";
import { computeSpecificParityEntryDigit } from "./specific-entry-digit";

export interface CompleteEngineDiagnostic {
  stats: ReturnType<typeof runParityStatsEngine>;
  markov: ReturnType<typeof runParityMarkovEngine>;
  runs: ReturnType<typeof runParityRunEngine>;
  pressure: ReturnType<typeof runParityPressureEngine>;
  entropy: ReturnType<typeof runParityEntropyEngine>;
  patterns: ReturnType<typeof runParityPatternEngine>;
  anomaly: ReturnType<typeof runParityAnomalyEngine>;
  regime: ReturnType<typeof runParityRegimeEngine>;
  changepoint: ReturnType<typeof runParityChangepointEngine>;
  quality: ReturnType<typeof runMarketQualityEngine>;
  multiHorizon: ReturnType<typeof runMultiHorizonEngine>;
  danger: ReturnType<typeof runParityDangerEngine>;
  evGate: ReturnType<typeof runEVGateEngine>;
  selector: ReturnType<typeof runContractSelectorEngine>;
  timing: ReturnType<typeof runParityTimingEngine>;
  stake: ReturnType<typeof runParityStakeEngine>;
  signal: ParitySignal;
}

export function buildPrecisionParitySignal(
  ticks: Tick[],
  symbol: string,
  payoutRate: number = 0.95,
  consecutiveLosses: number = 0,
  targetContract?: "BUY_EVEN" | "BUY_ODD" | "DIGITEVEN" | "DIGITODD" | "NO_TRADE",
  explicitDigits?: number[],
): CompleteEngineDiagnostic {
  const busDigits = derivBus.getDigits(symbol);
  let digits: number[];
  if (explicitDigits && explicitDigits.length > 0) {
    digits = explicitDigits;
  } else if (busDigits && busDigits.length > 0) {
    digits = busDigits;
  } else {
    const pip = derivBus.getPipSize(symbol);
    digits = ticks.map((t) => {
      if (typeof (t as any).lastDigit === "number") return (t as any).lastDigit;
      const price = t.price;
      if (!Number.isFinite(price)) return 0;
      const str = price.toFixed(pip);
      const lastChar = str[str.length - 1];
      const parsed = parseInt(lastChar, 10);
      return Number.isNaN(parsed) ? Math.abs(Math.round(price * 100)) % 10 : parsed;
    });
  }
  const n = digits.length;

  // 1. Core analytical engines
  const stats = runParityStatsEngine(digits, 1 / (1 + payoutRate));
  const markov = runParityMarkovEngine(digits);
  const runs = runParityRunEngine(digits);
  const pressure = runParityPressureEngine(digits);
  const entropy = runParityEntropyEngine(digits);
  const patterns = runParityPatternEngine(digits);
  const anomaly = runParityAnomalyEngine(digits);
  const regime = runParityRegimeEngine(digits);
  const changepoint = runParityChangepointEngine(digits);
  const quality = runMarketQualityEngine(ticks);
  const multiHorizon = runMultiHorizonEngine(stats);

  // Determine initial favoured side by voting or authoritative targetContract
  let initialFavouredSide: "EVEN" | "ODD";
  let forcedContract: "DIGITEVEN" | "DIGITODD" | undefined;

  if (targetContract === "BUY_EVEN" || targetContract === "DIGITEVEN") {
    initialFavouredSide = "EVEN";
    forcedContract = "DIGITEVEN";
  } else if (targetContract === "BUY_ODD" || targetContract === "DIGITODD") {
    initialFavouredSide = "ODD";
    forcedContract = "DIGITODD";
  } else {
    let evenVotes = 0;
    let oddVotes = 0;
    if (stats.dominantSide === "EVEN") evenVotes += 1.5;
    else if (stats.dominantSide === "ODD") oddVotes += 1.5;

    if (markov.favouredSide === "EVEN") evenVotes += 1.3;
    else if (markov.favouredSide === "ODD") oddVotes += 1.3;

    if (runs.suggestedAction === "RIDE_RUN") {
      if (runs.activeSide === "EVEN") evenVotes += 1.4;
      else oddVotes += 1.4;
    } else if (runs.suggestedAction === "FADE_RUN" || runs.suggestedAction === "WAIT_FOR_BREAK") {
      if (runs.activeSide === "EVEN") oddVotes += 1.4;
      else evenVotes += 1.4;
    }

    if (pressure.favouredMeanReversion === "EVEN") evenVotes += 1.1;
    else if (pressure.favouredMeanReversion === "ODD") oddVotes += 1.1;

    if (patterns.favouredSide === "EVEN") evenVotes += 1.1;
    else if (patterns.favouredSide === "ODD") oddVotes += 1.1;

    initialFavouredSide = evenVotes >= oddVotes ? "EVEN" : "ODD";
    forcedContract = initialFavouredSide === "EVEN" ? "DIGITEVEN" : "DIGITODD";
  }

  // 2. Adversarial Danger & Threat Engine
  const danger = runParityDangerEngine(
    initialFavouredSide,
    n,
    runs,
    changepoint,
    entropy,
    quality,
    multiHorizon,
  );

  // 3. Contract selector & EV Gate
  const pPoint = stats.pointEstimatePWin;
  const pLower = stats.lowerBoundPWin;
  const selector = runContractSelectorEngine(
    digits,
    initialFavouredSide,
    pLower,
    pPoint,
    forcedContract,
  );
  const evGate = runEVGateEngine(
    selector.bestProbability.lower,
    selector.bestProbability.point,
    selector.payoutRate,
  );

  // 4. Timing Engine
  const isConfluenceReady = !danger.hasCriticalVeto && evGate.clearsGate;
  const timing = runParityTimingEngine(initialFavouredSide, runs, pressure, isConfluenceReady);

  // 5. Calibration Tracker & Stake Sizing
  const tracker = ParityCalibrationTracker.get();
  const rawConf = Math.round(
    Math.min(
      95,
      Math.max(50, 50 + (selector.bestProbability.lower - 0.5) * 160 - danger.dangerScore * 0.2),
    ),
  );
  const calibratedConfidence = tracker.calibrateConfidence(rawConf);
  const stake = runParityStakeEngine(calibratedConfidence, selector.payoutRate, consecutiveLosses);

  // 6. Verdict Determination
  let verdict: ParitySignalVerdict = "NO_TRADE";
  if (danger.hasCriticalVeto) {
    verdict = "NO_TRADE";
  } else if (!evGate.clearsGate) {
    verdict = "NO_TRADE";
  } else if (
    timing.timing === "WAIT" ||
    timing.timing === "AFTER_RUN_BREAK" ||
    timing.timing === "ON_PULLBACK"
  ) {
    verdict = "WAIT";
  } else if (calibratedConfidence >= 55 && evGate.lowerBoundEV > 0) {
    verdict = "TRADE";
  } else {
    verdict = "WAIT";
  }

  // Supporting engines summary for UI
  const supportingEngines: { name: string; vote: string; weight: number; sampleSize: number }[] =
    [];
  if (stats.dominantSide === initialFavouredSide) {
    supportingEngines.push({
      name: "Wilson Bounds Stats",
      vote: `Win rate ${(stats.pointEstimatePWin * 100).toFixed(1)}% (LB ${(stats.lowerBoundPWin * 100).toFixed(1)}%)`,
      weight: 1.5,
      sampleSize: stats.windows[stats.primaryWindow]?.sampleSize ?? 50,
    });
  }
  if (markov.favouredSide === initialFavouredSide) {
    supportingEngines.push({
      name: `Markov Chain (Ord-${markov.preferredOrder})`,
      vote: `Transition prob ${(markov.pointEstimatePWin * 100).toFixed(1)}%`,
      weight: 1.3,
      sampleSize: markov.sampleSize,
    });
  }
  if (runs.suggestedAction !== "NEUTRAL") {
    supportingEngines.push({
      name: "Run Hazard & Streak",
      vote: `${runs.suggestedAction} (Hazard ${(runs.pBreakNextTick * 100).toFixed(0)}%)`,
      weight: 1.4,
      sampleSize: runs.sampleSizeAtThisLength,
    });
  }
  if (pressure.favouredMeanReversion === initialFavouredSide) {
    supportingEngines.push({
      name: "Pressure Imbalance",
      vote: `Reversion target (z=${pressure.zScore.toFixed(2)})`,
      weight: 1.1,
      sampleSize: 100,
    });
  }
  if (patterns.favouredSide === initialFavouredSide && patterns.topMotif) {
    supportingEngines.push({
      name: "Motif Continuation",
      vote: `Pattern [${patterns.topMotif.ngram}] -> ${(patterns.pointEstimatePWin * 100).toFixed(1)}%`,
      weight: 1.2,
      sampleSize: patterns.sampleSize,
    });
  }

  const vetoes: { engine: string; reason: string }[] = [];
  for (const t of danger.threats) {
    if (t.severity === "CRITICAL_VETO") {
      vetoes.push({ engine: t.engine, reason: t.reason });
    }
  }
  if (!evGate.clearsGate && evGate.vetoReason) {
    vetoes.push({ engine: "EV Gate", reason: evGate.vetoReason });
  }

  // Plain-English narrative describing the analytical thesis
  let narrative = "";
  if (verdict === "TRADE") {
    narrative = `Strong statistical confluence for ${selector.bestContract} on ${symbol}. Multi-window Wilson lower bound clears breakeven with +${evGate.edgePercentagePoints.toFixed(1)}pp edge. ${timing.condition}.`;
  } else if (verdict === "WAIT") {
    narrative = `Market structure developing in favor of ${selector.bestContract}, but entry condition pending: ${timing.condition}.`;
  } else {
    narrative = `No actionable trade on ${symbol}. ${vetoes.length > 0 ? vetoes[0].reason : "Edge does not clear payout hurdle."}`;
  }

  const entryCriteria = determineParityEntryCriteria(
    selector.bestContract,
    symbol,
    markov,
    runs,
    pressure,
    patterns,
    digits,
  );

  const specificEntryDigit = computeSpecificParityEntryDigit(
    digits,
    selector.bestContract as "DIGITEVEN" | "DIGITODD",
    symbol,
    symbol,
  );

  const signal: ParitySignal = {
    verdict,
    contract: selector.bestContract,
    barrier: selector.barrier,
    symbol,
    duration: { value: 1, unit: "ticks" },
    entry: {
      timing: specificEntryDigit.status === "ENTER_NOW" ? "NOW" : "NEXT_TICK",
      condition: specificEntryDigit.instructionHeadline,
      expiresInTicks: timing.expiresInTicks,
    },
    entryCriteria,
    specificEntryDigit,
    probability: {
      point: selector.bestProbability.point,
      lower: selector.bestProbability.lower,
      upper: selector.bestProbability.upper,
      sampleSize: selector.bestProbability.sampleSize,
    },
    payout: selector.payoutRate,
    expectedValue: Number(evGate.lowerBoundEV.toFixed(4)),
    confidence: calibratedConfidence,
    stake: {
      tier: stake.tier,
      suggested: stake.suggestedStake,
      capReason: stake.capReason,
    },
    supportingEngines,
    vetoes,
    narrative,
  };

  return {
    stats,
    markov,
    runs,
    pressure,
    entropy,
    patterns,
    anomaly,
    regime,
    changepoint,
    quality,
    multiHorizon,
    danger,
    evGate,
    selector,
    timing,
    stake,
    signal,
  };
}
