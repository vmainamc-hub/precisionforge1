// Precision Parity AI — Parity Regime Engine.
// Classifies the current parity stream behaviour into five distinct market states
// and sets dynamic engine trustworthiness weights per regime.

export type ParityStreamRegime =
  "BALANCED" | "EVEN_BIASED" | "ODD_BIASED" | "ALTERNATING" | "CLUSTERING";

export interface ParityRegimeResult {
  regime: ParityStreamRegime;
  regimeStability: number; // 0..100
  alternatingRatio: number; // fraction of ticks that flipped parity (E->O or O->E)
  clusteringScore: number; // average streak length / baseline
  biasScore: number; // absolute difference from 50%
  engineWeights: Record<string, number>;
  summary: string;
}

export function runParityRegimeEngine(digits: number[]): ParityRegimeResult {
  const n = digits.length;
  if (n < 20) {
    return {
      regime: "BALANCED",
      regimeStability: 50,
      alternatingRatio: 0.5,
      clusteringScore: 1.0,
      biasScore: 0,
      engineWeights: { stats: 1.0, markov: 1.0, runs: 1.0, pressure: 1.0, patterns: 1.0 },
      summary: "Insufficient data for regime classification",
    };
  }

  const sample = digits.slice(-100);
  const m = sample.length;

  let evens = 0;
  let flips = 0;
  for (let i = 0; i < m; i++) {
    if (sample[i] % 2 === 0) evens++;
    if (i > 0 && sample[i] % 2 !== sample[i - 1] % 2) {
      flips++;
    }
  }

  const evenRate = evens / m;
  const alternatingRatio = flips / (m - 1);
  const biasScore = Math.abs(evenRate - 0.5) * 100;

  // Measure average streak length
  const runs: number[] = [];
  let curLen = 1;
  for (let i = 1; i < m; i++) {
    if (sample[i] % 2 === sample[i - 1] % 2) {
      curLen++;
    } else {
      runs.push(curLen);
      curLen = 1;
    }
  }
  runs.push(curLen);
  const avgRun = runs.length > 0 ? runs.reduce((a, b) => a + b, 0) / runs.length : 1.0;
  const clusteringScore = avgRun / 2.0; // expected run in fair coin is 2.0

  let regime: ParityStreamRegime = "BALANCED";
  const engineWeights: Record<string, number> = {
    stats: 1.0,
    markov: 1.0,
    runs: 1.0,
    pressure: 1.0,
    patterns: 1.0,
  };

  if (alternatingRatio >= 0.62) {
    regime = "ALTERNATING";
    engineWeights.markov = 1.6; // Markov transition engines excel here
    engineWeights.runs = 1.4;
    engineWeights.stats = 0.7;
    engineWeights.patterns = 1.3;
  } else if (clusteringScore >= 1.4 || (runs.length > 0 && Math.max(...runs) >= 6)) {
    regime = "CLUSTERING";
    engineWeights.runs = 1.8; // Run hazard & streak engines excel here
    engineWeights.markov = 1.2;
    engineWeights.pressure = 1.3;
    engineWeights.stats = 0.9;
  } else if (evenRate >= 0.56) {
    regime = "EVEN_BIASED";
    engineWeights.stats = 1.6;
    engineWeights.pressure = 1.4;
    engineWeights.markov = 1.1;
  } else if (evenRate <= 0.44) {
    regime = "ODD_BIASED";
    engineWeights.stats = 1.6;
    engineWeights.pressure = 1.4;
    engineWeights.markov = 1.1;
  } else {
    regime = "BALANCED";
    engineWeights.stats = 1.0;
    engineWeights.markov = 1.0;
    engineWeights.runs = 1.0;
    engineWeights.pressure = 1.0;
    engineWeights.patterns = 1.0;
  }

  const stability = Math.round(
    Math.max(20, Math.min(95, 100 - biasScore * 2 - Math.abs(alternatingRatio - 0.5) * 60)),
  );

  const summary = `Regime: ${regime} (Alt=${(alternatingRatio * 100).toFixed(0)}%, Cluster=${clusteringScore.toFixed(2)}, Bias=${biasScore.toFixed(1)}%)`;

  return {
    regime,
    regimeStability: stability,
    alternatingRatio,
    clusteringScore,
    biasScore,
    engineWeights,
    summary,
  };
}
