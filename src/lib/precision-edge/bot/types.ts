// Shared data contracts for the bot signal layer. Kept separate from
// signal.ts so core types can import them without pulling in logic.
import type { BotSignalConfig } from "./config";
import type { EquilibriumReading } from "./equilibrium";
import type { SimResult } from "./simulator";
import type { QualityMetrics } from "./quality";
import type { BurstForecast } from "./burst";
import type { Veto } from "./veto";
import type { BotState } from "./state-tracker";
import type { BotBarrier, BotDirection, BotLeg, BotVerdict } from "./spec";
import type { SetupState } from "../types";

/** Everything engines are given so they can score the BOT, not a generic edge. */
export interface BotEvidence {
  config: BotSignalConfig;
  /** Digits of the canonical window, oldest → newest. */
  digits: number[];
  equilibrium: EquilibriumReading;
  sims: SimResult[];
  canonicalSim: SimResult | null;
  burst: BurstForecast;
  state: BotState;
  /** Live 6-tick trigger reading. */
  trigger: { direction: BotDirection; highPct: number; lowPct: number; samples: number };
  /** Empirical win rate per bot barrier over the canonical window. */
  barrierEmpirical: Record<BotBarrier, number>;
  calibration: number;
}

export interface BotInstructions {
  symbol: string;
  marketName: string;
  contractType: "DIGITOVER" | "DIGITUNDER" | "NONE";
  contractLabel: string;
  barrier: BotBarrier | null;
  durationTicks: number;
  ticksAnalyzed: number;
  thresholdPct: number;
  martingaleFactor: number;
  waitTicks: number;
  stakeMultiple: number;
  action: string;
}

/**
 * Compact, per-market "why not ready" summary. Derived from the veto stack and
 * the equilibrium reading so a watchlist row can explain itself without
 * re-deriving any gate.
 */
export interface BotReadiness {
  /** True only for a fully confirmed BOT_ON verdict. */
  ready: boolean;
  /** Ticks still required to complete the canonical window. */
  ticksNeeded: number;
  /** 0-1 progress towards the canonical window. */
  windowProgress: number;
  /** How far outside the tolerance band equilibrium sits, in pp. 0 when inside. */
  equilibriumGapPp: number;
  /** Short human reasons, strongest first. Empty when ready. */
  blockers: string[];
  /** The single most important blocking reason, or null when ready. */
  primaryBlocker: string | null;
}

export interface BotSignal {
  market: string;
  timestamp: number;
  verdict: BotVerdict;
  /** Side the bot will trade when it fires. */
  direction: BotDirection;
  leg: BotLeg;
  barrier: BotBarrier | null;
  /** 0-100 bot fitness — fused engine score, equilibrium-gated. */
  fitness: number;
  /** 0-100 confidence, discounted by calibration reliability and tick count. */
  confidence: number;
  equilibrium: EquilibriumReading;
  sims: SimResult[];
  canonicalSim: SimResult | null;
  burst: BurstForecast;
  vetoes: Veto[];
  blocked: boolean;
  state: BotState;
  /** Lifecycle of the bot-armed setup (existing SetupState machine). */
  setupState: SetupState;
  barrierEmpirical: Record<BotBarrier, number>;
  calibration: number;
  ticks: number;
  /** Operator quality metrics: edge, manipulation, fluctuation, persistence. */
  quality: QualityMetrics;
  readiness: BotReadiness;
  instructions: BotInstructions;
  narrative: { headline: string; why: string[]; risk: string[]; action: string };
}
