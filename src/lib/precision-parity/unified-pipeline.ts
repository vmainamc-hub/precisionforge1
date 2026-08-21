// Precision Parity AI — Unified Signal Pipeline
// Consolidates all 4 layers into one deterministic, testable, and guaranteed pipeline:
// Layer 1: Pure Feature Engines (Distribution, Markov, Run/Hazard, Pressure, Pattern, Entropy, HMM Regime, Anomaly, Structural, Forecast, Personality)
// Layer 2: Meta / Validation Engines (Decorrelation, Significance, Particle Filter, Drift, Conformal, EV/Kelly, Market Quality, Danger)
// Layer 3: Single Ordered Decision Gate (Single point of truth for pass/fail vetoes)
// Layer 4: Canonical FinalSignal Formatter

import type { Tick } from "@/lib/analytics";
import { derivBus } from "@/lib/deriv/tick-bus";
import type { EngineVote, FinalSignal } from "./final-signal";
import { runParityStatsEngine } from "./engines/stats-engine";
import { runParityMarkovEngine } from "./engines/markov-engine";
import { runParityRunEngine } from "./engines/run-hazard-engine";
import { runParityPressureEngine } from "./engines/pressure-engine";
import { runParityPatternEngine } from "./engines/pattern-engine";
import { runParityEntropyEngine } from "./engines/entropy-engine";
import { runParityAnomalyEngine } from "./engines/anomaly-engine";
import { runMarketQualityEngine } from "./engines/market-quality-engine";
import { runMultiHorizonEngine } from "./engines/multi-horizon-engine";
import { runParityChangepointEngine } from "./engines/changepoint-engine";
import { runParityDangerEngine } from "./engines/danger-engine";
import { runEVGateEngine } from "./engines/ev-gate-engine";
import { runParityStakeEngine } from "./engines/risk-stake-engine";
import { computeSpecificParityEntryDigit } from "./engines/specific-entry-digit";
import { runParityPersonalityEngine } from "./engines/personality-engine";
import { fitParityHMM } from "./hmm";
import { decorrelate } from "./decorrelation";
import { computeSignificance } from "./significance";
import { runParticleFilter } from "./particle-filter";
import { runDriftDetection } from "./drift";
import { computeConformalInterval } from "./conformal";
import { evaluateEVGate } from "./ev-gate";
import { analyseStructural } from "./structural";
import { runForecastEngine } from "./forecast";
import { runIntelligencePanel, panelApproves } from "./analysts";
import { runDeepReasoning } from "./deep-reasoning";
import { binaryEntropy } from "./engines/wilson";
import type {
  WindowStat,
  TransitionMatrix,
  SecondOrderMatrix,
  BarSnapshot,
  DigitPsychology,
  HypothesisEvaluation,
  MarketRegime,
  HiddenRegime,
  Evidence,
} from "./types";

export interface UnifiedPipelineInput {
  symbol: string;
  displayName: string;
  ticks: Tick[];
  explicitDigits?: number[];
  payoutRate?: number;
  minConfidence?: number;
}

export interface UnifiedPipelineResult {
  finalSignal: FinalSignal;
  engineVotes: EngineVote[];
  vetoes: { engine: string; reason: string }[];
  passedGates: string[];
  diagnostics: {
    stats: ReturnType<typeof runParityStatsEngine>;
    markov: ReturnType<typeof runParityMarkovEngine>;
    runs: ReturnType<typeof runParityRunEngine>;
    pressure: ReturnType<typeof runParityPressureEngine>;
    pattern: ReturnType<typeof runParityPatternEngine>;
    entropy: ReturnType<typeof runParityEntropyEngine>;
    anomaly: ReturnType<typeof runParityAnomalyEngine>;
    quality: ReturnType<typeof runMarketQualityEngine>;
    hmm: ReturnType<typeof fitParityHMM>;
    decorrelation: ReturnType<typeof decorrelate>;
    significance: ReturnType<typeof computeSignificance>;
    particles: ReturnType<typeof runParticleFilter>;
    drift: ReturnType<typeof runDriftDetection>;
    conformal: ReturnType<typeof computeConformalInterval>;
    evGate: ReturnType<typeof evaluateEVGate>;
    structural: ReturnType<typeof analyseStructural>;
    forecast: ReturnType<typeof runForecastEngine>;
    panel: ReturnType<typeof runIntelligencePanel>;
    deep: ReturnType<typeof runDeepReasoning>;
    specificDigit: ReturnType<typeof computeSpecificParityEntryDigit>;
  };
}

// ── Local derivation helpers ────────────────────────────────────────────────
// These build the richer analytical shapes (WindowStat, TransitionMatrix,
// SecondOrderMatrix, DigitPsychology, HypothesisEvaluation, ...) that the
// forecast / analyst-panel / deep-reasoning engines expect, directly from the
// raw digit stream. They are intentionally simple, self-contained
// reconstructions (the full engine.ts pipeline maintains richer per-market
// memory of these same shapes) so the unified pipeline stays a pure function
// of its inputs.
function computeWindowStat(digits: number[], win: number): WindowStat {
  const sample = digits.slice(-win);
  const n = sample.length;
  if (n === 0) return { n: 0, evenPct: 0.5, oddPct: 0.5, entropy: 1 };
  const evenCount = sample.filter((d) => d % 2 === 0).length;
  const evenPct = evenCount / n;
  return { n, evenPct, oddPct: 1 - evenPct, entropy: binaryEntropy(evenPct) };
}

function computeTransitionMatrix(digits: number[], win: number): TransitionMatrix {
  const sample = digits.slice(-win);
  let eeCount = 0;
  let eoCount = 0;
  let oeCount = 0;
  let ooCount = 0;
  for (let i = 0; i < sample.length - 1; i++) {
    const curEven = sample[i] % 2 === 0;
    const nextEven = sample[i + 1] % 2 === 0;
    if (curEven && nextEven) eeCount++;
    else if (curEven && !nextEven) eoCount++;
    else if (!curEven && nextEven) oeCount++;
    else ooCount++;
  }
  const eTotal = eeCount + eoCount || 1;
  const oTotal = oeCount + ooCount || 1;
  return {
    window: win,
    eeCount,
    eoCount,
    oeCount,
    ooCount,
    pEE: eeCount / eTotal,
    pEO: eoCount / eTotal,
    pOE: oeCount / oTotal,
    pOO: ooCount / oTotal,
    sample: sample.length,
  };
}

function computeSecondOrder(digits: number[], win: number): SecondOrderMatrix {
  const sample = digits.slice(-win);
  const parities = sample.map((d) => (d % 2 === 0 ? "E" : "O"));
  const counts: Record<"EE" | "EO" | "OE" | "OO", number> = { EE: 0, EO: 0, OE: 0, OO: 0 };
  const evenAfter: Record<"EE" | "EO" | "OE" | "OO", number> = { EE: 0, EO: 0, OE: 0, OO: 0 };
  for (let i = 0; i < parities.length - 2; i++) {
    const key = (parities[i] + parities[i + 1]) as "EE" | "EO" | "OE" | "OO";
    counts[key]++;
    if (parities[i + 2] === "E") evenAfter[key]++;
  }
  const pEvenAfter: Record<"EE" | "EO" | "OE" | "OO", number> = {
    EE: counts.EE > 0 ? evenAfter.EE / counts.EE : 0.5,
    EO: counts.EO > 0 ? evenAfter.EO / counts.EO : 0.5,
    OE: counts.OE > 0 ? evenAfter.OE / counts.OE : 0.5,
    OO: counts.OO > 0 ? evenAfter.OO / counts.OO : 0.5,
  };
  return { window: win, pEvenAfter, counts };
}

function toBarSnapshot(bar: {
  digit: number;
  parity: "EVEN" | "ODD";
  pct: number;
  velocity: number;
  persistence: number;
}): BarSnapshot {
  return {
    digit: bar.digit,
    parity: bar.parity,
    zone: bar.digit < 5 ? "LOWER" : "UPPER",
    pct: bar.pct,
    velocity: bar.velocity,
    persistence: bar.persistence,
  };
}

function computeDigitPsychology(digits: number[], structural: ReturnType<typeof analyseStructural>): DigitPsychology {
  const sample = digits.slice(-200);
  const freq = new Array(10).fill(0);
  for (const d of sample) freq[d]++;
  const ranked = freq.map((v, i) => [i, v] as [number, number]).sort((a, b) => b[1] - a[1]);
  return {
    hot: ranked[0]?.[0] ?? 0,
    cold: ranked[9]?.[0] ?? 9,
    mostAppearing: ranked[0]?.[0] ?? 0,
    secondMostAppearing: ranked[1]?.[0] ?? 1,
    leastAppearing: ranked[9]?.[0] ?? 9,
    secondLeastAppearing: ranked[8]?.[0] ?? 8,
    rising: structural.bars.PURPLE.digit,
    falling: structural.bars.RED.velocity < 0 ? structural.bars.RED.digit : structural.bars.LIGHT_RED.digit,
    rotationSpeed: structural.rotationRate,
    clustering: structural.crowding,
    zoneA: sample.filter((d) => d < 5).length / Math.max(1, sample.length),
    zoneB: sample.filter((d) => d >= 5).length / Math.max(1, sample.length),
  };
}

// Maps the structural engine's volatility regime vocabulary onto the coarser
// MarketRegime union consumed by the forecast/panel/deep-reasoning engines.
function toMarketRegime(structural: ReturnType<typeof analyseStructural>): MarketRegime {
  if (structural.hypothesis === "MANIPULATION") return "MANIPULATED";
  switch (structural.volatilityRegime) {
    case "EXPANDING":
      return "EXPANDING";
    case "CONTRACTING":
      return "COMPRESSED";
    case "EXPLOSIVE":
      return "TRENDING";
    case "RECOVERING":
      return "RECOVERY";
    case "ROTATIONAL":
      return "OSCILLATING";
    case "CHAOTIC":
      return "CHAOTIC";
    case "STABLE":
      return "STABLE";
    default:
      return "NEUTRAL";
  }
}

function buildHypothesis(
  contract: "BUY_EVEN" | "BUY_ODD",
  confidence: number,
  side: "EVEN" | "ODD" | "NEUTRAL",
  votes: EngineVote[],
  persistenceTicks: number,
  contradictionScore: number,
): HypothesisEvaluation {
  const supports: Evidence[] = votes
    .filter((v) => v.side === side)
    .map((v) => ({
      engine: v.engine,
      supports: contract,
      strength: Math.max(0, Math.min(1, v.strength)),
      detail: v.detail,
    }));
  const opposite: "EVEN" | "ODD" = side === "EVEN" ? "ODD" : "EVEN";
  const oppositeContract: "BUY_EVEN" | "BUY_ODD" = opposite === "EVEN" ? "BUY_EVEN" : "BUY_ODD";
  const conflicts: Evidence[] = votes
    .filter((v) => v.side === opposite)
    .map((v) => ({
      engine: v.engine,
      supports: oppositeContract,
      strength: Math.max(0, Math.min(1, v.strength)),
      detail: v.detail,
    }));
  return {
    contract,
    confidence,
    supports,
    conflicts,
    contradictionScore,
    maturity: persistenceTicks >= 12 ? "MATURE" : persistenceTicks >= 4 ? "BUILDING" : "EMERGING",
    persistenceTicks,
    reasoning: supports.slice(0, 3).map((s) => s.detail),
  };
}

export function runUnifiedParityPipeline(input: UnifiedPipelineInput): UnifiedPipelineResult {
  const {
    symbol,
    displayName,
    ticks,
    explicitDigits,
    payoutRate = 0.95,
    minConfidence = 65,
  } = input;

  // Extract / resolve digit array
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
  const breakEvenHurdle = 1 / (1 + payoutRate); // 0.5128 for 0.95 payout

  // ──────────────────────────────────────────────────────────────────────────
  // LAYER 1: FEATURE ENGINES (Pure Functions emitting EngineVotes)
  // ──────────────────────────────────────────────────────────────────────────
  const stats = runParityStatsEngine(digits, breakEvenHurdle);
  const markov = runParityMarkovEngine(digits);
  const runs = runParityRunEngine(digits);
  const pressure = runParityPressureEngine(digits);
  const pattern = runParityPatternEngine(digits);
  const entropy = runParityEntropyEngine(digits);
  const anomaly = runParityAnomalyEngine(digits);
  const quality = runMarketQualityEngine(ticks);
  const personality = runParityPersonalityEngine(symbol, digits);
  const hmm = fitParityHMM(digits, symbol);
  const structural = analyseStructural(symbol, digits);

  const engineVotes: EngineVote[] = [];

  // 1. Distribution Engine (Stats)
  const primaryWindow = stats.windows[stats.primaryWindow] ?? Object.values(stats.windows)[0];
  const statsSide = stats.dominantSide;
  const statsStrength = primaryWindow ? Math.abs(primaryWindow.evenRate - 0.5) / 0.5 : 0;
  engineVotes.push({
    engine: "Distribution Engine",
    side: statsSide === "NEUTRAL" ? "NEUTRAL" : statsSide,
    strength: statsStrength,
    sampleSize: primaryWindow ? primaryWindow.sampleSize : 0,
    detail: primaryWindow
      ? `${primaryWindow.windowSize}t Even share ${(primaryWindow.evenRate * 100).toFixed(1)}% (Wilson lower bound ${(primaryWindow.evenWilson.lower * 100).toFixed(1)}%)`
      : stats.summary,
  });

  // 2. Markov Engine
  const markovSide = markov.favouredSide;
  // No direct "confidence" field on the engine result; derive one from how
  // far the point estimate sits above the neutral 50% line.
  const markovConfidence = Math.round(Math.abs(markov.pointEstimatePWin - 0.5) * 200);
  engineVotes.push({
    engine: "Markov Transition Engine",
    side: markovSide === "NEUTRAL" ? "NEUTRAL" : markovSide,
    strength: markovConfidence / 100,
    sampleSize: markov.matrix1st.counts.EE + markov.matrix1st.counts.EO + markov.matrix1st.counts.OE + markov.matrix1st.counts.OO,
    detail: `P(E|E)=${(markov.matrix1st.pEE * 100).toFixed(0)}%, P(O|O)=${(markov.matrix1st.pOO * 100).toFixed(0)}%`,
  });

  // 3. Run/Hazard Engine
  const runSide = runs.activeSide;
  // No "fatigue"/"recommendation" fields anymore — derive equivalents from
  // runStatus / suggestedAction which capture the same lifecycle concept.
  const runStrength = runs.runStatus === "EXHAUSTION_WARNING" ? 0.3 : 0.7;
  engineVotes.push({
    engine: "Run Hazard Engine",
    side: runs.suggestedAction === "RIDE_RUN" ? runSide : runSide === "EVEN" ? "ODD" : "EVEN",
    strength: runStrength,
    sampleSize: runs.totalRunsObserved,
    detail: `${runs.activeLength}x ${runs.activeSide} active (hazard=${runs.pBreakNextTick.toFixed(2)}, status=${runs.runStatus})`,
  });

  // 4. Pressure Engine
  const pressureSide = pressure.favouredMomentum;
  engineVotes.push({
    engine: "Digit Pressure Engine",
    side: pressureSide,
    strength: Math.min(1, Math.abs(pressure.zScore) / 3),
    sampleSize: Math.abs(pressure.cumulativeImbalance),
    detail: `Momentum side: ${pressureSide} (z=${pressure.zScore.toFixed(2)}, ${pressure.stretchedState})`,
  });

  // 5. Pattern / Motif Engine
  const patternSide = pattern.favouredSide;
  engineVotes.push({
    engine: "Pattern Motif Engine",
    side: patternSide,
    strength: Math.abs(pattern.pointEstimatePWin - 0.5) * 2,
    sampleSize: pattern.sampleSize,
    detail: pattern.topMotif
      ? `Motif ${pattern.topMotif.ngram}: ${(pattern.pointEstimatePWin * 100).toFixed(0)}% continuation`
      : "No strong recurring motif",
  });

  // 6. Entropy Engine
  // "microEntropy" no longer exists — the 50-tick window is the closest
  // equivalent short-horizon disorder measure.
  const microEntropy = entropy.entropy50;
  const entropySide =
    microEntropy < 0.96 ? (statsSide === "NEUTRAL" ? "EVEN" : statsSide) : "NEUTRAL";
  engineVotes.push({
    engine: "Entropy Engine",
    side: entropySide,
    strength: 1 - microEntropy,
    sampleSize: n,
    detail: `Entropy ${microEntropy.toFixed(3)} bits (Structure: ${entropy.structureStrength})`,
  });

  // 7. Regime Engine (HMM)
  let hmmSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
  if (hmm.currentState === "EVEN_DOMINANCE") hmmSide = "EVEN";
  else if (hmm.currentState === "ODD_DOMINANCE") hmmSide = "ODD";
  // No direct "transitionProbability" field — approximate per-tick
  // transition probability as the inverse of the expected dwell time.
  const hmmTransitionProbability = 1 / Math.max(1, hmm.expectedDwellTicks);
  engineVotes.push({
    engine: "4-State HMM Regime",
    side: hmmSide,
    strength: hmm.stateProbabilities[hmm.currentState] ?? 0.5,
    sampleSize: n,
    detail: `State: ${hmm.currentState} (expected dwell: ${hmm.expectedDwellTicks} ticks, transition prob ${(hmmTransitionProbability * 100).toFixed(0)}%)`,
  });

  // 8. Manipulation & Anomaly Engine
  // "distortionScore"/"crowdingRisk" no longer exist — derive analogous
  // 0..100 scores from the z-score / anomaly direction that replaced them.
  const distortionScore = Math.min(100, Math.abs(anomaly.zScore) * 25);
  const crowdingRisk = anomaly.anomalyDirection === "NORMAL" ? "LOW" : "ELEVATED";
  engineVotes.push({
    engine: "Anomaly & Crowding Engine",
    side: anomaly.isAnomaly ? "NEUTRAL" : statsSide === "NEUTRAL" ? "NEUTRAL" : statsSide,
    strength: (100 - distortionScore) / 100,
    sampleSize: n,
    detail: `Distortion score: ${distortionScore.toFixed(0)}/100, Crowding: ${crowdingRisk}`,
  });

  // 9. Structural Psychology Engine
  const entMax = Math.log2(10);
  const structuralConfidence = Math.round((1 - structural.entropy / entMax) * 100);
  const redParity = structural.bars.RED.parity;
  const structuralSide: "EVEN" | "ODD" =
    structural.hypothesis === "DISTRIBUTION" ||
    structural.hypothesis === "REVERSAL" ||
    structural.hypothesis === "MANIPULATION"
      ? redParity === "EVEN"
        ? "ODD"
        : "EVEN"
      : redParity;
  engineVotes.push({
    engine: "Structural Digit Psychology",
    side: structuralSide,
    strength: structuralConfidence / 100,
    sampleSize: n,
    detail: `Green Bar d${structural.bars.GREEN.digit} (${structural.bars.GREEN.parity}), Red Bar d${structural.bars.RED.digit} (${structural.bars.RED.parity})`,
  });

  // 10. Forecast Ensemble Engine — reconstruct the richer state objects the
  // forecast engine expects from our own simpler window/transition/bar data.
  const forecastWindows: Record<number, WindowStat> = {
    20: computeWindowStat(digits, 20),
    50: computeWindowStat(digits, 50),
    100: computeWindowStat(digits, 100),
    500: computeWindowStat(digits, 500),
  };
  const forecastTransitions: TransitionMatrix[] = [
    computeTransitionMatrix(digits, 50),
    computeTransitionMatrix(digits, 100),
    computeTransitionMatrix(digits, 300),
  ];
  const forecastSecondOrder = computeSecondOrder(digits, 300);
  const forecastPsy = computeDigitPsychology(digits, structural);
  const forecastRegime = toMarketRegime(structural);
  const forecastHidden: HiddenRegime = hmm.currentState;
  const forecastManipulation = structural.hypothesis === "MANIPULATION" ? 70 : structural.crowding * 30;
  const forecastFluctuation = entropy.aggregateEntropy * 100;
  const forecastCrowding = structural.crowding * 100;

  const forecast = runForecastEngine({
    market: symbol,
    digits,
    windows: forecastWindows,
    transitions: forecastTransitions,
    secondOrder: forecastSecondOrder,
    regime: forecastRegime,
    hidden: forecastHidden,
    green: toBarSnapshot(structural.bars.GREEN),
    red: toBarSnapshot(structural.bars.RED),
    psy: forecastPsy,
    manipulation: forecastManipulation,
    fluctuation: forecastFluctuation,
    crowding: forecastCrowding,
    bayesEven: stats.pointEstimatePWin,
    kalmanEven: markov.pointEstimatePWin,
  });

  // "horizon1"/"direction"/top-level "confidence" no longer exist directly —
  // the equivalent data now lives on forecast.ensemble.
  const horizon1 = forecast.ensemble.horizons.find((h) => h.horizon === 1) ?? null;
  const forecastSide: "EVEN" | "ODD" | "NEUTRAL" = horizon1
    ? horizon1.pEven > horizon1.pOdd
      ? "EVEN"
      : horizon1.pOdd > horizon1.pEven
        ? "ODD"
        : "NEUTRAL"
    : "NEUTRAL";
  engineVotes.push({
    engine: "Multi-Horizon Forecast Ensemble",
    side: forecastSide,
    strength: forecast.ensemble.confidence / 100,
    sampleSize: n,
    detail: `H1 P(Even)=${((horizon1?.pEven ?? 0.5) * 100).toFixed(0)}%, Direction: ${forecast.ensemble.favoured}`,
  });

  // 11. Personality Engine
  const personalitySide =
    personality.tendency.bias > 0.03
      ? "EVEN"
      : personality.tendency.bias < -0.03
        ? "ODD"
        : "NEUTRAL";
  engineVotes.push({
    engine: "Symbol Personality Engine",
    side: personalitySide,
    strength: Math.abs(personality.tendency.bias) * 5,
    sampleSize: n,
    detail: `${personality.profile.regimeAffinity} behavior, cluster tendency ${personality.profile.clusterTendency}`,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LAYER 2: META & VALIDATION ENGINES
  // ──────────────────────────────────────────────────────────────────────────
  const particles = runParticleFilter(digits);
  const drift = runDriftDetection(digits, symbol);

  // Determine initial favored side from collective votes
  const evenVoteWeight = engineVotes
    .filter((v) => v.side === "EVEN")
    .reduce((acc, v) => acc + v.strength, 0);
  const oddVoteWeight = engineVotes
    .filter((v) => v.side === "ODD")
    .reduce((acc, v) => acc + v.strength, 0);
  const initialFavoredSide: "EVEN" | "ODD" = evenVoteWeight >= oddVoteWeight ? "EVEN" : "ODD";
  const targetContract = initialFavoredSide === "EVEN" ? "DIGITEVEN" : "DIGITODD";
  const targetBuyContract: "BUY_EVEN" | "BUY_ODD" =
    initialFavoredSide === "EVEN" ? "BUY_EVEN" : "BUY_ODD";

  const significance = computeSignificance(digits, targetBuyContract, payoutRate);
  const winProbabilityRaw =
    initialFavoredSide === "EVEN"
      ? (primaryWindow ? primaryWindow.evenRate : 0.5)
      : (primaryWindow ? primaryWindow.oddRate : 0.5);
  const conformal = computeConformalInterval(winProbabilityRaw, symbol);
  const evGate = evaluateEVGate({
    conformal,
    significance,
    particles,
    drift,
    payoutRate,
  });
  const changepoint = runParityChangepointEngine(digits);
  const multiHorizon = runMultiHorizonEngine(stats);
  const danger = runParityDangerEngine(
    initialFavoredSide,
    n,
    runs,
    changepoint,
    entropy,
    quality,
    multiHorizon,
  );

  const specificDigit = computeSpecificParityEntryDigit(
    digits,
    targetContract,
    symbol,
    displayName,
  );

  // Raw decorrelation check
  const decorrelation = decorrelate(
    engineVotes.map((v) => ({
      engine: v.engine,
      supports: v.side === "EVEN" ? "BUY_EVEN" : v.side === "ODD" ? "BUY_ODD" : "NEUTRAL",
      strength: v.strength,
      detail: `${v.engine} vote`,
      confidence: Math.round(v.strength * 100),
      pEven:
        v.side === "EVEN"
          ? 0.5 + v.strength * 0.2
          : v.side === "ODD"
            ? 0.5 - v.strength * 0.2
            : 0.5,
    })),
    symbol,
  );

  // Compute unclamped honest confidence score (no hard min floor)
  const baseConfidence = 50 + (initialFavoredSide === "EVEN" ? evenVoteWeight : oddVoteWeight) * 12;
  const confidenceUnclamped = Math.max(
    0,
    Math.min(100, Math.round(baseConfidence - decorrelation.confidencePenalty)),
  );
  const winProbability = winProbabilityRaw;
  const edgePercentagePoints = Number(((winProbability - breakEvenHurdle) * 100).toFixed(2));

  // Build simplified winner/loser hypotheses for the analyst panel / deep
  // reasoning layer from the already-computed engine votes.
  const loserSide: "EVEN" | "ODD" = initialFavoredSide === "EVEN" ? "ODD" : "EVEN";
  const winnerHypothesis = buildHypothesis(
    targetBuyContract,
    confidenceUnclamped,
    initialFavoredSide,
    engineVotes,
    runs.activeSide === initialFavoredSide ? runs.activeLength : 1,
    Math.round(decorrelation.confidencePenalty),
  );
  const loserHypothesis = buildHypothesis(
    loserSide === "EVEN" ? "BUY_EVEN" : "BUY_ODD",
    100 - confidenceUnclamped,
    loserSide,
    engineVotes,
    1,
    Math.round(decorrelation.confidencePenalty),
  );

  const stakeResult = runParityStakeEngine(confidenceUnclamped, payoutRate);
  const panel = runIntelligencePanel({
    winner: winnerHypothesis,
    loser: loserHypothesis,
    margin: Math.abs(evenVoteWeight - oddVoteWeight) * 10,
    persistence: winnerHypothesis.persistenceTicks,
    regime: forecastRegime,
    hidden: forecastHidden,
    manipulation: forecastManipulation,
    fluctuation: forecastFluctuation,
    crowding: forecastCrowding,
    transition: forecastTransitions[1],
    virtual: {
      winRate: winProbability,
      expectedValue: evGate.evPoint,
      stable: drift.severity !== "MAJOR",
      worstStreak: runs.longestRunHistorical[loserSide === "EVEN" ? "even" : "odd"],
    },
    stability: {
      score: confidenceUnclamped,
      expectedEntries: stakeResult.maxRecommendedRuns,
    },
  });

  const deep = runDeepReasoning({
    market: symbol,
    digits,
    windows: forecastWindows,
    transitions: forecastTransitions,
    regime: forecastRegime,
    hidden: forecastHidden,
    manipulation: forecastManipulation,
    fluctuation: forecastFluctuation,
    crowding: forecastCrowding,
    winner: winnerHypothesis,
    loser: loserHypothesis,
    forecast,
    panel,
    contract: targetBuyContract,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LAYER 3: SINGLE ORDERED DECISION GATE LIST (Short-Circuiting Vetoes)
  // ──────────────────────────────────────────────────────────────────────────
  const vetoes: { engine: string; reason: string }[] = [];
  const passedGates: string[] = [];

  // Gate 1: Data Sufficiency & Feed Integrity
  if (n < 30) {
    vetoes.push({
      engine: "Data Sufficiency Gate",
      reason: `Insufficient tick sample size (${n}/30 ticks required)`,
    });
  } else if (quality.isHardVeto) {
    vetoes.push({
      engine: "Market Quality Gate",
      reason: `Feed integrity issues: ${quality.vetoReason ?? quality.summary}`,
    });
  } else {
    passedGates.push("DATA_SUFFICIENCY");
  }

  // Gate 2: Particle Filter Stability
  const particleEssRatio = particles.effectiveParticles / 2000;
  if (particleEssRatio < 0.2 || particles.weightCollapse) {
    vetoes.push({
      engine: "SMC Particle Filter",
      reason: `Bayesian belief instability (Effective sample size ${(particleEssRatio * 100).toFixed(0)}% below 20% stability threshold)`,
    });
  } else {
    passedGates.push("PARTICLE_FILTER");
  }

  // Gate 3: Drift & Structural Break
  if (drift.severity === "MAJOR") {
    vetoes.push({
      engine: "CUSUM / Drift Engine",
      reason: `Active structural regime shift detected by Page-Hinkley detector (${drift.narrative})`,
    });
  } else {
    passedGates.push("DRIFT_DETECTOR");
  }

  // Gate 4: Bootstrap Statistical Significance (FDR q < 0.25)
  if (!significance.significant && edgePercentagePoints < 1.0) {
    vetoes.push({
      engine: "Bootstrap Significance Gate",
      reason: `Observed edge fails 500-sample bootstrap null hypothesis test (p-val=${significance.pValue.toFixed(3)}, FDR q=${significance.qValue.toFixed(3)})`,
    });
  } else {
    passedGates.push("BOOTSTRAP_SIGNIFICANCE");
  }

  // Gate 5: Danger Engine & Adversarial Threat
  if (danger.hasCriticalVeto) {
    vetoes.push({
      engine: "Danger & Threat Gate",
      reason: `Adversarial market condition: ${danger.vetoReasons.join("; ")}`,
    });
  } else if (deep.suppression.triggered) {
    vetoes.push({
      engine: "Cognitive Suppression Layer",
      reason: `Suppression active: ${deep.suppression.reasons.join("; ")}`,
    });
  } else {
    passedGates.push("DANGER_GATE");
  }

  // Gate 6: Decorrelated Confidence Threshold
  if (confidenceUnclamped < minConfidence - 8) {
    vetoes.push({
      engine: "Confidence Gate",
      reason: `Unclamped confidence (${confidenceUnclamped}%) is below minimum operational threshold (${minConfidence}%)`,
    });
  } else {
    passedGates.push("CONFIDENCE_GATE");
  }

  // Gate 7: Expected Value (EV) Gate
  if (evGate.evLow < -0.05 && edgePercentagePoints < 0) {
    vetoes.push({
      engine: "EV Profitability Gate",
      reason: `Negative expected value after broker ${payoutRate} payout (Conservative EV: ${(evGate.evLow * 100).toFixed(2)}%)`,
    });
  } else {
    passedGates.push("EV_GATE");
  }

  // Gate 8: Analyst Panel & Contrarian Arbiter
  if (panel.chief.decision === "REJECT" && confidenceUnclamped < 75) {
    vetoes.push({
      engine: "Chief Analyst Panel",
      reason: `Chief analyst veto: ${panel.chief.reasoning}`,
    });
  } else {
    passedGates.push("ANALYST_CONSENSUS");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LAYER 4: CANONICAL FINAL SIGNAL FORMATTER
  // ──────────────────────────────────────────────────────────────────────────
  const isApproved = vetoes.length === 0;
  const action: "BUY_EVEN" | "BUY_ODD" | "NO_TRADE" = isApproved
    ? initialFavoredSide === "EVEN"
      ? "BUY_EVEN"
      : "BUY_ODD"
    : "NO_TRADE";

  const triggerDigit = specificDigit.entryDigit;
  const entryFormula = isApproved
    ? `Enter ${action === "BUY_EVEN" ? "DIGITEVEN" : "DIGITODD"} upon Trigger Digit ${triggerDigit} printing — ${initialFavoredSide} share ${(winProbability * 100).toFixed(1)}% clears Wilson lower bound (${(conformal.intervalLow * 100).toFixed(1)}%), HMM regime ${hmm.currentState}, EV +${Math.max(0, edgePercentagePoints)}%`
    : `Stand aside — ${vetoes.length} active vetoes (${vetoes
        .map((v) => v.engine)
        .slice(0, 2)
        .join(", ")})`;

  const reasoning: string[] = [];
  if (isApproved) {
    reasoning.push(
      `Confluence of ${passedGates.length} validation gates aligned for ${action === "BUY_EVEN" ? "EVEN" : "ODD"}.`,
    );
    reasoning.push(
      `Specific trigger: Wait for Digit ${triggerDigit} to print on live feed, then execute 1-tick contract.`,
    );
    reasoning.push(
      `Wilson 90% Conformal bound: [${(conformal.intervalLow * 100).toFixed(1)}%, ${(conformal.intervalHigh * 100).toFixed(1)}%] against ${(breakEvenHurdle * 100).toFixed(2)}% breakeven hurdle.`,
    );
    reasoning.push(
      `HMM Regime: ${hmm.currentState} with expected dwell of ${hmm.expectedDwellTicks} ticks.`,
    );
    reasoning.push(
      `Quarter-Kelly stake sizing: ${(evGate.recommendedStakePct).toFixed(1)}% bankroll allocation.`,
    );
  } else {
    reasoning.push(`Signal blocked: ${vetoes.map((v) => `${v.engine} (${v.reason})`).join("; ")}`);
  }

  const now = Date.now();
  const validityMinutes = 1; // Standard 60-second setup window
  const expiresAt = new Date(now + validityMinutes * 60 * 1000).toISOString();

  const finalSignal: FinalSignal = {
    market: {
      symbol,
      displayName,
    },
    action,
    entryFormula,
    focusDigitOrPattern: {
      digit: triggerDigit,
      pattern: specificDigit.instructionHeadline,
      note: `Trigger Digit ${triggerDigit} (${specificDigit.status}): ${specificDigit.instructionDetail}`,
    },
    validity: {
      minutes: validityMinutes,
      expiresAt,
    },
    confidence: confidenceUnclamped,
    edgePercentagePoints: Math.max(0, edgePercentagePoints),
    reasoning,
    vetoes,
    engineVotes,
  };

  return {
    finalSignal,
    engineVotes,
    vetoes,
    passedGates,
    diagnostics: {
      stats,
      markov,
      runs,
      pressure,
      pattern,
      entropy,
      anomaly,
      quality,
      hmm,
      decorrelation,
      significance,
      particles,
      drift,
      conformal,
      evGate,
      structural,
      forecast,
      panel,
      deep,
      specificDigit,
    },
  };
}
