// Phase 1 — Decorrelation & Effective Sample Engine
// Prevents correlated evidence inflation across the 17+ evidence engines.

import type { Evidence, ParityContract } from "./types";

export interface ClusterInfo {
  engines: string[];
  supports: ParityContract | "NEUTRAL";
  strength: number;
  leadEngine: string;
  weight: number;
}

export interface DecorrelationReport {
  clusters: ClusterInfo[];
  correlationMatrix: number[][];
  engineOrder: string[];
  rawVotes: number;
  effectiveVotes: number;
  inflationFactor: number;
  confidencePenalty: number;
  narrative: string;
}

// Fallback static cluster taxonomy for cold starts (< 40 evaluations)
const STATIC_CLUSTER_TAXONOMY: Record<string, string> = {
  // Markov family
  Markov: "MarkovFamily",
  "Higher-Order Markov": "MarkovFamily",
  "Transition Predictor": "MarkovFamily",
  // Entropy family
  Entropy: "EntropyFamily",
  Fluctuation: "EntropyFamily",
  Compression: "EntropyFamily",
  // Psychology & Pattern family
  "Digit Psychology": "PsychologyFamily",
  "Digit Rotation": "PsychologyFamily",
  "Pattern DNA": "PsychologyFamily",
  // Manipulation & Regime family
  Manipulation: "RegimeFamily",
  "Hidden Regime": "RegimeFamily",
  "Hidden Accumulation": "RegimeFamily",
  // Forecast & Statistics family
  "Ensemble Forecast": "ForecastFamily",
  Statistics: "ForecastFamily",
  "Historical Similarity": "ForecastFamily",
  "Historical Analogue": "ForecastFamily",
  "Kalman Trend": "ForecastFamily",
  "Edge Persistence": "ForecastFamily",
  "AI Sequence": "ForecastFamily",
};

interface RollingEvaluation {
  vector: Record<string, number>;
  ts: number;
}

const rollingBuffers = new Map<string, RollingEvaluation[]>();
const MAX_BUFFER = 300;
const CORRELATION_THRESHOLD = 0.75;

function getBuffer(market: string): RollingEvaluation[] {
  let buf = rollingBuffers.get(market);
  if (!buf) {
    buf = [];
    rollingBuffers.set(market, buf);
  }
  return buf;
}

export function recordEvaluationSnapshot(market: string, evidence: Evidence[]): void {
  const buf = getBuffer(market);
  const vector: Record<string, number> = {};
  for (const e of evidence) {
    const signed =
      e.supports === "BUY_EVEN" ? e.strength : e.supports === "BUY_ODD" ? -e.strength : 0;
    vector[e.engine] = signed;
  }
  buf.push({ vector, ts: Date.now() });
  if (buf.length > MAX_BUFFER) {
    buf.shift();
  }
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 5) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
    sumXY += x[i] * y[i];
  }
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    Math.max(1e-9, (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)),
  );
  if (denominator < 1e-9) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

function singleLinkageCluster(matrix: number[][], threshold: number): number[][] {
  const n = matrix.length;
  const clusters: Set<number>[] = [];
  for (let i = 0; i < n; i++) {
    clusters.push(new Set([i]));
  }

  while (true) {
    let bestDist = -1;
    let mergeA = -1;
    let mergeB = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        let maxCorr = -1;
        for (const u of clusters[i]) {
          for (const v of clusters[j]) {
            const corr = Math.abs(matrix[u][v]);
            if (corr > maxCorr) {
              maxCorr = corr;
            }
          }
        }
        if (maxCorr >= threshold && maxCorr > bestDist) {
          bestDist = maxCorr;
          mergeA = i;
          mergeB = j;
        }
      }
    }

    if (mergeA === -1 || mergeB === -1) break;

    const clusterB = clusters[mergeB];
    for (const v of clusterB) {
      clusters[mergeA].add(v);
    }
    clusters.splice(mergeB, 1);
  }

  return clusters.map((c) => Array.from(c));
}

export function decorrelate(
  evidence: Evidence[],
  market: string,
  calibrationScores?: Record<string, number>,
): DecorrelationReport {
  recordEvaluationSnapshot(market, evidence);
  const buf = getBuffer(market);

  const engineNames = evidence.map((e) => e.engine);
  const rawVotes = evidence.length;

  if (rawVotes === 0) {
    return {
      clusters: [],
      correlationMatrix: [],
      engineOrder: [],
      rawVotes: 0,
      effectiveVotes: 0,
      inflationFactor: 1,
      confidencePenalty: 0,
      narrative: "No active evidence engines available.",
    };
  }

  const evidenceMap = new Map<string, Evidence>();
  for (const e of evidence) {
    evidenceMap.set(e.engine, e);
  }

  let clusteredIndices: number[][] = [];
  let corrMatrix: number[][] = [];

  if (buf.length >= 40) {
    // Dynamic Pearson correlation from buffer
    const engineSeries: Record<string, number[]> = {};
    for (const name of engineNames) {
      engineSeries[name] = buf.map((snap) => snap.vector[name] ?? 0);
    }

    corrMatrix = Array.from({ length: rawVotes }, () => Array.from({ length: rawVotes }, () => 0));

    for (let i = 0; i < rawVotes; i++) {
      for (let j = 0; j < rawVotes; j++) {
        if (i === j) {
          corrMatrix[i][j] = 1.0;
        } else if (i < j) {
          const c = pearsonCorrelation(engineSeries[engineNames[i]], engineSeries[engineNames[j]]);
          corrMatrix[i][j] = c;
          corrMatrix[j][i] = c;
        }
      }
    }

    clusteredIndices = singleLinkageCluster(corrMatrix, CORRELATION_THRESHOLD);
  } else {
    // Static cold-start taxonomy
    const tagMap = new Map<string, number[]>();
    for (let i = 0; i < rawVotes; i++) {
      const name = engineNames[i];
      const tag = STATIC_CLUSTER_TAXONOMY[name] || `Unique_${name}`;
      if (!tagMap.has(tag)) {
        tagMap.set(tag, []);
      }
      tagMap.get(tag)!.push(i);
    }
    clusteredIndices = Array.from(tagMap.values());

    corrMatrix = Array.from({ length: rawVotes }, (_, i) =>
      Array.from({ length: rawVotes }, (_, j) => (i === j ? 1 : 0.8)),
    );
  }

  // Aggregate cluster votes
  const clusters: ClusterInfo[] = [];
  const clusterWeights: number[] = [];

  for (const idxs of clusteredIndices) {
    const clusterEngines = idxs.map((i) => engineNames[i]);
    const clusterEvs = clusterEngines.map((name) => evidenceMap.get(name)!).filter(Boolean);

    if (clusterEvs.length === 0) continue;

    // Highest calibration score in cluster as cluster weight
    let maxWeight = 1.0;
    let lead = clusterEvs[0].engine;
    let maxStrength = 0;

    for (const ev of clusterEvs) {
      const cal = calibrationScores?.[ev.engine] ?? 1.0;
      if (cal > maxWeight) {
        maxWeight = cal;
      }
      if (ev.strength > maxStrength) {
        maxStrength = ev.strength;
        lead = ev.engine;
      }
    }

    // Weighted mean signed strength
    let netSigned = 0;
    let totalW = 0;
    for (const ev of clusterEvs) {
      const w = calibrationScores?.[ev.engine] ?? 1.0;
      const signed =
        ev.supports === "BUY_EVEN" ? ev.strength : ev.supports === "BUY_ODD" ? -ev.strength : 0;
      netSigned += signed * w;
      totalW += w;
    }

    const meanSigned = totalW > 0 ? netSigned / totalW : 0;
    const supports: ParityContract | "NEUTRAL" =
      meanSigned > 0.05 ? "BUY_EVEN" : meanSigned < -0.05 ? "BUY_ODD" : "NEUTRAL";
    const strength = Math.abs(meanSigned);

    clusters.push({
      engines: clusterEngines,
      supports,
      strength,
      leadEngine: lead,
      weight: maxWeight,
    });
    clusterWeights.push(maxWeight);
  }

  // Kish effective sample size formula: ESS = (Σw)² / Σw²
  const sumW = clusterWeights.reduce((a, b) => a + b, 0);
  const sumW2 = clusterWeights.reduce((a, b) => a + b * b, 0);
  const effectiveVotes = sumW2 > 0 ? Math.min(rawVotes, (sumW * sumW) / sumW2) : rawVotes;
  const inflationFactor = Math.max(1, rawVotes / Math.max(0.1, effectiveVotes));

  // Penalty curve: clamp(0, 35, (inflationFactor - 1) * 12)
  const confidencePenalty = Math.max(0, Math.min(35, Math.round((inflationFactor - 1) * 12)));

  const narrative =
    inflationFactor > 1.8
      ? `High evidence co-linearity: ${rawVotes} raw engine signals clustered into ${clusters.length} independent components (ESS ${effectiveVotes.toFixed(1)}). Confidence penalized -${confidencePenalty}pts.`
      : `Evidence decorrelated: ${rawVotes} raw signals yielded ${clusters.length} independent clusters with minimal inflation factor (${inflationFactor.toFixed(2)}x).`;

  return {
    clusters,
    correlationMatrix: corrMatrix,
    engineOrder: engineNames,
    rawVotes,
    effectiveVotes,
    inflationFactor,
    confidencePenalty,
    narrative,
  };
}

export function resetDecorrelationMemory(market?: string): void {
  if (market) {
    rollingBuffers.delete(market);
  } else {
    rollingBuffers.clear();
  }
}
