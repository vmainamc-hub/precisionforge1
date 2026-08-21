// BURST FORECASTER — will the bot's own 6-tick trigger fire on the next ticks,
// and on which side? Lets the app pre-warn "bot is about to fire OVER" and
// pre-validate that entry before the bot commits.
import { BOT_SPEC, botTrigger, type BotDirection } from "./spec";

export interface BurstForecast {
  /** Side the imminent burst would fire on. */
  side: BotDirection;
  /** 0-1 probability the trigger fires within `horizon` ticks. */
  probability: number;
  /** Ticks until the trigger could fire (1 = next tick). */
  ticksToFire: number;
  /** Current live trigger state. */
  current: BotDirection;
  currentHighPct: number;
  /** How far into a burst we already are: 0 = fresh, 1 = fully extended. */
  maturity: number;
  /** True when the burst is already stretched and likely to mean-revert. */
  lateStage: boolean;
  /** Empirical P(high digit) used for the forecast. */
  pHigh: number;
}

/**
 * Forecast the next 1..horizon ticks by rolling the bot's own window forward and
 * weighting each branch by the empirical P(high) of the market.
 */
export function forecastBurst(
  digits: number[],
  baselineDigits: number[] = digits,
  horizon = 3,
  ticksAnalyzed = BOT_SPEC.ticksAnalyzed,
): BurstForecast {
  const pHigh = baselineDigits.length
    ? baselineDigits.filter((d) => d >= 5).length / baselineDigits.length
    : 0.5;
  const live = botTrigger(digits, ticksAnalyzed);

  let bestSide: BotDirection = "WAIT";
  let bestProb = 0;
  let ticksToFire = 0;

  // Branch enumeration over the horizon: each future tick is high (pHigh) or
  // low (1 - pHigh). Aggregate the probability mass that fires each side.
  const probOver = new Map<number, number>();
  const probUnder = new Map<number, number>();

  const walk = (window: number[], depth: number, prob: number) => {
    if (depth > horizon || prob < 1e-4) return;
    for (const isHigh of [true, false]) {
      const p = prob * (isHigh ? pHigh : 1 - pHigh);
      const next = [...window, isHigh ? 7 : 2].slice(-ticksAnalyzed);
      const t = botTrigger(next, ticksAnalyzed);
      if (t.direction === "OVER") probOver.set(depth, (probOver.get(depth) ?? 0) + p);
      else if (t.direction === "UNDER") probUnder.set(depth, (probUnder.get(depth) ?? 0) + p);
      else walk(next, depth + 1, p);
    }
  };
  walk(digits.slice(-ticksAnalyzed), 1, 1);

  const sumOver = [...probOver.values()].reduce((a, b) => a + b, 0);
  const sumUnder = [...probUnder.values()].reduce((a, b) => a + b, 0);
  if (sumOver >= sumUnder && sumOver > 0) {
    bestSide = "OVER";
    bestProb = sumOver;
    ticksToFire = Math.min(...[...probOver.keys()]);
  } else if (sumUnder > 0) {
    bestSide = "UNDER";
    bestProb = sumUnder;
    ticksToFire = Math.min(...[...probUnder.keys()]);
  }

  if (live.direction !== "WAIT") {
    bestSide = live.direction;
    bestProb = 1;
    ticksToFire = 0;
  }

  // Maturity: how long the current side has already dominated beyond the 6-tick
  // window. A burst that has been running for 10+ ticks is late stage.
  const side = live.direction !== "WAIT" ? live.direction : bestSide;
  let run = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    const isHigh = digits[i] >= 5;
    if ((side === "OVER" && isHigh) || (side === "UNDER" && !isHigh)) run++;
    else break;
  }
  const extended = extendedRun(digits, side, ticksAnalyzed * 2);
  const maturity = Math.max(0, Math.min(1, (run / 6) * 0.5 + extended * 0.5));

  return {
    side,
    probability: Math.max(0, Math.min(1, bestProb)),
    ticksToFire,
    current: live.direction,
    currentHighPct: live.highPct,
    maturity,
    lateStage: maturity >= 0.65,
    pHigh,
  };
}

/** Share of the last `n` ticks already on `side` — 0.5 is neutral. */
function extendedRun(digits: number[], side: BotDirection, n: number): number {
  const slice = digits.slice(-n);
  if (!slice.length || side === "WAIT") return 0;
  const hits = slice.filter((d) => (side === "OVER" ? d >= 5 : d <= 4)).length;
  const share = hits / slice.length;
  return Math.max(0, Math.min(1, (share - 0.5) * 2));
}
