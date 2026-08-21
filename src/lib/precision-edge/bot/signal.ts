// Builds the BotEvidence bundle every engine consumes, then the final BotSignal.
import { digit } from "../rolling-store";
import type { Tick } from "../types";
import {
  BOT_SPEC,
  barrierFor,
  botTrigger,
  digitWins,
  legFor,
  type BotBarrier,
  type BotVerdict,
} from "./spec";
import { DEFAULT_BOT_CONFIG, type BotSignalConfig } from "./config";
import { readEquilibrium } from "./equilibrium";
import { simulateWindows, type SimResult } from "./simulator";
import { forecastBurst } from "./burst";
import { buildVetoStack, hasBlock, type Veto } from "./veto";
import { calibrationReliability, getBotState } from "./state-tracker";
import type { BotEvidence, BotInstructions, BotReadiness, BotSignal } from "./types";
import type { SetupState } from "../types";
import { botNarrative } from "./narrative";
import { computeQuality } from "./quality";
import { describeEdgeBalance, type EdgeBalanceReading } from "./edges";

const BOT_BARRIERS: BotBarrier[] = [2, 3, 6, 7];

export function digitsOf(ticks: Tick[]): number[] {
  return ticks.map((t) => digit(t.price));
}

/** Empirical win rate of each bot barrier over a digit window. */
export function barrierWinRates(digits: number[]): Record<BotBarrier, number> {
  const out = {} as Record<BotBarrier, number>;
  for (const b of BOT_BARRIERS) {
    const dir = b <= 3 ? "OVER" : "UNDER";
    out[b] = digits.length ? digits.filter((d) => digitWins(d, dir, b)).length / digits.length : 0;
  }
  return out;
}

export function buildBotEvidence(
  market: string,
  ticks: Tick[],
  cfg: BotSignalConfig = DEFAULT_BOT_CONFIG,
  now = Date.now(),
): BotEvidence {
  const allDigits = digitsOf(ticks);
  const canonical = allDigits.slice(-cfg.canonicalWindow);
  const state = getBotState();
  const equilibrium = readEquilibrium(market, allDigits, cfg, now);
  const sims = simulateWindows(allDigits, cfg.simWindows, { startCountLoss: state.countLoss });
  const canonicalSim =
    sims.find((s) => s.window === cfg.canonicalWindow) ?? sims[sims.length - 1] ?? null;
  const burst = forecastBurst(allDigits, canonical);
  const trigger = botTrigger(allDigits);

  return {
    config: cfg,
    digits: canonical,
    equilibrium,
    sims,
    canonicalSim,
    burst,
    state,
    trigger: {
      direction: trigger.direction,
      highPct: trigger.highPct,
      lowPct: trigger.lowPct,
      samples: trigger.samples,
    },
    barrierEmpirical: barrierWinRates(canonical),
    calibration: calibrationReliability(),
  };
}

export interface BuildSignalArgs {
  market: string;
  marketName: string;
  evidence: BotEvidence;
  /** Fused engine score 0-100 (all engines already bot-retargeted). */
  fitness: number;
  totalTicks: number;
  timestamp?: number;
  /** Lifecycle of the bot-armed setup. BOT_ON needs confirmed|strengthening. */
  setupState?: SetupState;
}

export function buildBotSignal(args: BuildSignalArgs): BotSignal {
  const { evidence: ev, fitness, totalTicks } = args;
  const cfg = ev.config;

  const quality = computeQuality(ev.digits, ev.equilibrium, ev.canonicalSim, cfg);

  const vetoes = buildVetoStack({
    cfg,
    equilibrium: ev.equilibrium,
    canonicalSim: ev.canonicalSim,
    burst: ev.burst,
    countLoss: ev.state.countLoss,
    barrierEmpirical: ev.barrierEmpirical,
    calibration: ev.calibration,
    ticks: totalTicks,
    quality,
  });
  const blocked = hasBlock(vetoes);

  const leg = legFor(ev.state.countLoss);
  const direction = ev.trigger.direction !== "WAIT" ? ev.trigger.direction : ev.burst.side;
  const barrier = direction === "WAIT" ? null : barrierFor(direction, leg);

  // Confidence: fitness discounted by calibration reliability and by how much
  // of the canonical window we actually hold. Never inflate.
  const tickFactor = Math.max(0.2, Math.min(1, totalTicks / cfg.minTicksFullConfidence));
  const calFactor = 0.6 + 0.4 * ev.calibration;
  const simFactor = ev.canonicalSim
    ? Math.max(0.5, Math.min(1.1, ev.canonicalSim.winRate / Math.max(0.01, cfg.minSimWinRate)))
    : 0.6;
  const confidence = clamp(fitness * tickFactor * calFactor * Math.min(1, simFactor));

  const verdict = decideVerdict({
    cfg,
    blocked,
    fitness,
    equilibriumScore: ev.equilibrium.score,
    simWinRate: ev.canonicalSim?.winRate ?? 0,
    triggerLive: ev.trigger.direction !== "WAIT",
    band: ev.equilibrium.band,
    setupState: args.setupState ?? "confirmed",
    ticks: totalTicks,
    equilibriumError: ev.equilibrium.error,
    edgeImbalancePp: quality.edgeBalance.imbalancePp,
    edgeBalanceScore: quality.edgeBalance.score,
  });

  const instructions: BotInstructions = {
    symbol: args.market,
    marketName: args.marketName,
    contractType:
      direction === "OVER" ? "DIGITOVER" : direction === "UNDER" ? "DIGITUNDER" : "NONE",
    contractLabel:
      barrier === null
        ? "No contract — bot waits"
        : `${direction === "OVER" ? "Over" : "Under"} ${barrier}`,
    barrier,
    durationTicks: 1,
    ticksAnalyzed: BOT_SPEC.ticksAnalyzed,
    thresholdPct: BOT_SPEC.highPctThreshold,
    martingaleFactor: BOT_SPEC.martingaleFactor,
    waitTicks: BOT_SPEC.waitTicks,
    stakeMultiple: ev.state.stakeMultiple,
    action:
      verdict === "BOT_ON"
        ? "Run the bot now on this market."
        : verdict === "BOT_STANDBY"
          ? "Keep the bot loaded but paused — conditions are close, not confirmed."
          : "Stop the bot on this market.",
  };

  const readiness = buildReadiness({
    verdict,
    vetoes,
    cfg,
    ticks: totalTicks,
    equilibriumError: ev.equilibrium.error,
    fitness,
    simWinRate: ev.canonicalSim?.winRate ?? 0,
    triggerLive: ev.trigger.direction !== "WAIT",
    setupState: args.setupState ?? "confirmed",
    edgeBalance: quality.edgeBalance,
  });

  const signal: BotSignal = {
    market: args.market,
    timestamp: args.timestamp ?? Date.now(),
    verdict,
    direction,
    leg,
    barrier,
    fitness,
    confidence,
    equilibrium: ev.equilibrium,
    sims: ev.sims,
    canonicalSim: ev.canonicalSim,
    burst: ev.burst,
    vetoes,
    blocked,
    state: ev.state,
    setupState: args.setupState ?? "emerging",
    barrierEmpirical: ev.barrierEmpirical,
    calibration: ev.calibration,
    ticks: totalTicks,
    quality,
    readiness,
    instructions,
    narrative: { headline: "", why: [], risk: [], action: instructions.action },
  };
  signal.narrative = botNarrative(signal, args.marketName);
  return signal;
}

/**
 * Per-market readiness summary. Purely derived — it never changes a verdict,
 * it only explains one so a watchlist row can show what is being waited on.
 */
function buildReadiness(a: {
  verdict: BotVerdict;
  vetoes: Veto[];
  cfg: BotSignalConfig;
  ticks: number;
  equilibriumError: number;
  fitness: number;
  simWinRate: number;
  triggerLive: boolean;
  setupState: SetupState;
  edgeBalance: EdgeBalanceReading;
}): BotReadiness {
  const ticksNeeded = Math.max(0, a.cfg.canonicalWindow - a.ticks);
  const windowProgress = Math.max(0, Math.min(1, a.ticks / Math.max(1, a.cfg.canonicalWindow)));
  const gap = Math.max(0, a.equilibriumError - a.cfg.maxEquilibriumError);

  if (a.verdict === "BOT_ON") {
    return {
      ready: true,
      ticksNeeded,
      windowProgress,
      equilibriumGapPp: 0,
      blockers: [],
      primaryBlocker: null,
    };
  }

  const blockers: string[] = [];
  if (ticksNeeded > 0)
    blockers.push(`${ticksNeeded} more ticks needed (${a.ticks}/${a.cfg.canonicalWindow})`);
  if (gap > 0) {
    blockers.push(
      `Equilibrium off by ${a.equilibriumError.toFixed(2)}pp — ${gap.toFixed(2)}pp outside the ±${a.cfg.maxEquilibriumError.toFixed(2)}pp band`,
    );
  }
  if (a.edgeBalance.imbalancePp > a.cfg.maxEdgeImbalance) {
    blockers.push(
      `${describeEdgeBalance(a.edgeBalance)} — outside your ±${a.cfg.maxEdgeImbalance.toFixed(1)}pp edge-balance tolerance`,
    );
  }
  for (const v of a.vetoes) {
    if (v.severity !== "BLOCK") continue;
    if (v.id === "insufficientTicks" || v.id === "equilibriumOffCentre") continue;
    blockers.push(`${v.title}: ${v.detail}`);
  }
  if (a.simWinRate < a.cfg.minSimWinRate) {
    blockers.push(
      `Simulated win rate ${(a.simWinRate * 100).toFixed(1)}% below the ${(a.cfg.minSimWinRate * 100).toFixed(1)}% floor`,
    );
  }
  if (a.fitness < a.cfg.recommendationThreshold) {
    blockers.push(
      `Fitness ${a.fitness.toFixed(0)} below the ${a.cfg.recommendationThreshold} threshold`,
    );
  }
  if (!a.triggerLive) blockers.push("Bot's 6-tick trigger is not live yet");
  if (a.setupState !== "confirmed" && a.setupState !== "strengthening") {
    blockers.push(`Setup is ${a.setupState}, not confirmed`);
  }
  if (!blockers.length) blockers.push("Waiting for confirmation");

  return {
    ready: false,
    ticksNeeded,
    windowProgress,
    equilibriumGapPp: gap,
    blockers,
    primaryBlocker: blockers[0] ?? null,
  };
}

/**
 * THE THREE PRIMARY PARAMETERS.
 *
 *   1. EQUILIBRIUM      — Over 4 / Under 5 sits at 50% ± tolerance over the
 *                         canonical 1000-tick window.
 *   2. BALANCED EDGES   — the 0/1 edge and the 8/9 edge sit on top of each
 *                         other within tolerance.
 *   3. SENSITIVE-DIGIT  — none of the five sensitive colour roles (green bar,
 *      PURITY             2nd green, red bar, 2nd red, most-increasing) is
 *                         being carried by a barrier digit 2, 3, 6 or 7.
 *
 * All three must hold for BOT_ON. Everything else — fitness, simulation, the
 * setup lifecycle — can only downgrade a signal that already satisfies them,
 * it can never substitute for one of the three.
 */
function decideVerdict(a: {
  cfg: BotSignalConfig;
  blocked: boolean;
  fitness: number;
  equilibriumScore: number;
  simWinRate: number;
  triggerLive: boolean;
  band: string;
  setupState: SetupState;
  ticks: number;
  equilibriumError: number;
  edgeImbalancePp: number;
  edgeBalanceScore: number;
}): BotVerdict {
  if (a.blocked) return "BOT_OFF";
  if (a.ticks < a.cfg.canonicalWindow) return "BOT_OFF";

  // ── PARAMETER 1: EQUILIBRIUM ────────────────────────────────────────────
  const equilibriumOk =
    a.equilibriumError <= a.cfg.maxEquilibriumError &&
    a.equilibriumScore >= a.cfg.minEquilibriumScore;
  if (!equilibriumOk) return "BOT_OFF";

  // ── PARAMETER 2: BALANCED EDGES (0,1 vs 8,9) ────────────────────────────
  const edgesOk =
    a.edgeImbalancePp <= a.cfg.maxEdgeImbalance && a.edgeBalanceScore >= a.cfg.minEdgeBalanceScore;
  if (!edgesOk) return "BOT_OFF";

  // ── Supporting evidence: can only downgrade, never promote ──────────────
  const stateOk = a.setupState === "confirmed" || a.setupState === "strengthening";
  const ticksOk = a.ticks >= Math.max(a.cfg.minTicksFullConfidence, a.cfg.canonicalWindow);
  const simOk = a.simWinRate >= a.cfg.minSimWinRate;

  if (a.fitness >= a.cfg.recommendationThreshold) {
    return stateOk && ticksOk && simOk ? "BOT_ON" : "BOT_STANDBY";
  }
  if (a.fitness >= a.cfg.recommendationThreshold - 12) return "BOT_STANDBY";
  return "BOT_OFF";
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

export function bestSimResult(sims: SimResult[], window: number): SimResult | null {
  return sims.find((s) => s.window === window) ?? null;
}
