// Precision Edge — Global Opportunity Scanner.
// Independent ranking layer that reuses the existing V2 reasoning engine
// output (MarketReasoning) and applies conservative cross-market filters:
//   1. Mandatory Red Bar Rule: BOTH the Red bar AND Light-Red bar must sit
//      inside the contract's winning zone. Any violation → discard market.
//   2. Contract must be READY.
//   3. AI verification pass shaves confidence for conflicts / thin edge /
//      young signals. If it falls below `readyThreshold`, market is rejected.
// Returns the single strongest opportunity plus the runner-up ranking.
import type { ContractVerdict, MarketReasoning } from "./types";
import { readPsychology } from "./psychology-of-numbers";

export interface GlobalCandidate {
  market: string;
  name: string;
  verdict: ContractVerdict;
  reasoning: MarketReasoning;
  redDigit: number;
  lightRedDigit: number;
  redInWinning: boolean;
  lightRedInWinning: boolean;
  precision: number; // 0..100 composite of edge + stability + persistence
  stability: number; // 0..100
  momentumScore: number; // 0..100
  momentumLabel: "Strong" | "Steady" | "Weak";
  signalAgeTicks: number;
  aiConfidence: number; // post-AI-review confidence 0..100
  aiNotes: string[]; // reasoning bullets from AI verification pass
  score: number; // final composite for ranking
}

export interface GlobalScanResult {
  best: GlobalCandidate | null;
  topThree: GlobalCandidate[];
  rejectedForRedBars: number;
  rejectedForReady: number;
  rejectedByAI: number;
  /** HARD GATE veto counts — edge / manipulation / persistence. */
  rejectedForEdge: number;
  rejectedForManipulation: number;
  rejectedForPersistence: number;
  scannedMarkets: number;
  scannedAt: number;
  reason?: string; // populated when best is null
}

function winnersFor(v: ContractVerdict): Set<number> {
  const s = new Set<number>();
  for (let d = 0; d < 10; d++) {
    if (v.side === "OVER" ? d > v.barrier : d < v.barrier) s.add(d);
  }
  return s;
}

function clamp(x: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, x));
}

function labelMomentum(m: number): "Strong" | "Steady" | "Weak" {
  if (m >= 66) return "Strong";
  if (m >= 40) return "Steady";
  return "Weak";
}

export interface GlobalScanOptions {
  readyThreshold: number; // min confidence to remain READY (default 80)
  minEdgePct: number; // percentage points (e.g. 1.0)
  minPersistenceTicks: number; // min trailing win streak
  maxManipulation: number; // reject beyond this
}

export const DEFAULT_GLOBAL_OPTIONS: GlobalScanOptions = {
  readyThreshold: 80,
  minEdgePct: 1.0,
  minPersistenceTicks: 3,
  maxManipulation: 60,
};

/**
 * HARD GATES — edge, manipulation and persistence are pass/fail. A verdict
 * that fails any one of them is discarded outright: no confidence shaving,
 * no "close enough" ranking. Thresholds come from the operator's settings
 * drawer, so they stay fully configurable.
 */
export type HardGateFailure = "edge" | "manipulation" | "persistence";

export function hardGateCheck(
  v: ContractVerdict,
  m: MarketReasoning,
  opts: GlobalScanOptions,
): HardGateFailure | null {
  if (m.psychology.manipulation >= opts.maxManipulation) return "manipulation";
  if (v.edge * 100 < opts.minEdgePct) return "edge";
  if (v.persistenceTicks < opts.minPersistenceTicks) return "persistence";
  return null;
}

/**
 * AI verification pass — runs only on verdicts that already cleared the hard
 * gates. Adjusts confidence for contradictions, momentum alignment and market
 * health. Never inflates; only shaves confidence.
 */
function aiVerify(
  v: ContractVerdict,
  m: MarketReasoning,
  opts: GlobalScanOptions,
): { confidence: number; notes: string[] } {
  const notes: string[] = [];
  let conf = v.confidence;

  // Hard gates already passed — record them as confirmations.
  notes.push(`Gate · persistence ${v.persistenceTicks}t ≥ ${opts.minPersistenceTicks}t.`);
  notes.push(`Gate · edge ${(v.edge * 100).toFixed(2)}% ≥ ${opts.minEdgePct.toFixed(1)}%.`);
  notes.push(
    `Gate · manipulation ${m.psychology.manipulation.toFixed(0)}% < ${opts.maxManipulation}%.`,
  );

  // Momentum aligned?
  if (v.momentum < 0) {
    conf -= 8;
    notes.push(`Momentum fading (${(v.momentum * 100).toFixed(1)}%) — −8.`);
  } else if (v.momentum >= 0.02) {
    notes.push(`Momentum aligned (+${(v.momentum * 100).toFixed(1)}%).`);
  }

  if (m.psychology.health < 55) {
    conf -= 8;
    notes.push(`Market health only ${m.psychology.health.toFixed(0)} — −8.`);
  }

  // Conflicts / contradictions from the reasoning engine.
  const conflicts = v.conflicts?.length ?? 0;
  if (conflicts > 0) {
    const shave = Math.min(15, 4 * conflicts);
    conf -= shave;
    notes.push(`${conflicts} contradiction${conflicts > 1 ? "s" : ""} noted — −${shave}.`);
  }

  // DBot priming — if the setup has no entry trigger primed, it's noise.
  if (v.dbotPrimed && !v.dbotPrimed.primed) {
    conf -= 12;
    notes.push(`Not currently primed for entry — −12.`);
  }

  return { confidence: clamp(conf), notes };
}

export function globalScan(
  markets: MarketReasoning[],
  options: Partial<GlobalScanOptions> = {},
): GlobalScanResult {
  const opts = { ...DEFAULT_GLOBAL_OPTIONS, ...options };
  const scannedAt = Date.now();
  let rejectedForRedBars = 0;
  let rejectedForReady = 0;
  let rejectedByAI = 0;
  let rejectedForEdge = 0;
  let rejectedForManipulation = 0;
  let rejectedForPersistence = 0;

  const candidates: GlobalCandidate[] = [];

  for (const m of markets) {
    if (!m.ready) continue;
    const bars = readPsychology(m.stats);

    for (const v of m.verdicts) {
      const winners = winnersFor(v);
      const redInWinning = winners.has(bars.red);
      const lightRedInWinning = winners.has(bars.lightRed);

      // ── MANDATORY RED BAR RULE ─────────────────────────────────────
      if (!redInWinning || !lightRedInWinning) {
        rejectedForRedBars++;
        continue;
      }

      // Must be READY.
      if (v.state !== "READY") {
        rejectedForReady++;
        continue;
      }

      // ── HARD GATES: edge / manipulation / persistence ───────────────
      const gateFail = hardGateCheck(v, m, opts);
      if (gateFail) {
        if (gateFail === "edge") rejectedForEdge++;
        else if (gateFail === "manipulation") rejectedForManipulation++;
        else rejectedForPersistence++;
        continue;
      }

      const stability = clamp(v.consistency);
      const momentumScore = clamp(50 + v.momentum * 500);
      const precision = clamp(
        0.45 * v.confidence +
          0.25 * stability +
          0.15 * clamp(v.edge * 100 * 20) +
          0.15 * clamp(v.persistenceTicks * 10),
      );

      const { confidence: aiConfidence, notes: aiNotes } = aiVerify(v, m, opts);
      if (aiConfidence < opts.readyThreshold) {
        rejectedByAI++;
        continue;
      }

      // Ranking score — confidence dominates; ties broken by precision,
      // then stability, then momentum, then freshness (younger = higher).
      const freshness = clamp(100 - v.persistenceTicks * 2, 0, 100) * 0.001;
      const score =
        aiConfidence * 1_000_000 +
        precision * 1_000 +
        stability * 10 +
        momentumScore * 0.1 +
        freshness;

      candidates.push({
        market: m.market,
        name: m.name,
        verdict: v,
        reasoning: m,
        redDigit: bars.red,
        lightRedDigit: bars.lightRed,
        redInWinning,
        lightRedInWinning,
        precision,
        stability,
        momentumScore,
        momentumLabel: labelMomentum(momentumScore),
        signalAgeTicks: v.persistenceTicks,
        aiConfidence,
        aiNotes,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0] ?? null;
  const topThree = candidates.slice(0, 3);

  const gateVetoes = rejectedForEdge + rejectedForManipulation + rejectedForPersistence;

  let reason: string | undefined;
  if (!best) {
    if (
      rejectedForRedBars > 0 &&
      rejectedForReady === 0 &&
      rejectedByAI === 0 &&
      gateVetoes === 0
    ) {
      reason = "No market currently has both Red bars inside their winning zone.";
    } else if (gateVetoes > 0) {
      const parts: string[] = [];
      if (rejectedForEdge)
        parts.push(`${rejectedForEdge} thin edge (< ${opts.minEdgePct.toFixed(1)}%)`);
      if (rejectedForManipulation)
        parts.push(`${rejectedForManipulation} manipulated (≥ ${opts.maxManipulation}%)`);
      if (rejectedForPersistence)
        parts.push(`${rejectedForPersistence} immature (< ${opts.minPersistenceTicks} ticks)`);
      reason = `Hard gates vetoed every candidate — ${parts.join(", ")}.`;
    } else if (rejectedByAI > 0) {
      reason = "Candidates found but AI verification reduced confidence below the READY threshold.";
    } else {
      reason = "No high-quality opportunities found. Continue monitoring.";
    }
  }

  return {
    best,
    topThree,
    rejectedForRedBars,
    rejectedForReady,
    rejectedByAI,
    rejectedForEdge,
    rejectedForManipulation,
    rejectedForPersistence,
    scannedMarkets: markets.length,
    scannedAt,
    reason,
  };
}
