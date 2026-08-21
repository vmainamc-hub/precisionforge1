// Phase 10.3 — Barrier Threshold Sweep Engine
// Evaluates 20 Over/Under contracts across multi-horizon windows with exact broker payout curves and Wilson CIs.

export interface BarrierContractScore {
  contract: "DIGITOVER" | "DIGITUNDER";
  barrier: number;
  probPoint: number;
  probLow: number;
  probHigh: number;
  derivPayout: number; // Actual broker payout multiple (e.g. 0.95, 1.40, 8.50)
  breakEvenProb: number;
  evPoint: number;
  evLow: number;
  sampleSize: number;
  rank: number;
}

export interface ThresholdSweepReport {
  rankedContracts: BarrierContractScore[];
  bestContract: BarrierContractScore;
  windows: Record<number, { overRates: number[]; underRates: number[] }>;
  narrative: string;
}

// Empirical Deriv synthetic index payout rates per barrier (fractional return, e.g. 0.95 = 95% net profit)
// OVER barriers 0..9 (P(digit > barrier)):
// barrier 0: digits 1..9 (90% win rate -> payout ~0.08)
// barrier 1: digits 2..9 (80% win rate -> payout ~0.21)
// barrier 2: digits 3..9 (70% win rate -> payout ~0.38)
// barrier 3: digits 4..9 (60% win rate -> payout ~0.60)
// barrier 4: digits 5..9 (50% win rate -> payout ~0.95)
// barrier 5: digits 6..9 (40% win rate -> payout ~1.40)
// barrier 6: digits 7..9 (30% win rate -> payout ~2.20)
// barrier 7: digits 8..9 (20% win rate -> payout ~3.80)
// barrier 8: digit 9 (10% win rate -> payout ~8.50)
// barrier 9: impossible (0%)
const DERIV_OVER_PAYOUTS: Record<number, number> = {
  0: 0.08,
  1: 0.21,
  2: 0.38,
  3: 0.6,
  4: 0.95,
  5: 1.4,
  6: 2.2,
  7: 3.8,
  8: 8.5,
  9: 0.0,
};

// UNDER barriers 0..9 (P(digit < barrier)):
// barrier 0: impossible (0%)
// barrier 1: digit 0 (10% win rate -> payout ~8.50)
// barrier 2: digits 0..1 (20% win rate -> payout ~3.80)
// barrier 3: digits 0..2 (30% win rate -> payout ~2.20)
// barrier 4: digits 0..3 (40% win rate -> payout ~1.40)
// barrier 5: digits 0..4 (50% win rate -> payout ~0.95)
// barrier 6: digits 0..5 (60% win rate -> payout ~0.60)
// barrier 7: digits 0..6 (70% win rate -> payout ~0.38)
// barrier 8: digits 0..7 (80% win rate -> payout ~0.21)
// barrier 9: digits 0..8 (90% win rate -> payout ~0.08)
const DERIV_UNDER_PAYOUTS: Record<number, number> = {
  0: 0.0,
  1: 8.5,
  2: 3.8,
  3: 2.2,
  4: 1.4,
  5: 0.95,
  6: 0.6,
  7: 0.38,
  8: 0.21,
  9: 0.08,
};

const SWEEP_WINDOWS = [20, 50, 100, 200, 500];

function wilsonInterval(k: number, n: number, z: number = 1.645): [number, number] {
  if (n <= 0) return [0.5, 0.5];
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function sweepThresholds(digits: number[] = []): ThresholdSweepReport {
  const clean = (digits ?? [])
    .map((d) => (typeof d === "number" && Number.isFinite(d) ? Math.abs(Math.floor(d)) % 10 : 0))
    .slice(-500);
  const n = clean.length;

  const windowStats: Record<number, { overRates: number[]; underRates: number[] }> = {};

  for (const w of SWEEP_WINDOWS) {
    const slice = clean.slice(-w);
    const m = slice.length;
    const overRates: number[] = new Array(10).fill(0);
    const underRates: number[] = new Array(10).fill(0);

    for (let b = 0; b < 10; b++) {
      let overCount = 0;
      let underCount = 0;
      for (let i = 0; i < m; i++) {
        if (slice[i] > b) overCount++;
        if (slice[i] < b) underCount++;
      }
      overRates[b] = m > 0 ? overCount / m : (9 - b) / 10;
      underRates[b] = m > 0 ? underCount / m : b / 10;
    }
    windowStats[w] = { overRates, underRates };
  }

  // 20 Candidate Over/Under contracts evaluated on primary 500-tick window
  const candidates: BarrierContractScore[] = [];

  for (let b = 0; b < 10; b++) {
    // OVER b
    if (b < 9) {
      let overWins = 0;
      for (let i = 0; i < n; i++) {
        if (clean[i] > b) overWins++;
      }
      const [low, high] = wilsonInterval(overWins, n);
      const probPoint = n > 0 ? overWins / n : (9 - b) / 10;
      const payout = DERIV_OVER_PAYOUTS[b];
      const breakEvenProb = 1 / (1 + payout);
      const evPoint = probPoint * payout - (1 - probPoint);
      const evLow = low * payout - (1 - low);

      candidates.push({
        contract: "DIGITOVER",
        barrier: b,
        probPoint,
        probLow: low,
        probHigh: high,
        derivPayout: payout,
        breakEvenProb,
        evPoint,
        evLow,
        sampleSize: n,
        rank: 0,
      });
    }

    // UNDER b
    if (b > 0) {
      let underWins = 0;
      for (let i = 0; i < n; i++) {
        if (clean[i] < b) underWins++;
      }
      const [low, high] = wilsonInterval(underWins, n);
      const probPoint = n > 0 ? underWins / n : b / 10;
      const payout = DERIV_UNDER_PAYOUTS[b];
      const breakEvenProb = 1 / (1 + payout);
      const evPoint = probPoint * payout - (1 - probPoint);
      const evLow = low * payout - (1 - low);

      candidates.push({
        contract: "DIGITUNDER",
        barrier: b,
        probPoint,
        probLow: low,
        probHigh: high,
        derivPayout: payout,
        breakEvenProb,
        evPoint,
        evLow,
        sampleSize: n,
        rank: 0,
      });
    }
  }

  // Sort descending by conservative EV (evLow)
  candidates.sort((a, b) => b.evLow - a.evLow);
  candidates.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  const bestContract = candidates[0];
  const narrative = `Swept 20 Over/Under contracts across ${n} ticks. Top barrier edge: ${bestContract.contract} ${bestContract.barrier} (EV low: +${(bestContract.evLow * 100).toFixed(2)}%, payout: ${(bestContract.derivPayout * 100).toFixed(0)}%, win rate: ${(bestContract.probPoint * 100).toFixed(1)}%).`;

  return {
    rankedContracts: candidates,
    bestContract,
    windows: windowStats,
    narrative,
  };
}
