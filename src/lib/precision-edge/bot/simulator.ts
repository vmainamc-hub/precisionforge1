// BOT SIMULATOR — replays the bot's exact rules over historical digits.
// Every score in the system is anchored to this: it measures the bot itself,
// not a generic digit edge.
import {
  BOT_SPEC,
  barrierFor,
  botTrigger,
  digitWins,
  legFor,
  type BotBarrier,
  type BotLeg,
} from "./spec";

export interface SimTrade {
  index: number;
  direction: "OVER" | "UNDER";
  barrier: BotBarrier;
  leg: BotLeg;
  countLoss: number;
  stake: number;
  digit: number;
  win: boolean;
  pnl: number;
}

export interface SimResult {
  window: number;
  ticks: number;
  trades: number;
  wins: number;
  winRate: number;
  /** Profit in units of the base stake. */
  pnl: number;
  /** Profit per trade in units of the base stake. */
  expectancy: number;
  longestLossStreak: number;
  /** Longest run of consecutive simulated wins (persistence evidence). */
  longestWinStreak: number;
  /** Consecutive simulated wins at the end of the window. */
  currentWinStreak: number;
  /** Worst equity drawdown in stake multiples. */
  maxDrawdownStakes: number;
  /** Largest stake the ladder ever demanded, in base-stake multiples. */
  peakStake: number;
  freshWinRate: number;
  recoveryWinRate: number;
  overTrades: number;
  underTrades: number;
}

export interface SimOptions {
  ticksAnalyzed?: number;
  waitTicks?: number;
  martingaleFactor?: number;
  payout?: Record<BotBarrier, number>;
  /** CountLoss the simulation starts from — lets the UI simulate the live leg. */
  startCountLoss?: number;
  collectTrades?: boolean;
}

/** Replay the bot over `digits` (oldest → newest). Pure. */
export function simulateBot(
  digits: number[],
  opts: SimOptions = {},
): SimResult & { trades_: SimTrade[] } {
  const ticksAnalyzed = opts.ticksAnalyzed ?? BOT_SPEC.ticksAnalyzed;
  const waitTicks = opts.waitTicks ?? BOT_SPEC.waitTicks;
  const factor = opts.martingaleFactor ?? BOT_SPEC.martingaleFactor;
  const payout = opts.payout ?? BOT_SPEC.payout;

  const trades: SimTrade[] = [];
  let countLoss = Math.max(0, opts.startCountLoss ?? 0);
  let pnl = 0;
  let peakEquity = 0;
  let maxDd = 0;
  let wins = 0;
  let lossStreak = 0;
  let longestLossStreak = 0;
  let winStreak = 0;
  let longestWinStreak = 0;
  let peakStake = 1;
  let freshWins = 0,
    freshTrades = 0,
    recWins = 0,
    recTrades = 0;
  let overTrades = 0,
    underTrades = 0;

  for (let i = ticksAnalyzed; i < digits.length; i++) {
    const trigger = botTrigger(digits.slice(i - ticksAnalyzed, i), ticksAnalyzed);
    if (trigger.direction === "WAIT") continue;
    const direction = trigger.direction;
    const leg = legFor(countLoss);
    const barrier = barrierFor(direction, leg);
    const stake = Math.pow(factor, countLoss);
    peakStake = Math.max(peakStake, stake);
    const outcomeDigit = digits[i];
    const win = digitWins(outcomeDigit, direction, barrier);
    const tradePnl = win ? stake * (payout[barrier] ?? 0.4) : -stake;
    pnl += tradePnl;

    if (win) {
      wins++;
      lossStreak = 0;
      winStreak++;
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      countLoss = 0;
    } else {
      lossStreak++;
      winStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, lossStreak);
      countLoss++;
    }
    if (leg === "fresh") {
      freshTrades++;
      if (win) freshWins++;
    } else {
      recTrades++;
      if (win) recWins++;
    }
    if (direction === "OVER") overTrades++;
    else underTrades++;

    peakEquity = Math.max(peakEquity, pnl);
    maxDd = Math.max(maxDd, peakEquity - pnl);

    if (opts.collectTrades) {
      trades.push({
        index: i,
        direction,
        barrier,
        leg,
        countLoss,
        stake,
        digit: outcomeDigit,
        win,
        pnl: tradePnl,
      });
    }
    i += waitTicks; // WaitTicks cool-down between contracts.
  }

  const total = freshTrades + recTrades;
  return {
    window: digits.length,
    ticks: digits.length,
    trades: total,
    wins,
    winRate: total ? wins / total : 0,
    pnl,
    expectancy: total ? pnl / total : 0,
    longestLossStreak,
    longestWinStreak,
    currentWinStreak: winStreak,
    maxDrawdownStakes: maxDd,
    peakStake,
    freshWinRate: freshTrades ? freshWins / freshTrades : 0,
    recoveryWinRate: recTrades ? recWins / recTrades : 0,
    overTrades,
    underTrades,
    trades_: trades,
  };
}

/** Run the simulator across several windows at once. */
export function simulateWindows(
  digits: number[],
  windows: number[],
  opts: SimOptions = {},
): SimResult[] {
  return windows
    .map((w) => {
      const slice = digits.slice(-w);
      if (slice.length < (opts.ticksAnalyzed ?? BOT_SPEC.ticksAnalyzed) + 2) return null;
      const r = simulateBot(slice, opts);
      return { ...r, window: w };
    })
    .filter((r): r is SimResult & { trades_: SimTrade[] } => r !== null);
}

/**
 * Can the martingale ladder survive from the current CountLoss?
 * Uses the simulated loss-streak distribution against the ladder depth the
 * trader is willing to fund.
 */
export function martingaleSurvival(
  sim: SimResult,
  countLoss: number,
  depth: number,
  factor = BOT_SPEC.martingaleFactor,
): { survivable: boolean; headroom: number; requiredStake: number; score: number } {
  const remaining = Math.max(0, depth - countLoss);
  const headroom = remaining - sim.longestLossStreak;
  const requiredStake = Math.pow(factor, countLoss + Math.max(0, sim.longestLossStreak));
  const score = Math.max(0, Math.min(100, 50 + headroom * 18));
  return { survivable: headroom >= 0, headroom, requiredStake, score };
}
