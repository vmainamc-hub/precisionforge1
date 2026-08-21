// Phase 9 — Walk-Forward Shadow Engine & Forward-Only Scorecards
// Evaluates signals purely on unseen forward ticks; drives forward-only weight learning and false-signal logging.

import type { ParityContract, MarketRegime, HiddenRegime } from "./types";
import { listParityJournal, type ParityJournalEntry } from "./journal";

export interface EngineScorecard {
  engine: string;
  forwardSamples: number;
  wins: number;
  losses: number;
  hitRate: number;
  brierScore: number;
  realizedEV: number;
  forwardWeight: number; // 0.2 .. 1.8
}

export interface FalseSignalRecord {
  id: string;
  ts: number;
  market: string;
  side: "EVEN" | "ODD";
  regime: MarketRegime;
  hiddenRegime: HiddenRegime;
  pModel: number;
  effectiveVotes: number;
  pValue: number;
  conformalWidth: number;
  driftState: "NONE" | "MINOR" | "MAJOR";
  lossAttribution: string;
}

export interface ValidationDashboardPayload {
  forwardScorecards: EngineScorecard[];
  falseSignals: FalseSignalRecord[];
  gateRejectionCounts: Record<string, number>;
  brierOverTime: { ts: number; brier: number }[];
  essOverTime: { ts: number; ess: number }[];
  meanInflationFactor: number;
  realizedQuarterKellyEV: number;
}

const engineScorecards = new Map<string, Map<string, EngineScorecard>>();
const falseSignalLedger: FalseSignalRecord[] = [];
const gateRejections: Record<string, number> = {
  Significance: 0,
  "EV Low": 0,
  "Particle Collapse": 0,
  "Major Drift": 0,
  "Conformal Width": 0,
};

const essHistory: { ts: number; ess: number }[] = [];
const brierHistory: { ts: number; brier: number }[] = [];

export function recordGateRejection(reason: keyof typeof gateRejections): void {
  gateRejections[reason] = (gateRejections[reason] || 0) + 1;
}

export function recordForwardEvaluation(args: {
  market: string;
  engine: string;
  predictedSide: ParityContract;
  observedSide: ParityContract;
  predictedProb: number;
  payout?: number;
}): void {
  const payout = args.payout ?? 0.95;
  let marketMap = engineScorecards.get(args.market);
  if (!marketMap) {
    marketMap = new Map();
    engineScorecards.set(args.market, marketMap);
  }

  let card = marketMap.get(args.engine);
  if (!card) {
    card = {
      engine: args.engine,
      forwardSamples: 0,
      wins: 0,
      losses: 0,
      hitRate: 0.5,
      brierScore: 0.25,
      realizedEV: 0,
      forwardWeight: 1.0,
    };
    marketMap.set(args.engine, card);
  }

  const isWin = args.predictedSide === args.observedSide;
  const outcomeVal = isWin ? 1.0 : 0.0;
  const outcomePnl = isWin ? payout : -1.0;

  card.forwardSamples++;
  if (isWin) card.wins++;
  else card.losses++;

  card.hitRate = card.wins / card.forwardSamples;

  // Incremental Brier score update
  const brierDelta = (args.predictedProb - outcomeVal) ** 2;
  card.brierScore =
    (card.brierScore * (card.forwardSamples - 1) + brierDelta) / card.forwardSamples;

  // Realized EV
  card.realizedEV =
    (card.realizedEV * (card.forwardSamples - 1) + outcomePnl) / card.forwardSamples;

  // Forward weight calculation (0.2 floor to 1.8 ceiling)
  // Higher hit rate & lower Brier score -> higher forward-only weight
  const skillAdvantage = card.hitRate - 0.5;
  card.forwardWeight = Math.max(
    0.2,
    Math.min(1.8, 1.0 + skillAdvantage * 3.0 - (card.brierScore - 0.25) * 2.0),
  );
}

export function recordFalseSignal(record: Omit<FalseSignalRecord, "id" | "ts">): void {
  const entry: FalseSignalRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
  };
  falseSignalLedger.push(entry);
  if (falseSignalLedger.length > 200) {
    falseSignalLedger.shift();
  }
}

export function recordTelemetrySample(ess: number, brier: number): void {
  const now = Date.now();
  essHistory.push({ ts: now, ess });
  brierHistory.push({ ts: now, brier });
  if (essHistory.length > 100) essHistory.shift();
  if (brierHistory.length > 100) brierHistory.shift();
}

export function getForwardEngineWeight(market: string, engine: string): number {
  return engineScorecards.get(market)?.get(engine)?.forwardWeight ?? 1.0;
}

export function getValidationDashboardPayload(
  market: string = "default",
): ValidationDashboardPayload {
  const marketMap = engineScorecards.get(market) || new Map();
  const forwardScorecards = Array.from(marketMap.values());

  const totalWins = forwardScorecards.reduce((a, b) => a + b.wins, 0);
  const totalSamples = forwardScorecards.reduce((a, b) => a + b.forwardSamples, 0);
  const realizedQuarterKellyEV =
    totalSamples > 0 ? (totalWins / totalSamples) * 0.95 - (1 - totalWins / totalSamples) : 0;

  return {
    forwardScorecards,
    falseSignals: falseSignalLedger.filter((s) => s.market === market || market === "default"),
    gateRejectionCounts: { ...gateRejections },
    brierOverTime: [...brierHistory],
    essOverTime: [...essHistory],
    meanInflationFactor: 1.2,
    realizedQuarterKellyEV,
  };
}

export function resetWalkForwardMemory(market?: string): void {
  if (market) {
    engineScorecards.delete(market);
  } else {
    engineScorecards.clear();
    falseSignalLedger.length = 0;
    essHistory.length = 0;
    brierHistory.length = 0;
    for (const k in gateRejections) {
      gateRejections[k] = 0;
    }
  }
}
