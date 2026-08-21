// APEX SENTINEL — WALK-FORWARD BACKTEST.
// Replays this market's own observed tick history in strict time order and
// asks the only question that matters: does the refined logic actually select
// better moments than a naive hit-rate rule, or than not filtering at all?
//
// There is no synthetic data, no look-ahead and no parameter fitting on the
// evaluation window. If the refined logic does not beat the baseline, the
// report says so.
import { digitIntelligence } from "./digit-intel";
import { losingDigitThreat } from "./threat";
import { shrinkRate } from "./statistics";
import type { ApexRefinementSettings } from "./settings";

export interface StrategyResult {
  name: string;
  trades: number;
  wins: number;
  winRate: number;
  theoretical: number;
  edgePp: number;
  maxDrawdown: number;
  longestLosingStreak: number;
  /** Wilson 95% lower bound of the win rate. */
  lower: number;
}

export interface BacktestReport {
  symbol: string;
  contract: string;
  ticksReplayed: number;
  baseline: StrategyResult;
  refined: StrategyResult;
  improvementPp: number;
  verdict: "REFINEMENT HELPS" | "NO IMPROVEMENT" | "REFINEMENT HURTS" | "INSUFFICIENT DATA";
  notes: string[];
}

function summarise(name: string, outcomes: boolean[], theoretical: number): StrategyResult {
  const trades = outcomes.length;
  const wins = outcomes.filter(Boolean).length;
  const winRate = trades ? wins / trades : 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let streak = 0;
  let longest = 0;
  for (const w of outcomes) {
    equity += w ? 1 : -1;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    streak = w ? 0 : streak + 1;
    longest = Math.max(longest, streak);
  }
  const est = shrinkRate(wins, trades, theoretical, 40);
  return {
    name,
    trades,
    wins,
    winRate,
    theoretical,
    edgePp: (winRate - theoretical) * 100,
    maxDrawdown,
    longestLosingStreak: longest,
    lower: est.lower,
  };
}

/**
 * @param digits Time-ordered digit history (oldest first).
 * @param winners Winning digits for the contract under test.
 */
export function walkForwardBacktest(
  symbol: string,
  contract: string,
  digits: number[],
  winners: number[],
  settings: ApexRefinementSettings,
): BacktestReport {
  const winSet = new Set(winners);
  const theoretical = winners.length / 10;
  const notes: string[] = [];
  const start = 300;
  const step = 5; // evaluate every 5th tick — keeps a 4000-tick replay responsive

  if (digits.length < start + 400) {
    return {
      symbol,
      contract,
      ticksReplayed: digits.length,
      baseline: summarise("Naive hit-rate rule", [], theoretical),
      refined: summarise("Refined Apex logic", [], theoretical),
      improvementPp: 0,
      verdict: "INSUFFICIENT DATA",
      notes: [`Need at least ${start + 400} observed ticks; this market has ${digits.length}.`],
    };
  }

  const baseOutcomes: boolean[] = [];
  const refinedOutcomes: boolean[] = [];

  for (let i = start; i < digits.length - 1; i += step) {
    const past = digits.slice(0, i);
    const outcome = winSet.has(digits[i]);

    // Baseline: trade whenever the recent 200-tick hit rate beats theoretical.
    const recent = past.slice(-200);
    let w = 0;
    for (const d of recent) if (winSet.has(d)) w++;
    const naiveRate = w / recent.length;
    if (naiveRate > theoretical + 0.03) baseOutcomes.push(outcome);

    // Refined: the same candidate must additionally survive shrinkage,
    // sample size and losing-digit threat analysis.
    const est = shrinkRate(w, recent.length, theoretical, settings.shrinkageStrength);
    if (est.lower <= theoretical) continue;
    if (past.length < settings.minSample) continue;
    const intel = digitIntelligence(past.slice(-1200));
    const threat = losingDigitThreat(intel, past, winners, contract);
    if (threat.groupThreat >= settings.threatThreshold) continue;
    if (threat.asymmetry < 0) continue;
    refinedOutcomes.push(outcome);
  }

  const baseline = summarise("Naive hit-rate rule", baseOutcomes, theoretical);
  const refined = summarise("Refined Apex logic", refinedOutcomes, theoretical);
  const improvementPp = refined.winRate * 100 - baseline.winRate * 100;

  let verdict: BacktestReport["verdict"];
  if (refined.trades < 25 || baseline.trades < 25) {
    verdict = "INSUFFICIENT DATA";
    notes.push(
      `Too few selected moments to judge (baseline ${baseline.trades}, refined ${refined.trades}). A verdict here would be noise.`,
    );
  } else if (improvementPp > 1.5) {
    verdict = "REFINEMENT HELPS";
    notes.push(
      `Refined selection wins ${refined.winRate * 100 >= 0 ? (refined.winRate * 100).toFixed(1) : "0"}% vs ${(baseline.winRate * 100).toFixed(1)}% baseline over ${refined.trades} selected moments.`,
    );
  } else if (improvementPp < -1.5) {
    verdict = "REFINEMENT HURTS";
    notes.push(
      "The filters removed more winners than losers on this history — do not trust them here.",
    );
  } else {
    verdict = "NO IMPROVEMENT";
    notes.push(
      "Refined filtering is statistically indistinguishable from the naive rule on this history.",
    );
  }

  notes.push(
    `Refined logic traded ${refined.trades} times vs ${baseline.trades} — selectivity ${(100 - (refined.trades / Math.max(1, baseline.trades)) * 100).toFixed(0)}%.`,
  );
  notes.push(
    `Worst losing streak: refined ${refined.longestLosingStreak}, baseline ${baseline.longestLosingStreak}. Max drawdown: refined ${refined.maxDrawdown}, baseline ${baseline.maxDrawdown}.`,
  );
  if (refined.lower <= theoretical) {
    notes.push(
      `HONEST CAVEAT — the refined win rate's 95% lower bound (${(refined.lower * 100).toFixed(1)}%) does not clear the ${(theoretical * 100).toFixed(0)}% theoretical rate, so this is not proof of a durable edge.`,
    );
  }

  return {
    symbol,
    contract,
    ticksReplayed: digits.length,
    baseline,
    refined,
    improvementPp,
    verdict,
    notes,
  };
}
