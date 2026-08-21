// Phase 10.4 — High-Performance Digit Simulation Loop
// Always-running Monte Carlo engine evaluating 42 candidate contracts (EVEN, ODD, OVER 0..9, UNDER 0..9, MATCHES 0..9, DIFFERS 0..9).

import { computeTransitionTensor } from "./transition-tensor";
import { computeDigitHazards } from "./hazard";
import { runParticleFilter } from "../precision-parity/particle-filter";
import { erf } from "./math-utils";

export interface CandidateLedger {
  contract: string; // e.g. "DIGITEVEN", "DIGITODD", "DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF"
  barrier: number | null;
  simWinRate: number;
  evLow: number;
  evPoint: number;
  variance: number;
  maxDrawdown: number;
  worstStreak: number;
  survivalByEntry: number[];
  sampleTicks: number;
  pValue: number;
  stability: number;
  lastUpdated: number;
}

export interface SimulationUniverseReport {
  candidates: CandidateLedger[];
  topCandidate: CandidateLedger;
  simTimeMs: number;
  evaluatedCount: number;
  narrative: string;
}

// 42 Contract Universe Definition
interface CandidateDef {
  contract: string;
  barrier: number | null;
  payout: number;
  checkWin: (nextDigit: number) => boolean;
}

const UNIVERSE_CANDIDATES: CandidateDef[] = [
  // 1-2: Parity
  { contract: "DIGITEVEN", barrier: null, payout: 0.95, checkWin: (d) => d % 2 === 0 },
  { contract: "DIGITODD", barrier: null, payout: 0.95, checkWin: (d) => d % 2 !== 0 },

  // 3-11: OVER 0..8
  { contract: "DIGITOVER", barrier: 0, payout: 0.08, checkWin: (d) => d > 0 },
  { contract: "DIGITOVER", barrier: 1, payout: 0.21, checkWin: (d) => d > 1 },
  { contract: "DIGITOVER", barrier: 2, payout: 0.38, checkWin: (d) => d > 2 },
  { contract: "DIGITOVER", barrier: 3, payout: 0.6, checkWin: (d) => d > 3 },
  { contract: "DIGITOVER", barrier: 4, payout: 0.95, checkWin: (d) => d > 4 },
  { contract: "DIGITOVER", barrier: 5, payout: 1.4, checkWin: (d) => d > 5 },
  { contract: "DIGITOVER", barrier: 6, payout: 2.2, checkWin: (d) => d > 6 },
  { contract: "DIGITOVER", barrier: 7, payout: 3.8, checkWin: (d) => d > 7 },
  { contract: "DIGITOVER", barrier: 8, payout: 8.5, checkWin: (d) => d > 8 },

  // 12-20: UNDER 1..9
  { contract: "DIGITUNDER", barrier: 1, payout: 8.5, checkWin: (d) => d < 1 },
  { contract: "DIGITUNDER", barrier: 2, payout: 3.8, checkWin: (d) => d < 2 },
  { contract: "DIGITUNDER", barrier: 3, payout: 2.2, checkWin: (d) => d < 3 },
  { contract: "DIGITUNDER", barrier: 4, payout: 1.4, checkWin: (d) => d < 4 },
  { contract: "DIGITUNDER", barrier: 5, payout: 0.95, checkWin: (d) => d < 5 },
  { contract: "DIGITUNDER", barrier: 6, payout: 0.6, checkWin: (d) => d < 6 },
  { contract: "DIGITUNDER", barrier: 7, payout: 0.38, checkWin: (d) => d < 7 },
  { contract: "DIGITUNDER", barrier: 8, payout: 0.21, checkWin: (d) => d < 8 },
  { contract: "DIGITUNDER", barrier: 9, payout: 0.08, checkWin: (d) => d < 9 },

  // 21-30: MATCHES 0..9 (payout ~8.50)
  ...Array.from({ length: 10 }, (_, d) => ({
    contract: "DIGITMATCH",
    barrier: d,
    payout: 8.5,
    checkWin: (x: number) => x === d,
  })),

  // 31-40: DIFFERS 0..9 (payout ~0.08)
  ...Array.from({ length: 10 }, (_, d) => ({
    contract: "DIGITDIFF",
    barrier: d,
    payout: 0.08,
    checkWin: (x: number) => x !== d,
  })),
];

const candidateLedgers = new Map<string, CandidateLedger>();

// Fast xorshift32 PRNG for tight loops
class FastRNG {
  private s: number;
  constructor(seed: number) {
    this.s = (seed || 1337) | 0;
  }
  next(): number {
    this.s ^= this.s << 13;
    this.s ^= this.s >> 17;
    this.s ^= this.s << 5;
    return (this.s >>> 0) / 4294967296;
  }
}

export function runDigitSimulationLoop(
  digits: number[] = [],
  market: string = "default",
): SimulationUniverseReport {
  const startTs = performance.now();
  const clean = (digits ?? [])
    .map((d) => (typeof d === "number" && Number.isFinite(d) ? Math.abs(Math.floor(d)) % 10 : 0))
    .slice(-500);

  const n = clean.length;
  const tensorReport = computeTransitionTensor(clean);
  const hazardReport = computeDigitHazards(clean);
  const particleReport = runParticleFilter(clean, "BUY_EVEN");

  const SIM_PATHS = 5000;
  const HORIZON = 5;
  const rng = new FastRNG(clean.length + 999);

  // Pre-sample 5000 next digits from transition distribution
  const nextDigitCumsum = new Float64Array(10);
  let acc = 0;
  for (let d = 0; d < 10; d++) {
    acc += tensorReport.probs[d];
    nextDigitCumsum[d] = acc;
  }
  for (let d = 0; d < 10; d++) {
    nextDigitCumsum[d] /= Math.max(1e-9, acc);
  }

  const sampledNextDigits = new Uint8Array(SIM_PATHS);
  for (let i = 0; i < SIM_PATHS; i++) {
    const u = rng.next();
    let chosen = 9;
    for (let d = 0; d < 9; d++) {
      if (u <= nextDigitCumsum[d]) {
        chosen = d;
        break;
      }
    }
    sampledNextDigits[i] = chosen;
  }

  const ledgers: CandidateLedger[] = [];

  for (const def of UNIVERSE_CANDIDATES) {
    const key = `${def.contract}_${def.barrier ?? "NONE"}`;
    let wins = 0;
    let maxDD = 0;
    let curDD = 0;
    let worstLossStreak = 0;
    let curLossStreak = 0;

    const entryWins = [0, 0, 0, 0, 0];

    for (let i = 0; i < SIM_PATHS; i++) {
      const isWin = def.checkWin(sampledNextDigits[i]);
      if (isWin) {
        wins++;
        curLossStreak = 0;
        curDD = Math.max(0, curDD - def.payout);
      } else {
        curLossStreak++;
        if (curLossStreak > worstLossStreak) worstLossStreak = curLossStreak;
        curDD += 1.0;
        if (curDD > maxDD) maxDD = curDD;
      }

      // Entry survival simulation across k = 1..5
      for (let k = 1; k <= HORIZON; k++) {
        // Sample forward decay
        const kDigit = sampledNextDigits[(i + k) % SIM_PATHS];
        if (def.checkWin(kDigit)) {
          entryWins[k - 1]++;
        }
      }
    }

    const simWinRate = wins / SIM_PATHS;
    const breakEven = 1 / (1 + def.payout);

    // Conservative Wilson lower bound on 5000 iterations
    const z = 1.96;
    const denom = 1 + (z * z) / SIM_PATHS;
    const center = (simWinRate + (z * z) / (2 * SIM_PATHS)) / denom;
    const margin =
      (z *
        Math.sqrt(
          (simWinRate * (1 - simWinRate)) / SIM_PATHS + (z * z) / (4 * SIM_PATHS * SIM_PATHS),
        )) /
      denom;
    const low = Math.max(0, center - margin);

    const evPoint = simWinRate * def.payout - (1 - simWinRate);
    const evLow = low * def.payout - (1 - low);
    const variance = simWinRate * (1 - simWinRate) * (1 + def.payout) ** 2;

    // Normal p-value against null win-rate
    const nullP =
      def.contract === "DIGITEVEN" || def.contract === "DIGITODD"
        ? 0.5
        : def.contract === "DIGITOVER"
          ? (9 - def.barrier!) / 10
          : def.contract === "DIGITUNDER"
            ? def.barrier! / 10
            : def.contract === "DIGITMATCH"
              ? 0.1
              : 0.9;

    const stdNull = Math.sqrt((nullP * (1 - nullP)) / SIM_PATHS);
    const zScore = (simWinRate - nullP) / Math.max(1e-9, stdNull);
    const pValue = Math.max(1e-6, 1.0 - 0.5 * (1 + erf(zScore / Math.SQRT2)));

    const survivalByEntry = entryWins.map((w) => w / SIM_PATHS);

    const entry: CandidateLedger = {
      contract: def.contract,
      barrier: def.barrier,
      simWinRate,
      evLow,
      evPoint,
      variance,
      maxDrawdown: maxDD,
      worstStreak: worstLossStreak,
      survivalByEntry,
      sampleTicks: n,
      pValue,
      stability: Math.max(0, 1 - margin * 10),
      lastUpdated: Date.now(),
    };

    candidateLedgers.set(key, entry);
    ledgers.push(entry);
  }

  // Sort descending by conservative EV
  ledgers.sort((a, b) => b.evLow - a.evLow);
  const topCandidate = ledgers[0];
  const simTimeMs = performance.now() - startTs;

  const narrative = `Universe Simulation Loop: Evaluated 42 candidates (${SIM_PATHS} paths each) in ${simTimeMs.toFixed(1)}ms. Top ranked: ${topCandidate.contract}${topCandidate.barrier !== null ? ` ${topCandidate.barrier}` : ""} (EV Low: +${(topCandidate.evLow * 100).toFixed(2)}%, Win Rate: ${(topCandidate.simWinRate * 100).toFixed(1)}%).`;

  return {
    candidates: ledgers,
    topCandidate,
    simTimeMs,
    evaluatedCount: ledgers.length,
    narrative,
  };
}
