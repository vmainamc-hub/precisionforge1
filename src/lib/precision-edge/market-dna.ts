// Long-term descriptive statistics per market. Updated with exponential
// moving average so it converges over time without unbounded memory.
import type { FeatureBundle, MarketDNA } from "./types";

const store = new Map<string, MarketDNA>();

export function getDNA(market: string): MarketDNA {
  let d = store.get(market);
  if (!d) {
    d = {
      market,
      samples: 0,
      meanDistribution: new Array(10).fill(0.1),
      meanEntropy: Math.log2(10),
      meanGreenPct: 0.5,
      meanRecoveryCompatibility: 60,
      meanMarketHealth: 70,
      meanProbabilities: {},
      updatedAt: Date.now(),
    };
    store.set(market, d);
  }
  return d;
}

export function updateDNA(
  market: string,
  f: FeatureBundle,
  extras: {
    marketHealth: number;
    recoveryCompatibility: number;
    probabilities?: Record<string, number>;
  } = { marketHealth: 70, recoveryCompatibility: 60 },
) {
  const d = getDNA(market);
  const alpha = d.samples < 50 ? 0.05 : 0.01;
  d.meanDistribution = d.meanDistribution.map((m, i) => m * (1 - alpha) + f.pct[i] * alpha);
  d.meanEntropy = d.meanEntropy * (1 - alpha) + f.entropy * alpha;
  d.meanGreenPct = d.meanGreenPct * (1 - alpha) + f.greenPct * alpha;
  d.meanMarketHealth = d.meanMarketHealth * (1 - alpha) + extras.marketHealth * alpha;
  d.meanRecoveryCompatibility =
    d.meanRecoveryCompatibility * (1 - alpha) + extras.recoveryCompatibility * alpha;
  if (extras.probabilities) {
    for (const [k, v] of Object.entries(extras.probabilities)) {
      const prev = d.meanProbabilities[k] ?? v;
      d.meanProbabilities[k] = prev * (1 - alpha) + v * alpha;
    }
  }
  d.samples++;
  d.updatedAt = Date.now();
}

export function resetDNA() {
  store.clear();
}
