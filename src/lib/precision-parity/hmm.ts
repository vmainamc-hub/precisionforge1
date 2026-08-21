// Phase 4 — Hidden Markov Model with Viterbi Decoding & Baum-Welch Training
// Classifies the market into 4 latent regimes and computes state dwell dynamics.

import type { HiddenRegime } from "./types";

export interface HMMState {
  index: number;
  label: HiddenRegime;
  name: string;
  emissionEven: number; // P(Observe EVEN | State)
  emissionOdd: number; // P(Observe ODD | State)
  dwellTicks: number; // 1 / (1 - a_ii)
  posteriorProb: number; // current filtered probability
}

export interface HMMReport {
  currentState: HiddenRegime;
  stateProbabilities: Record<HiddenRegime, number>;
  states: HMMState[];
  transitionMatrix: number[][];
  mostLikelySequence: number[];
  expectedDwellTicks: number;
  logLikelihood: number;
  narrative: string;
}

interface HMMModel {
  // 4 states: 0: BALANCED, 1: EVEN_DOMINANCE, 2: ODD_DOMINANCE, 3: ALTERNATING
  transitions: number[][];
  emissions: number[][]; // [state][0=EVEN, 1=ODD]
  pi: number[];
}

const HMM_REGIME_MAP: HiddenRegime[] = [
  "BALANCED",
  "EVEN_DOMINANCE",
  "ODD_DOMINANCE",
  "ALTERNATING",
];

const warmModels = new Map<string, HMMModel>();

function createDefaultModel(): HMMModel {
  return {
    pi: [0.4, 0.2, 0.2, 0.2],
    transitions: [
      // 0: BALANCED
      [0.85, 0.05, 0.05, 0.05],
      // 1: EVEN_DOMINANCE
      [0.08, 0.82, 0.02, 0.08],
      // 2: ODD_DOMINANCE
      [0.08, 0.02, 0.82, 0.08],
      // 3: ALTERNATING
      [0.06, 0.07, 0.07, 0.8],
    ],
    emissions: [
      [0.5, 0.5], // BALANCED: 50% / 50%
      [0.68, 0.32], // EVEN_DOMINANCE: 68% EVEN
      [0.32, 0.68], // ODD_DOMINANCE: 68% ODD
      [0.5, 0.5], // ALTERNATING
    ],
  };
}

export function fitParityHMM(digits: number[], market: string = "default"): HMMReport {
  const n = digits.length;
  const observations = digits.slice(-300).map((d) => (d % 2 === 0 ? 0 : 1));
  const T = observations.length;

  let model = warmModels.get(market);
  if (!model) {
    model = createDefaultModel();
    warmModels.set(market, model);
  }

  if (T < 10) {
    const states: HMMState[] = HMM_REGIME_MAP.map((label, idx) => ({
      index: idx,
      label,
      name: label.replace("_", " "),
      emissionEven: model!.emissions[idx][0],
      emissionOdd: model!.emissions[idx][1],
      dwellTicks: Math.round(1 / (1 - model!.transitions[idx][idx])),
      posteriorProb: model!.pi[idx],
    }));

    return {
      currentState: "BALANCED",
      stateProbabilities: {
        BALANCED: 0.5,
        EVEN_DOMINANCE: 0.2,
        ODD_DOMINANCE: 0.2,
        ALTERNATING: 0.1,
        REVERSAL_BUILDING: 0,
        COMPRESSION: 0,
        EXPANSION: 0,
        UNCERTAIN: 0,
      },
      states,
      transitionMatrix: model.transitions,
      mostLikelySequence: [],
      expectedDwellTicks: 10,
      logLikelihood: -100,
      narrative: "HMM initialized with default stationary priors.",
    };
  }

  const K = 4;
  const transitions = model.transitions.map((row) => [...row]);
  const emissions = model.emissions.map((row) => [...row]);
  let pi = [...model.pi];

  // 1. Baum-Welch EM optimization (capped at 20 iterations per tick budget)
  const maxIterations = 20;
  let logLikelihood = -Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Forward pass (alpha) with scaling
    const alpha: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));
    const c: number[] = new Array(T).fill(0);

    let sumInit = 0;
    for (let i = 0; i < K; i++) {
      alpha[0][i] = pi[i] * emissions[i][observations[0]];
      sumInit += alpha[0][i];
    }
    c[0] = sumInit > 0 ? 1 / sumInit : 1;
    for (let i = 0; i < K; i++) alpha[0][i] *= c[0];

    for (let t = 1; t < T; t++) {
      let sumT = 0;
      const obs = observations[t];
      for (let j = 0; j < K; j++) {
        let sumTrans = 0;
        for (let i = 0; i < K; i++) {
          sumTrans += alpha[t - 1][i] * transitions[i][j];
        }
        alpha[t][j] = sumTrans * emissions[j][obs];
        sumT += alpha[t][j];
      }
      c[t] = sumT > 0 ? 1 / sumT : 1;
      for (let j = 0; j < K; j++) alpha[t][j] *= c[t];
    }

    // Backward pass (beta) with scaling
    const beta: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));
    for (let i = 0; i < K; i++) beta[T - 1][i] = c[T - 1];

    for (let t = T - 2; t >= 0; t--) {
      const nextObs = observations[t + 1];
      for (let i = 0; i < K; i++) {
        let sumB = 0;
        for (let j = 0; j < K; j++) {
          sumB += transitions[i][j] * emissions[j][nextObs] * beta[t + 1][j];
        }
        beta[t][i] = sumB * c[t];
      }
    }

    // Gamma (posterior state probabilities) and Xi
    const gamma: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));
    for (let t = 0; t < T; t++) {
      let sumG = 0;
      for (let i = 0; i < K; i++) {
        gamma[t][i] = alpha[t][i] * beta[t][i];
        sumG += gamma[t][i];
      }
      if (sumG > 0) {
        for (let i = 0; i < K; i++) gamma[t][i] /= sumG;
      }
    }

    // Log-likelihood check
    let currentLogL = 0;
    for (let t = 0; t < T; t++) {
      currentLogL += Math.log(Math.max(1e-12, c[t]));
    }
    currentLogL = -currentLogL;

    if (Math.abs(currentLogL - logLikelihood) < 1e-4) {
      logLikelihood = currentLogL;
      break;
    }
    logLikelihood = currentLogL;

    // Update parameters with Laplace smoothing
    for (let i = 0; i < K; i++) {
      pi[i] = Math.max(0.05, gamma[0][i]);
    }
    const sumPi = pi.reduce((a, b) => a + b, 0);
    pi = pi.map((p) => p / sumPi);

    for (let i = 0; i < K; i++) {
      let gammaSum = 0;
      for (let t = 0; t < T - 1; t++) gammaSum += gamma[t][i];

      for (let j = 0; j < K; j++) {
        let xiSum = 0;
        for (let t = 0; t < T - 1; t++) {
          xiSum +=
            alpha[t][i] * transitions[i][j] * emissions[j][observations[t + 1]] * beta[t + 1][j];
        }
        // Smooth transition probabilities
        transitions[i][j] = (xiSum + 0.1) / (gammaSum + 0.4);
      }
      const rowSum = transitions[i].reduce((a, b) => a + b, 0);
      transitions[i] = transitions[i].map((v) => v / rowSum);
    }
  }

  // Warm-store updated model
  model.transitions = transitions;
  model.emissions = emissions;
  model.pi = pi;

  // 2. Viterbi decoding for most likely state sequence
  const delta: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));
  const psi: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));

  for (let i = 0; i < K; i++) {
    delta[0][i] =
      Math.log(Math.max(1e-9, pi[i])) + Math.log(Math.max(1e-9, emissions[i][observations[0]]));
  }

  for (let t = 1; t < T; t++) {
    const obs = observations[t];
    for (let j = 0; j < K; j++) {
      let maxVal = -Infinity;
      let maxIdx = 0;
      for (let i = 0; i < K; i++) {
        const val = delta[t - 1][i] + Math.log(Math.max(1e-9, transitions[i][j]));
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
      }
      delta[t][j] = maxVal + Math.log(Math.max(1e-9, emissions[j][obs]));
      psi[t][j] = maxIdx;
    }
  }

  const viterbiSeq: number[] = new Array(T);
  let bestEndIdx = 0;
  let bestEndVal = -Infinity;
  for (let i = 0; i < K; i++) {
    if (delta[T - 1][i] > bestEndVal) {
      bestEndVal = delta[T - 1][i];
      bestEndIdx = i;
    }
  }
  viterbiSeq[T - 1] = bestEndIdx;
  for (let t = T - 2; t >= 0; t--) {
    viterbiSeq[t] = psi[t + 1][viterbiSeq[t + 1]];
  }

  const currentIdx = viterbiSeq[T - 1];
  const currentState = HMM_REGIME_MAP[currentIdx];

  // Final posterior probability distribution at tick T-1
  const finalStateProbabilities: Record<HiddenRegime, number> = {
    BALANCED: 0,
    EVEN_DOMINANCE: 0,
    ODD_DOMINANCE: 0,
    ALTERNATING: 0,
    REVERSAL_BUILDING: 0,
    COMPRESSION: 0,
    EXPANSION: 0,
    UNCERTAIN: 0,
  };

  const finalExp = delta[T - 1].map((v) => Math.exp(v - bestEndVal));
  const sumExp = finalExp.reduce((a, b) => a + b, 0);
  for (let i = 0; i < K; i++) {
    const prob = finalExp[i] / sumExp;
    finalStateProbabilities[HMM_REGIME_MAP[i]] = prob;
  }

  const states: HMMState[] = HMM_REGIME_MAP.map((label, idx) => {
    const diag = transitions[idx][idx];
    const dwellTicks = Math.max(1, Math.min(60, Math.round(1 / Math.max(0.01, 1 - diag))));
    return {
      index: idx,
      label,
      name: label.replace("_", " "),
      emissionEven: emissions[idx][0],
      emissionOdd: emissions[idx][1],
      dwellTicks,
      posteriorProb: finalStateProbabilities[label],
    };
  });

  const expectedDwellTicks = states[currentIdx].dwellTicks;

  const narrative = `4-State Discrete HMM Viterbi decoded state: ${currentState} (${(finalStateProbabilities[currentState] * 100).toFixed(1)}% posterior). Expected state dwell time: ${expectedDwellTicks} ticks.`;

  return {
    currentState,
    stateProbabilities: finalStateProbabilities,
    states,
    transitionMatrix: transitions,
    mostLikelySequence: viterbiSeq,
    expectedDwellTicks,
    logLikelihood,
    narrative,
  };
}

export function resetHMMMemory(market?: string): void {
  if (market) {
    warmModels.delete(market);
  } else {
    warmModels.clear();
  }
}
