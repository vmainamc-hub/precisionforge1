// Precision Trend AI V3 — Market Mind Engine.
//
// One integrated reasoning engine composed of six modules. Indicators are
// evidence sources, never decision makers. The engine reasons about market
// state, trend quality, momentum, volatility/entropy, psychology, and
// forward scenarios, resolves contradictions, and only then produces a
// verdict — the way an experienced analyst would.

import type { Tick } from "@/lib/analytics";
import type {
  Contradiction,
  Debate,
  DebateArgument,
  EntryTiming,
  MarketReport,
  MarketMindReport,
  MarketState,
  ReasoningModule,
  Scenario,
  ScenarioAnalysis,
  TrendContract,
} from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ───────────────────────── indicators ─────────────────────────
function emaSeries(a: number[], n: number): number[] {
  if (!a.length) return [];
  const k = 2 / (n + 1);
  const out = [a[0]];
  for (let i = 1; i < a.length; i++) out.push(a[i] * k + out[i - 1] * (1 - k));
  return out;
}
const ema = (a: number[], n: number) => {
  const s = emaSeries(a, n);
  return s.length ? s[s.length - 1] : 0;
};
const sma = (a: number[], n: number) => {
  if (!a.length) return 0;
  const s = a.slice(-n);
  return s.reduce((x, y) => x + y, 0) / s.length;
};
function stdev(a: number[]) {
  if (a.length < 2) return 0;
  const mu = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / a.length);
}
function rsi(p: number[], n = 14) {
  if (p.length < n + 1) return 50;
  let g = 0,
    l = 0;
  for (let i = p.length - n; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  const rs = g / (l || 1e-9);
  return 100 - 100 / (1 + rs);
}
function macd(p: number[]) {
  const e12 = emaSeries(p, 12);
  const e26 = emaSeries(p, 26);
  const L = Math.min(e12.length, e26.length);
  const line: number[] = [];
  for (let i = 0; i < L; i++) line.push(e12[i] - e26[i]);
  const sig = emaSeries(line, 9);
  const m = line[line.length - 1] ?? 0;
  const s = sig[sig.length - 1] ?? 0;
  return { m, sig: s, hist: m - s };
}
function bollinger(p: number[], n = 20, k = 2) {
  const win = p.slice(-n);
  const mid = sma(win, n);
  const sd = stdev(win);
  return {
    upper: mid + k * sd,
    lower: mid - k * sd,
    mid,
    width: ((2 * k * sd) / (mid || 1)) * 100,
    position: sd === 0 ? 0.5 : (p[p.length - 1] - (mid - k * sd)) / (2 * k * sd),
  };
}
function adxSuite(p: number[], n = 14) {
  if (p.length < n + 2) return { adx: 0, plusDI: 0, minusDI: 0 };
  const plusDM: number[] = [],
    minusDM: number[] = [],
    tr: number[] = [];
  for (let i = 1; i < p.length; i++) {
    const up = Math.max(0, p[i] - p[i - 1]);
    const dn = Math.max(0, p[i - 1] - p[i]);
    plusDM.push(up > dn ? up : 0);
    minusDM.push(dn > up ? dn : 0);
    tr.push(Math.abs(p[i] - p[i - 1]));
  }
  const trS = sma(tr, n) || 1e-9;
  const pDI = (sma(plusDM, n) / trS) * 100;
  const mDI = (sma(minusDM, n) / trS) * 100;
  const dx = (Math.abs(pDI - mDI) / Math.max(1e-9, pDI + mDI)) * 100;
  return { adx: dx, plusDI: pDI, minusDI: mDI };
}
function williamsR(p: number[], n = 14) {
  if (p.length < n) return -50;
  const win = p.slice(-n);
  const hi = Math.max(...win);
  const lo = Math.min(...win);
  if (hi === lo) return -50;
  return ((hi - p[p.length - 1]) / (hi - lo)) * -100;
}
function cci(p: number[], n = 20) {
  if (p.length < n) return 0;
  const win = p.slice(-n);
  const mean = win.reduce((a, b) => a + b, 0) / n;
  const mad = win.reduce((a, b) => a + Math.abs(b - mean), 0) / n || 1e-9;
  return (p[p.length - 1] - mean) / (0.015 * mad);
}
function shannonEntropy(vals: number[]) {
  if (!vals.length) return 0;
  const buckets = 10;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max === min) return 0;
  const counts = new Array(buckets).fill(0);
  for (const v of vals) {
    const b = Math.min(buckets - 1, Math.floor(((v - min) / (max - min)) * buckets));
    counts[b]++;
  }
  const N = vals.length;
  let H = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / N;
    H -= p * Math.log2(p);
  }
  return H / Math.log2(buckets);
}

// ───────────────────────── session memory ─────────────────────────
interface Memory {
  stateHistory: MarketState[];
  lastRecommendation: TrendContract | "NO_TRADE";
  persistence: number;
  lastEntryPrice: number | null;
}
const MEMORY = new Map<string, Memory>();
function memoryOf(m: string): Memory {
  const e = MEMORY.get(m);
  if (e) return e;
  const fresh: Memory = {
    stateHistory: [],
    lastRecommendation: "NO_TRADE",
    persistence: 0,
    lastEntryPrice: null,
  };
  MEMORY.set(m, fresh);
  return fresh;
}
export function resetTrendMemory(market?: string) {
  if (market) MEMORY.delete(market);
  else MEMORY.clear();
}

// ───────────────────────── settings ─────────────────────────
export interface TrendSettings {
  autoScan: boolean;
  refreshMs: number;
  minTicks: number;
  minConfidence: number; // gate for issuing a trade
  minPersistenceSeconds: number;
  strictness: "BALANCED" | "STRICT" | "AGGRESSIVE"; // how demanding the mind is
}
export const DEFAULT_TREND_SETTINGS: TrendSettings = {
  autoScan: true,
  refreshMs: 1500,
  minTicks: 300,
  minConfidence: 72,
  minPersistenceSeconds: 15,
  strictness: "BALANCED",
};

// ───────────────────────── Module 1: Market State ─────────────────────────
interface Snap {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdHist: number;
  adx: number;
  plusDI: number;
  minusDI: number;
  bbWidth: number;
  bbWidthPrev: number;
  bbPosition: number;
  volPct: number;
  manipulation: number;
  entropy: number;
  cci: number;
  williams: number;
  ret60: number;
  ret120: number;
  efficiency: number;
}

function reasonState(
  p: number[],
  s: Snap,
  mem: Memory,
): { state: MarketState; module: ReasoningModule } {
  const notes: string[] = [];
  let state: MarketState = "STABLE";

  const up = s.ema20 > s.ema50 && s.ema50 > s.ema200;
  const down = s.ema20 < s.ema50 && s.ema50 < s.ema200;
  const expanding = s.bbWidth > s.bbWidthPrev * 1.12;
  const contracting = s.bbWidth < s.bbWidthPrev * 0.88;

  if (s.manipulation > 55) {
    state = "MANIPULATION";
    notes.push("Return distribution shows spikes/silence pattern typical of manipulation.");
  } else if (s.entropy > 0.85 || s.volPct > 2.4) {
    state = "NOISY";
    notes.push("Extreme entropy or explosive volatility — behaviour is not predictable.");
  } else if (s.bbWidth < 0.1 && s.adx < 18) {
    state = "COMPRESSION";
    notes.push("Bollinger bands contracted, ADX low — energy is being stored.");
  } else if (mem.stateHistory.slice(-3).includes("COMPRESSION") && expanding && s.adx > 20) {
    state = "BREAKOUT";
    notes.push("Range broke after compression with expanding volatility.");
  } else if ((up && s.rsi > 80) || (down && s.rsi < 20)) {
    state = "EXHAUSTION";
    notes.push("Trend still extends but RSI reads exhaustion.");
  } else if ((up && s.macdHist < 0 && s.rsi < 55) || (down && s.macdHist > 0 && s.rsi > 45)) {
    state = "DISTRIBUTION";
    notes.push("Trend direction intact but momentum leaking against it.");
  } else if (up && s.adx > 30 && Math.sign(s.plusDI - s.minusDI) < 0) {
    state = "REVERSAL";
    notes.push("Directional strength shifting against the higher-timeframe trend.");
  } else if (down && s.adx > 30 && Math.sign(s.plusDI - s.minusDI) > 0) {
    state = "REVERSAL";
    notes.push("Directional strength shifting against the higher-timeframe trend.");
  } else if (up && s.rsi < 45 && s.macdHist < 0 && s.ret60 < 0) {
    state = "PULLBACK";
    notes.push("Higher-timeframe up-trend intact but short-term prices retracing.");
  } else if (down && s.rsi > 55 && s.macdHist > 0 && s.ret60 > 0) {
    state = "PULLBACK";
    notes.push("Higher-timeframe down-trend intact but short-term prices bouncing.");
  } else if (up && s.adx > 40 && expanding) {
    state = "STRONG_TREND";
    notes.push("Very strong directional strength with expanding range.");
  } else if (down && s.adx > 40 && expanding) {
    state = "STRONG_TREND";
    notes.push("Very strong directional strength with expanding range.");
  } else if ((up || down) && s.adx > 22 && s.efficiency > 0.35) {
    state = (up || down) && s.adx < 28 ? "WEAK_TREND" : "HEALTHY_TREND";
    notes.push(
      `Trend structure intact, ADX ${s.adx.toFixed(0)}, path efficiency ${(s.efficiency * 100).toFixed(0)}%.`,
    );
  } else if (contracting && s.adx < 15) {
    state = "ACCUMULATION";
    notes.push("Range tightening at low directional strength — participation drying up.");
  } else if (s.adx < 15 && s.entropy > 0.6) {
    state = "NOISY";
    notes.push("Direction unclear, entropy elevated — best to stay flat.");
  } else if (up || down) {
    state = "EARLY_TREND";
    notes.push("Trend may be forming but confirmation still weak.");
  } else state = "TRANSITION";

  // Confirm breakout — is it real?
  if (state === "BREAKOUT" && s.efficiency < 0.25) {
    state = "FALSE_BREAKOUT";
    notes.push("Breakout lacks path efficiency — high risk of failure.");
  }

  const strength =
    state === "STRONG_TREND"
      ? 92
      : state === "HEALTHY_TREND"
        ? 82
        : state === "PULLBACK"
          ? 74
          : state === "BREAKOUT"
            ? 78
            : state === "WEAK_TREND"
              ? 55
              : state === "EARLY_TREND"
                ? 45
                : state === "COMPRESSION"
                  ? 35
                  : state === "EXHAUSTION" || state === "DISTRIBUTION"
                    ? 40
                    : state === "REVERSAL"
                      ? 60
                      : state === "FALSE_BREAKOUT"
                        ? 60
                        : state === "MANIPULATION" || state === "NOISY"
                          ? 20
                          : 30;

  const dir = up ? "BULLISH" : down ? "BEARISH" : "NEUTRAL";
  const blockStates: MarketState[] = ["MANIPULATION", "NOISY", "FALSE_BREAKOUT", "EXHAUSTION"];
  const verdict: ReasoningModule["verdict"] = blockStates.includes(state)
    ? "BLOCK"
    : state === "REVERSAL"
      ? up
        ? "BEARISH"
        : down
          ? "BULLISH"
          : "NEUTRAL"
      : state === "PULLBACK" ||
          state === "HEALTHY_TREND" ||
          state === "STRONG_TREND" ||
          state === "BREAKOUT"
        ? (dir as ReasoningModule["verdict"])
        : "NEUTRAL";

  return {
    state,
    module: {
      name: "Market State",
      verdict,
      strength,
      headline: `Market is in ${state.replaceAll("_", " ").toLowerCase()}`,
      notes,
    },
  };
}

// ───────────────────────── Module 2: Trend reasoning ─────────────────────────
function reasonTrend(s: Snap, state: MarketState) {
  const up = s.ema20 > s.ema50 && s.ema50 > s.ema200;
  const down = s.ema20 < s.ema50 && s.ema50 < s.ema200;
  const notes: string[] = [];
  let score = 0; // -100..+100

  // Structure
  if (up) {
    score += 30;
    notes.push("EMA stack is bullish (20 > 50 > 200).");
  } else if (down) {
    score -= 30;
    notes.push("EMA stack is bearish (20 < 50 < 200).");
  } else notes.push("EMA stack is not aligned — no committed structural trend.");

  // Strength
  if (s.adx > 30) {
    score += Math.sign(score) * 15 || 0;
    notes.push(`ADX ${s.adx.toFixed(0)} indicates strong directional pressure.`);
  } else if (s.adx < 15) {
    score = Math.trunc(score * 0.6);
    notes.push(`ADX ${s.adx.toFixed(0)} — trend lacks conviction.`);
  }

  // Room / maturity
  if (state === "STRONG_TREND" || state === "HEALTHY_TREND")
    notes.push("Structure has been respected and trend appears healthy.");
  if (state === "LATE_TREND" || state === "EXHAUSTION") {
    score = Math.trunc(score * 0.3);
    notes.push("Trend appears mature — a professional wouldn't chase it here.");
  }
  if (state === "PULLBACK") notes.push("Pullback within trend — often the best re-entry zone.");
  if (state === "FALSE_BREAKOUT") {
    score = Math.trunc(-score * 0.4);
    notes.push("Breakout looks fake — trend cannot be trusted.");
  }

  score = clamp(score, -100, 100);
  const verdict: ReasoningModule["verdict"] =
    score > 25
      ? "BULLISH"
      : score < -25
        ? "BEARISH"
        : state === "MANIPULATION" || state === "NOISY"
          ? "BLOCK"
          : "NEUTRAL";

  return {
    score,
    module: {
      name: "Trend Reasoning",
      verdict,
      strength: Math.abs(score),
      headline:
        score > 25
          ? "Trend favours further upside"
          : score < -25
            ? "Trend favours further downside"
            : "Trend is undecided",
      notes,
    } satisfies ReasoningModule,
  };
}

// ───────────────────────── Module 3: Momentum reasoning ─────────────────────────
function reasonMomentum(s: Snap, trendScore: number) {
  const notes: string[] = [];
  let score = 0;

  // MACD
  if (s.macdHist > 0) {
    score += 20;
    notes.push("MACD histogram positive — bullish momentum.");
  } else if (s.macdHist < 0) {
    score -= 20;
    notes.push("MACD histogram negative — bearish momentum.");
  }

  // RSI — nuance, not overbought=sell
  if (s.rsi > 55 && s.rsi < 72) {
    score += 12;
    notes.push(`RSI ${s.rsi.toFixed(0)} — bullish but not overheated.`);
  } else if (s.rsi < 45 && s.rsi > 28) {
    score -= 12;
    notes.push(`RSI ${s.rsi.toFixed(0)} — bearish but not oversold.`);
  } else if (s.rsi >= 80) {
    notes.push(`RSI ${s.rsi.toFixed(0)} — extended, exhaustion risk.`);
    score -= 6;
  } else if (s.rsi <= 20) {
    notes.push(`RSI ${s.rsi.toFixed(0)} — extended, exhaustion risk.`);
    score += 6;
  }

  // ADX & DI balance
  if (s.adx > 22) {
    if (s.plusDI > s.minusDI) {
      score += 12;
      notes.push("DI+ dominates DI-, buyers in control.");
    } else {
      score -= 12;
      notes.push("DI- dominates DI+, sellers in control.");
    }
  }

  // Williams %R and CCI as secondary evidence
  if (s.williams > -30) {
    score += 6;
    notes.push("Williams %R signals bullish pressure.");
  } else if (s.williams < -70) {
    score -= 6;
    notes.push("Williams %R signals bearish pressure.");
  }
  if (s.cci > 100) score += 4;
  else if (s.cci < -100) score -= 4;

  // Divergence detection — trend up but momentum leaking
  const trendUp = trendScore > 25;
  const trendDown = trendScore < -25;
  if (trendUp && s.macdHist < 0 && s.rsi < 50)
    notes.push("Bearish momentum divergence against the up-trend.");
  if (trendDown && s.macdHist > 0 && s.rsi > 50)
    notes.push("Bullish momentum divergence against the down-trend.");

  score = clamp(score, -100, 100);
  const verdict: ReasoningModule["verdict"] =
    score > 20 ? "BULLISH" : score < -20 ? "BEARISH" : "NEUTRAL";
  return {
    score,
    module: {
      name: "Momentum Reasoning",
      verdict,
      strength: Math.abs(score),
      headline:
        score > 20
          ? "Momentum is accelerating upward"
          : score < -20
            ? "Momentum is accelerating downward"
            : "Momentum is flat",
      notes,
    } satisfies ReasoningModule,
  };
}

// ───────────────────────── Module 4: Volatility & Entropy ─────────────────────────
function reasonVolatility(s: Snap) {
  const notes: string[] = [];
  let quality = 60; // 0..100 how suitable for DBot

  if (s.volPct > 2.2) {
    quality = 10;
    notes.push("Volatility is explosive — price action is unreliable.");
  } else if (s.volPct > 1.5) {
    quality = 30;
    notes.push("Volatility is elevated — sudden reversals likely.");
  } else if (s.volPct < 0.15) {
    quality = 35;
    notes.push("Volatility too low — moves may not persist.");
  } else if (s.volPct >= 0.4 && s.volPct <= 1.2) {
    quality = 85;
    notes.push(`Volatility healthy (${s.volPct.toFixed(2)}%) — supportive for directional trades.`);
  } else {
    quality = 65;
    notes.push(`Volatility acceptable (${s.volPct.toFixed(2)}%).`);
  }

  // Entropy
  if (s.entropy > 0.85) {
    quality = Math.min(quality, 15);
    notes.push("Return entropy is extreme — market is chaotic.");
  } else if (s.entropy > 0.7) {
    quality = Math.min(quality, 45);
    notes.push("Return entropy high — reduce confidence.");
  } else if (s.entropy < 0.5) {
    quality = Math.min(100, quality + 8);
    notes.push("Return entropy low — price behaviour is structured.");
  }

  // Band expansion vs contraction
  if (s.bbWidth > s.bbWidthPrev * 1.15) notes.push("Bollinger bands expanding — energy releasing.");
  else if (s.bbWidth < s.bbWidthPrev * 0.85)
    notes.push("Bollinger bands contracting — energy building.");

  const verdict: ReasoningModule["verdict"] = quality < 30 ? "BLOCK" : "NEUTRAL";
  return {
    quality,
    module: {
      name: "Volatility & Entropy",
      verdict,
      strength: quality,
      headline:
        quality >= 70
          ? "Environment is suitable for directional trades"
          : quality >= 45
            ? "Environment is workable but not ideal"
            : "Environment is not suitable",
      notes,
    } satisfies ReasoningModule,
  };
}

// ───────────────────────── Module 5: Market Psychology ─────────────────────────
function reasonPsychology(p: number[], s: Snap) {
  const notes: string[] = [];
  // buying vs selling pressure
  const rets: number[] = [];
  for (let i = 1; i < p.length; i++) rets.push(p[i] - p[i - 1]);
  const win = rets.slice(-40);
  const upMag = win.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const dnMag = -win.filter((r) => r < 0).reduce((a, b) => a + b, 0);
  const total = upMag + dnMag || 1e-9;
  const buyingPressure = (upMag / total) * 100;
  const sellingPressure = (dnMag / total) * 100;

  let score = 0; // + buyers in control, - sellers in control
  score += (buyingPressure - sellingPressure) * 0.6;

  // trapped-trader / late-chaser detection
  if (s.rsi > 78 && s.bbPosition > 0.9 && buyingPressure > 65) {
    score -= 40;
    notes.push("Late buyers chasing highs — likely to be trapped.");
  }
  if (s.rsi < 22 && s.bbPosition < 0.1 && sellingPressure > 65) {
    score += 40;
    notes.push("Late sellers piling in at lows — likely to be trapped.");
  }

  // absorption / defence
  if (
    s.ema20 > s.ema50 &&
    s.bbPosition > 0.4 &&
    s.bbPosition < 0.65 &&
    sellingPressure > buyingPressure - 10
  ) {
    notes.push("Buyers absorbing supply — higher lows being defended.");
    score += 10;
  }
  if (
    s.ema20 < s.ema50 &&
    s.bbPosition > 0.35 &&
    s.bbPosition < 0.6 &&
    buyingPressure > sellingPressure - 10
  ) {
    notes.push("Sellers absorbing demand — lower highs being defended.");
    score -= 10;
  }

  // hesitation
  if (s.adx < 15) {
    notes.push("Market participants are hesitant — no clear leader.");
    score *= 0.5;
  }

  if (notes.length === 0) notes.push("No obvious crowd trap or absorption pattern.");

  score = clamp(score, -100, 100);
  const verdict: ReasoningModule["verdict"] =
    score > 20 ? "BULLISH" : score < -20 ? "BEARISH" : "NEUTRAL";

  return {
    buyingPressure,
    sellingPressure,
    score,
    module: {
      name: "Market Psychology",
      verdict,
      strength: Math.abs(score),
      headline:
        score > 20
          ? "Buyers are in control"
          : score < -20
            ? "Sellers are in control"
            : "Neither side controls the market",
      notes,
    } satisfies ReasoningModule,
  };
}

// ───────────────────────── Module 6: Scenario Simulator ─────────────────────────
function simulateScenarios(
  p: number[],
  trendScore: number,
  momentumScore: number,
  psychoScore: number,
  state: MarketState,
): {
  analysis: ScenarioAnalysis;
  virtualWinRate: number;
  expectedPersistTicks: number;
  module: ReasoningModule;
} {
  // Walk-forward win-rate for the leading direction across horizon=5.
  const leadingSide: TrendContract | "NEITHER" =
    trendScore + momentumScore + psychoScore > 20
      ? "BUY_RISE"
      : trendScore + momentumScore + psychoScore < -20
        ? "BUY_FALL"
        : "NEITHER";

  const horizon = 5;
  let wins = 0,
    total = 0,
    sumPersist = 0;
  const startIdx = Math.max(1, p.length - 220);
  if (leadingSide !== "NEITHER") {
    for (let i = startIdx; i < p.length - horizon; i++) {
      const entry = p[i];
      const exit = p[i + horizon];
      const w = leadingSide === "BUY_RISE" ? exit > entry : exit < entry;
      if (w) wins++;
      total++;
      let persist = 0;
      for (let k = 1; k <= horizon; k++) {
        const good = leadingSide === "BUY_RISE" ? p[i + k] > entry : p[i + k] < entry;
        if (good) persist++;
        else break;
      }
      sumPersist += persist;
    }
  }
  const virtualWinRate = total ? wins / total : 0.5;
  const expectedPersistTicks = total ? sumPersist / total : 0;

  // Blend indicators + walk-forward into probabilities
  let contProb = 40,
    pullbackProb = 30,
    reversalProb = 30;
  const align = clamp(Math.abs(trendScore + momentumScore + psychoScore) / 3, 0, 100);
  contProb = 30 + align * 0.5 + (virtualWinRate - 0.5) * 60;
  reversalProb = 30 - align * 0.3 + Math.max(0, 60 - virtualWinRate * 100);
  if (state === "LATE_TREND" || state === "EXHAUSTION" || state === "DISTRIBUTION") {
    contProb -= 15;
    reversalProb += 20;
  }
  if (state === "PULLBACK") {
    pullbackProb += 15;
  }
  if (state === "STRONG_TREND" || state === "HEALTHY_TREND") {
    contProb += 12;
    reversalProb -= 8;
  }
  if (state === "FALSE_BREAKOUT" || state === "REVERSAL") {
    reversalProb += 20;
    contProb -= 15;
  }

  const raw = [Math.max(1, contProb), Math.max(1, pullbackProb), Math.max(1, reversalProb)];
  const sum = raw.reduce((a, b) => a + b, 0);
  const [c, pb, rv] = raw.map((v) => Math.round((v / sum) * 100));
  // normalise final rounding
  const adjust = 100 - (c + pb + rv);
  const cN = c + adjust;

  const oppSide: TrendContract | "NEITHER" =
    leadingSide === "BUY_RISE" ? "BUY_FALL" : leadingSide === "BUY_FALL" ? "BUY_RISE" : "NEITHER";

  const scenarios: Scenario[] = [
    {
      label: "Trend continues",
      description: "Current direction extends and offers consecutive favourable ticks.",
      probability: cN,
      favours: leadingSide,
    },
    {
      label: "Shallow pullback",
      description: "Price retraces briefly before resuming direction — a re-entry may appear.",
      probability: pb,
      favours: leadingSide,
    },
    {
      label: "Full reversal",
      description: "Momentum breaks and price rotates against the current direction.",
      probability: rv,
      favours: oppSide,
    },
  ].sort((a, b) => b.probability - a.probability);

  const dominant = scenarios[0];
  const disagreement = 100 - dominant.probability; // how much the other scenarios take up

  const verdict: ReasoningModule["verdict"] =
    dominant.favours === "BUY_RISE"
      ? "BULLISH"
      : dominant.favours === "BUY_FALL"
        ? "BEARISH"
        : "NEUTRAL";

  return {
    analysis: { scenarios, dominant, disagreement },
    virtualWinRate: virtualWinRate * 100,
    expectedPersistTicks,
    module: {
      name: "Scenario Simulator",
      verdict,
      strength: dominant.probability,
      headline: `${dominant.label} — ${dominant.probability}% most likely`,
      notes: [
        `Walk-forward win rate for leading side: ${(virtualWinRate * 100).toFixed(0)}% (n=${total}).`,
        `Continuation ${cN}% · Pullback ${pb}% · Reversal ${rv}%.`,
      ],
    },
  };
}

// ───────────────────────── contradiction analysis ─────────────────────────
function detectContradictions(mods: {
  trend: number;
  momentum: number;
  psychology: number;
  state: MarketState;
  rsi: number;
  adx: number;
}): Contradiction[] {
  const c: Contradiction[] = [];
  if (
    Math.sign(mods.trend) !== Math.sign(mods.momentum) &&
    Math.abs(mods.trend) > 25 &&
    Math.abs(mods.momentum) > 25
  ) {
    c.push({
      headline: "Trend and momentum disagree.",
      resolution:
        "Momentum is a leading indicator — the analyst discounts the trend read until momentum realigns.",
      severity: "MODERATE",
    });
  }
  if (mods.state === "STRONG_TREND" && mods.rsi > 80) {
    c.push({
      headline: "Strong trend but RSI extreme.",
      resolution:
        "In a genuinely strong trend, high RSI reflects strength — not exhaustion. Retained as bullish but confidence trimmed.",
      severity: "MINOR",
    });
  }
  if (mods.state === "STRONG_TREND" && mods.rsi < 20) {
    c.push({
      headline: "Strong down-trend but RSI extreme.",
      resolution:
        "Extreme RSI in a strong down-trend reflects strength — not oversold bounce risk.",
      severity: "MINOR",
    });
  }
  if (Math.sign(mods.trend) !== Math.sign(mods.psychology) && Math.abs(mods.psychology) > 30) {
    c.push({
      headline: "Trend and crowd behaviour disagree.",
      resolution:
        "Crowd trap or absorption signal detected against the trend — reduces confidence and can flip the recommendation.",
      severity: "MODERATE",
    });
  }
  if (mods.adx < 15 && (Math.abs(mods.trend) > 30 || Math.abs(mods.momentum) > 30)) {
    c.push({
      headline: "Directional read without directional strength.",
      resolution:
        "ADX shows no conviction — the market may drift and not deliver a persistent move.",
      severity: "MODERATE",
    });
  }
  return c;
}

// ───────────────────────── adversarial debate ─────────────────────────
// Build two competing hypotheses (RISE vs FALL), weigh their arguments,
// and produce the case the analyst actually holds — plus why the loser
// was rejected. This is critical thinking, not vote-counting.
function buildDebate(
  s: Snap,
  state: MarketState,
  tr: number,
  mo: number,
  ps: number,
  vol: { quality: number },
  scenarios: ScenarioAnalysis,
  virtualWinRate: number,
  contradictions: Contradiction[],
): Debate {
  const rise: DebateArgument[] = [];
  const fall: DebateArgument[] = [];

  const push = (bag: DebateArgument[], point: string, weight: number) => {
    if (weight <= 0) return;
    bag.push({ point, weight: Math.round(clamp(weight)) });
  };

  // Structural evidence
  if (s.ema20 > s.ema50 && s.ema50 > s.ema200)
    push(rise, "EMA stack aligned bullish (20 > 50 > 200).", 22);
  if (s.ema20 < s.ema50 && s.ema50 < s.ema200)
    push(fall, "EMA stack aligned bearish (20 < 50 < 200).", 22);

  // Trend/momentum scores as evidence
  if (tr > 15)
    push(rise, `Trend reasoning reads bullish (score ${tr.toFixed(0)}).`, Math.min(30, tr * 0.5));
  if (tr < -15)
    push(
      fall,
      `Trend reasoning reads bearish (score ${Math.abs(tr).toFixed(0)}).`,
      Math.min(30, Math.abs(tr) * 0.5),
    );
  if (mo > 15)
    push(rise, `Momentum is accelerating upward (score ${mo.toFixed(0)}).`, Math.min(28, mo * 0.5));
  if (mo < -15)
    push(
      fall,
      `Momentum is fading / turning down (score ${Math.abs(mo).toFixed(0)}).`,
      Math.min(28, Math.abs(mo) * 0.5),
    );

  // DI+/DI-
  if (s.plusDI > s.minusDI + 5 && s.adx > 20)
    push(rise, `DI+ dominates DI− with ADX ${s.adx.toFixed(0)} — buyers in control.`, 15);
  if (s.minusDI > s.plusDI + 5 && s.adx > 20)
    push(fall, `DI− dominates DI+ with ADX ${s.adx.toFixed(0)} — sellers in control.`, 15);

  // MACD
  if (s.macdHist > 0) push(rise, "MACD histogram positive — momentum tilted up.", 8);
  if (s.macdHist < 0) push(fall, "MACD histogram negative — momentum tilted down.", 8);

  // Psychology (contrarian to crowd)
  if (ps > 25)
    push(
      rise,
      "Buying pressure exceeds selling pressure without exhaustion signs.",
      Math.min(20, ps * 0.4),
    );
  if (ps < -25)
    push(
      fall,
      "Selling pressure exceeds buying pressure without exhaustion signs.",
      Math.min(20, Math.abs(ps) * 0.4),
    );

  // Exhaustion / trap counter-arguments
  if (state === "EXHAUSTION" || state === "LATE_TREND") {
    push(
      fall,
      `${state.replaceAll("_", " ").toLowerCase()} — chasers likely to be trapped if long.`,
      20,
    );
    push(rise, `${state.replaceAll("_", " ").toLowerCase()} — countering fresh longs.`, 0);
  }
  if (state === "DISTRIBUTION")
    push(fall, "Distribution — up-trend appears to be handing supply to buyers.", 18);
  if (state === "ACCUMULATION")
    push(rise, "Accumulation — down-move appears to be absorbed by buyers.", 15);
  if (state === "PULLBACK" && tr > 0)
    push(rise, "Pullback inside an up-trend — a re-entry window rather than a reversal.", 14);
  if (state === "PULLBACK" && tr < 0)
    push(fall, "Bounce inside a down-trend — a re-entry window rather than a reversal.", 14);
  if (state === "FALSE_BREAKOUT") {
    push(fall, "False breakout structure — favours a fade of the initial thrust.", 15);
    push(rise, "False breakout structure — countering fresh longs.", 0);
  }

  // Environment / entropy
  if (vol.quality < 40) {
    push(rise, "Environment quality poor — reduces conviction on both sides.", 0);
    push(fall, "Environment quality poor — reduces conviction on both sides.", 0);
  }
  if (s.entropy > 0.75) {
    // No side wins in high entropy — record as a shared counter.
    push(rise, `Entropy elevated (${s.entropy.toFixed(2)}) — direction likely to whipsaw.`, 0);
    push(fall, `Entropy elevated (${s.entropy.toFixed(2)}) — direction likely to whipsaw.`, 0);
  }

  // Scenario simulator
  const cont = scenarios.scenarios.find((x) => x.label === "Trend continues");
  if (cont && cont.favours === "BUY_RISE")
    push(rise, `Scenario model: continuation up ${cont.probability}%.`, cont.probability * 0.35);
  if (cont && cont.favours === "BUY_FALL")
    push(fall, `Scenario model: continuation down ${cont.probability}%.`, cont.probability * 0.35);
  const rev = scenarios.scenarios.find((x) => x.label === "Full reversal");
  if (rev && rev.favours === "BUY_RISE")
    push(rise, `Reversal scenario favours a bounce (${rev.probability}%).`, rev.probability * 0.25);
  if (rev && rev.favours === "BUY_FALL")
    push(
      fall,
      `Reversal scenario favours a rollover (${rev.probability}%).`,
      rev.probability * 0.25,
    );

  // Walk-forward evidence
  if (virtualWinRate >= 55) {
    const bag = tr + mo + ps >= 0 ? rise : fall;
    push(
      bag,
      `Walk-forward simulation win-rate ${virtualWinRate.toFixed(0)}% on the leading side.`,
      (virtualWinRate - 50) * 1.2,
    );
  } else if (virtualWinRate <= 45) {
    push(
      rise,
      `Walk-forward simulation weak (${virtualWinRate.toFixed(0)}%) — historical similarity does not endorse either side.`,
      0,
    );
    push(
      fall,
      `Walk-forward simulation weak (${virtualWinRate.toFixed(0)}%) — historical similarity does not endorse either side.`,
      0,
    );
  }

  const riseW = rise.reduce((a, b) => a + b.weight, 0);
  const fallW = fall.reduce((a, b) => a + b.weight, 0);
  const total = riseW + fallW || 1;
  const edge = Math.round((Math.abs(riseW - fallW) / total) * 100);

  let winner: TrendContract | "NEITHER" = "NEITHER";
  if (riseW - fallW > 12) winner = "BUY_RISE";
  else if (fallW - riseW > 12) winner = "BUY_FALL";

  const loserBag = winner === "BUY_RISE" ? fall : winner === "BUY_FALL" ? rise : [];
  const strongestLoser = loserBag.slice().sort((a, b) => b.weight - a.weight)[0];

  let rejection: string;
  if (winner === "NEITHER") {
    rejection = `Neither case defends itself convincingly — rise weight ${riseW}, fall weight ${fallW}. Trader B and Trader A both leave holes; waiting is the honest verdict.`;
  } else if (!strongestLoser || strongestLoser.weight < 10) {
    rejection = `The opposing case has no argument above ${strongestLoser?.weight ?? 0}/100 — nothing on that side survives cross-examination.`;
  } else {
    const sev = contradictions.find((c) => c.severity !== "MINOR");
    rejection = sev
      ? `Strongest counter — "${strongestLoser.point}" — was weighed against "${sev.headline}" and set aside because ${sev.resolution.toLowerCase()}`
      : `Strongest counter — "${strongestLoser.point}" — is real but outweighed ${winner === "BUY_RISE" ? riseW : fallW} to ${winner === "BUY_RISE" ? fallW : riseW}. Kept as a stop-condition rather than a reason to fade.`;
  }

  const synthesis =
    winner === "NEITHER"
      ? `Case for Rise = ${riseW}, case for Fall = ${fallW}. The analyst does not commit.`
      : `Case for ${winner === "BUY_RISE" ? "Rise" : "Fall"} outweighs the other side ${winner === "BUY_RISE" ? riseW : fallW} to ${winner === "BUY_RISE" ? fallW : riseW} (edge ${edge}).`;

  return {
    winner,
    edge,
    risePoints: rise.filter((r) => r.weight > 0).sort((a, b) => b.weight - a.weight),
    fallPoints: fall.filter((r) => r.weight > 0).sort((a, b) => b.weight - a.weight),
    rejection,
    synthesis,
  };
}

// ───────────────────────── timing ─────────────────────────
function decideTiming(
  state: MarketState,
  contradictions: Contradiction[],
  persistSec: number,
  minPersist: number,
): EntryTiming {
  const severe = contradictions.some((c) => c.severity === "SEVERE");
  if (severe) return "WAIT_FOR_CONFIRMATION";
  if (state === "COMPRESSION") return "WAIT_FOR_BREAKOUT";
  if (state === "PULLBACK") return "WAIT_FOR_CONFIRMATION";
  if (state === "FALSE_BREAKOUT") return "WAIT_FOR_REJECTION";
  if (state === "EXHAUSTION" || state === "LATE_TREND") return "WAIT";
  if (state === "NOISY" || state === "MANIPULATION") return "WAIT";
  if (state === "REVERSAL") return "WAIT_FOR_CONFIRMATION";
  if (state === "EARLY_TREND" || state === "TRANSITION") return "WAIT_FOR_CONFIRMATION";
  if (persistSec < minPersist) return "WAIT";
  return "ENTER_NOW";
}

// ───────────────────────── main entry ─────────────────────────
export function analyseMarketTrend(
  market: string,
  name: string,
  ticks: Tick[],
  settings: TrendSettings = DEFAULT_TREND_SETTINGS,
): MarketReport {
  const mem = memoryOf(market);
  const p = ticks.map((t) => t.price);
  const lastPrice = p[p.length - 1] ?? 0;

  if (p.length < 60) {
    return placeholder(
      market,
      name,
      ticks.length,
      lastPrice,
      `Need ${settings.minTicks} ticks (have ${ticks.length})`,
    );
  }

  // ── indicator snap
  const ema20 = ema(p, 20),
    ema50 = ema(p, 50),
    ema200 = ema(p, 200);
  const bb = bollinger(p, 20, 2);
  const bbPrev = bollinger(p.slice(0, -20), 20, 2);
  const md = macd(p);
  const rs = rsi(p, 14);
  const ax = adxSuite(p, 14);
  const wr = williamsR(p, 14);
  const cc = cci(p, 20);
  const rets: number[] = [];
  for (let i = 1; i < p.length; i++) rets.push(Math.log(p[i] / p[i - 1]));
  const volPct = stdev(rets.slice(-30)) * 100;
  const avgAbs = rets.reduce((a, b) => a + Math.abs(b), 0) / rets.length || 1e-9;
  const zeros = rets.filter((r) => Math.abs(r) < avgAbs * 0.1).length / rets.length;
  const spikes = rets.filter((r) => Math.abs(r) > avgAbs * 4).length / rets.length;
  const manipulation = clamp(zeros * 60 + spikes * 200);
  const entropy = shannonEntropy(rets.slice(-120));

  const win60 = p.slice(-60);
  const win120 = p.slice(-120);
  const ret60 = win60.length > 1 ? win60[win60.length - 1] - win60[0] : 0;
  const ret120 = win120.length > 1 ? win120[win120.length - 1] - win120[0] : 0;
  const path = win60.slice(1).reduce((a, v, i) => a + Math.abs(v - win60[i]), 0) || 1e-9;
  const efficiency = Math.abs(ret60) / path;

  const s: Snap = {
    ema20,
    ema50,
    ema200,
    rsi: rs,
    macdHist: md.hist,
    adx: ax.adx,
    plusDI: ax.plusDI,
    minusDI: ax.minusDI,
    bbWidth: bb.width,
    bbWidthPrev: bbPrev.width,
    bbPosition: bb.position,
    volPct,
    manipulation,
    entropy,
    cci: cc,
    williams: wr,
    ret60,
    ret120,
    efficiency: clamp01(efficiency),
  };

  // ── modules
  const st = reasonState(p, s, mem);
  mem.stateHistory.push(st.state);
  if (mem.stateHistory.length > 25) mem.stateHistory.shift();
  const tr = reasonTrend(s, st.state);
  const mo = reasonMomentum(s, tr.score);
  const vo = reasonVolatility(s);
  const ps = reasonPsychology(p, s);
  const sc = simulateScenarios(p, tr.score, mo.score, ps.score, st.state);

  // ── contradictions
  const contradictions = detectContradictions({
    trend: tr.score,
    momentum: mo.score,
    psychology: ps.score,
    state: st.state,
    rsi: s.rsi,
    adx: s.adx,
  });

  // ── side & confidence
  const rawSide: TrendContract | "NEITHER" =
    tr.score + mo.score + ps.score > 20
      ? "BUY_RISE"
      : tr.score + mo.score + ps.score < -20
        ? "BUY_FALL"
        : "NEITHER";

  const modAgreeSide = (side: TrendContract) => {
    const want: ReasoningModule["verdict"] = side === "BUY_RISE" ? "BULLISH" : "BEARISH";
    return [tr.module.verdict, mo.module.verdict, ps.module.verdict, sc.module.verdict].filter(
      (v) => v === want,
    ).length;
  };

  const blocked =
    st.module.verdict === "BLOCK" ||
    vo.module.verdict === "BLOCK" ||
    st.state === "MANIPULATION" ||
    st.state === "NOISY" ||
    st.state === "FALSE_BREAKOUT";

  // Confidence is EARNED. Start low, grow only when all modules align.
  let confidence = 40;
  if (rawSide !== "NEITHER") {
    const agree = modAgreeSide(rawSide);
    confidence = 30 + agree * 10; // up to +40 for 4 agreeing modules
    confidence += vo.quality * 0.15; // +0..15 for good environment
    confidence += (sc.analysis.dominant.probability - 33) * 0.4; // rewarded when one scenario dominates
    confidence += Math.min(15, Math.abs(tr.score + mo.score + ps.score) / 12);
    // penalise contradictions
    for (const c of contradictions) {
      confidence -= c.severity === "SEVERE" ? 25 : c.severity === "MODERATE" ? 10 : 3;
    }
    // penalise entropy
    if (s.entropy > 0.75) confidence -= 10;
    // reward alignment with dominant scenario
    if (sc.analysis.dominant.favours === rawSide) confidence += 6;
    else if (sc.analysis.dominant.favours !== "NEITHER") confidence -= 12;
  }
  confidence = clamp(confidence, 0, 100);

  // ── persistence
  const tickIntervalMs =
    ticks.length >= 2 ? Math.max(200, ticks[ticks.length - 1].t - ticks[ticks.length - 2].t) : 1000;
  const expectedPersistSec = Math.round((sc.expectedPersistTicks * tickIntervalMs) / 1000);

  // ── timing
  const timing = blocked
    ? "WAIT"
    : decideTiming(st.state, contradictions, expectedPersistSec, settings.minPersistenceSeconds);

  // ── strictness gate
  const strictnessBoost =
    settings.strictness === "STRICT" ? 8 : settings.strictness === "AGGRESSIVE" ? -8 : 0;
  const gate = settings.minConfidence + strictnessBoost;

  // ── final recommendation
  let recommendation: TrendContract | "NO_TRADE" = "NO_TRADE";
  let reason = "Evidence insufficient — market mind prefers waiting.";
  if (blocked) reason = `Environment unsuitable (${st.state.replaceAll("_", " ").toLowerCase()}).`;
  else if (rawSide === "NEITHER") reason = "Modules disagree — no committed direction.";
  else if (confidence < gate)
    reason = `Confidence ${confidence.toFixed(0)} below threshold ${gate}.`;
  else if (timing !== "ENTER_NOW")
    reason = `Setup forming — ${timing.replaceAll("_", " ").toLowerCase()}.`;
  else if (sc.virtualWinRate < 52)
    reason = `Walk-forward win rate ${sc.virtualWinRate.toFixed(0)}% too low for confident entry.`;
  else {
    recommendation = rawSide;
    reason = `${rawSide === "BUY_RISE" ? "BUY RISE" : "BUY FALL"} — ${st.state.replaceAll("_", " ").toLowerCase()} with aligned modules.`;
  }

  // ── consecutive DBot entries (0–6)
  let suggestedConsecutive = 0;
  if (recommendation !== "NO_TRADE") {
    // strong = 5, healthy = 4, pullback continuation = 4, weak trend = 3, early = 2
    if (st.state === "STRONG_TREND" && confidence >= 82) suggestedConsecutive = 5;
    else if ((st.state === "HEALTHY_TREND" || st.state === "PULLBACK") && confidence >= 75)
      suggestedConsecutive = 4;
    else if (st.state === "BREAKOUT" && confidence >= 75) suggestedConsecutive = 4;
    else if (st.state === "WEAK_TREND" || st.state === "EARLY_TREND") suggestedConsecutive = 2;
    else suggestedConsecutive = 3;
    if (contradictions.some((c) => c.severity !== "MINOR"))
      suggestedConsecutive = Math.max(1, suggestedConsecutive - 1);
  }

  // ── caution
  let caution: string | null = null;
  if (recommendation !== "NO_TRADE") {
    if (st.state === "LATE_TREND" || confidence < gate + 8)
      caution = "Conditions may deteriorate quickly — re-evaluate after every entry.";
    else if (contradictions.length > 0)
      caution = "Minor contradictions detected — reduce size or entries if momentum weakens.";
    else if (sc.analysis.disagreement > 55)
      caution =
        "Alternative scenarios still material — one contract may be safer than a full sequence.";
  }

  // ── analyst-style paragraph
  const dir =
    recommendation === "BUY_RISE"
      ? "BUY RISE"
      : recommendation === "BUY_FALL"
        ? "BUY FALL"
        : "NO TRADE";
  const analystNote = buildAnalystNote(
    dir,
    name,
    st,
    tr.module,
    mo.module,
    vo.module,
    ps.module,
    sc.analysis,
    suggestedConsecutive,
  );

  // ── score for market ranking (0–100)
  const opportunityScore = clamp(
    0.45 * confidence +
      0.15 * sc.virtualWinRate +
      0.15 * vo.quality +
      0.15 * sc.analysis.dominant.probability +
      0.1 * (100 - contradictions.length * 20),
  );

  const mind: MarketMindReport = {
    state: st.state,
    timing,
    recommendation,
    confidence,
    score: opportunityScore,
    reason,
    analystNote,
    suggestedConsecutiveEntries: suggestedConsecutive,
    expectedPersistenceSeconds: expectedPersistSec,
    caution,
    modules: {
      state: st.module,
      trend: tr.module,
      momentum: mo.module,
      volatility: vo.module,
      psychology: ps.module,
      scenario: sc.module,
    },
    scenarios: sc.analysis,
    contradictions,
    debate: buildDebate(
      s,
      st.state,
      tr.score,
      mo.score,
      ps.score,
      { quality: vo.quality },
      sc.analysis,
      sc.virtualWinRate,
      contradictions,
    ),
    telemetry: {
      trendScore: tr.score,
      momentumScore: mo.score,
      volatilityQuality: vo.quality,
      psychologyScore: ps.score,
      entropy: s.entropy,
      virtualWinRate: sc.virtualWinRate,
      continuationProbability:
        sc.analysis.scenarios.find((x) => x.label === "Trend continues")?.probability ?? 0,
      reversalProbability:
        sc.analysis.scenarios.find((x) => x.label === "Full reversal")?.probability ?? 0,
      buyingPressure: ps.buyingPressure,
      sellingPressure: ps.sellingPressure,
    },
  };

  // memory
  if (recommendation !== "NO_TRADE") {
    if (mem.lastRecommendation !== recommendation) {
      mem.lastRecommendation = recommendation;
      mem.persistence = 1;
    } else mem.persistence++;
  } else {
    mem.lastRecommendation = "NO_TRADE";
    mem.persistence = 0;
  }

  return { market, name, ticks: ticks.length, lastPrice, mind, opportunityScore };
}

function buildAnalystNote(
  dir: string,
  name: string,
  st: { state: MarketState; module: ReasoningModule },
  tr: ReasoningModule,
  mo: ReasoningModule,
  vo: ReasoningModule,
  ps: ReasoningModule,
  scenarios: ScenarioAnalysis,
  consecutive: number,
): string {
  if (dir === "NO TRADE") {
    return `The Market Mind Engine sees ${name} in ${st.state.replaceAll("_", " ").toLowerCase()}. ${st.module.notes[0] ?? ""} ${mo.headline}. ${vo.headline}. Waiting is the correct decision until the picture clarifies.`;
  }
  const dominant = scenarios.dominant;
  const risk = scenarios.scenarios.find((s) => s.label === "Full reversal")?.probability ?? 0;
  const seq =
    consecutive >= 4
      ? `Current conditions appear suitable for a short sequence of DBot ${dir === "BUY RISE" ? "Rise" : "Fall"} entries (roughly ${consecutive}).`
      : consecutive >= 2
        ? `Conditions justify a small sequence of ${consecutive} DBot entries — re-evaluate after each.`
        : `Only a single, higher-risk trade appears justified — do not queue a long DBot sequence.`;
  return `${dir} — ${name}. The Market Mind Engine identifies a ${st.state.replaceAll("_", " ").toLowerCase()}. ${tr.headline}, ${mo.headline.toLowerCase()}, and ${vo.headline.toLowerCase()}. ${ps.headline}. Scenario analysis indicates ${dominant.label.toLowerCase()} is the most likely outcome at ${dominant.probability}%, while full reversal risk sits at ${risk}%. ${seq} Reassess if momentum weakens or volatility becomes erratic.`;
}

function placeholder(
  market: string,
  name: string,
  ticks: number,
  lastPrice: number,
  reason: string,
): MarketReport {
  const emptyModule = (n: string): ReasoningModule => ({
    name: n,
    verdict: "NEUTRAL",
    strength: 0,
    headline: "Insufficient data",
    notes: [],
  });
  const mind: MarketMindReport = {
    state: "TRANSITION",
    timing: "WAIT",
    recommendation: "NO_TRADE",
    confidence: 0,
    score: 0,
    reason,
    analystNote: reason,
    suggestedConsecutiveEntries: 0,
    expectedPersistenceSeconds: 0,
    caution: null,
    modules: {
      state: emptyModule("Market State"),
      trend: emptyModule("Trend Reasoning"),
      momentum: emptyModule("Momentum Reasoning"),
      volatility: emptyModule("Volatility & Entropy"),
      psychology: emptyModule("Market Psychology"),
      scenario: emptyModule("Scenario Simulator"),
    },
    scenarios: {
      scenarios: [
        { label: "Trend continues", description: "-", probability: 33, favours: "NEITHER" },
        { label: "Shallow pullback", description: "-", probability: 33, favours: "NEITHER" },
        { label: "Full reversal", description: "-", probability: 34, favours: "NEITHER" },
      ],
      dominant: { label: "Trend continues", description: "-", probability: 33, favours: "NEITHER" },
      disagreement: 67,
    },
    contradictions: [],
    debate: {
      winner: "NEITHER",
      edge: 0,
      risePoints: [],
      fallPoints: [],
      rejection: reason,
      synthesis: reason,
    },
    telemetry: {
      trendScore: 0,
      momentumScore: 0,
      volatilityQuality: 0,
      psychologyScore: 0,
      entropy: 0,
      virtualWinRate: 50,
      continuationProbability: 33,
      reversalProbability: 34,
      buyingPressure: 50,
      sellingPressure: 50,
    },
  };
  return { market, name, ticks, lastPrice, mind, opportunityScore: 0 };
}
