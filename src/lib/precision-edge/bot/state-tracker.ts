// BOT STATE TRACKER — mirrors the bot's own variables so the app knows which
// leg the bot is in (fresh vs recovery) and therefore which barrier it will
// actually trade next. Also tracks live signal outcomes for calibration.
import { BOT_SPEC, legFor, type BotLeg } from "./spec";

export interface BotState {
  /** Bot's CountLoss variable. 0 = fresh leg. */
  countLoss: number;
  leg: BotLeg;
  /** Stake multiple the bot would use next: 1.5 ^ countLoss. */
  stakeMultiple: number;
  /** Session tally, in base-stake units, entered manually or by logging. */
  sessionPnl: number;
  wins: number;
  losses: number;
  updatedAt: number;
}

export interface CalibrationBucket {
  /** Confidence bucket lower edge, e.g. 70 for 70-80. */
  bucket: number;
  predicted: number;
  observed: number;
  samples: number;
}

const initial: BotState = {
  countLoss: 0,
  leg: "fresh",
  stakeMultiple: 1,
  sessionPnl: 0,
  wins: 0,
  losses: 0,
  updatedAt: Date.now(),
};

let state: BotState = { ...initial };
const listeners = new Set<(s: BotState) => void>();

// Confidence → outcome log, used for the calibration readout.
const calibration = new Map<number, { hits: number; total: number; sumConf: number }>();

function emit() {
  state = {
    ...state,
    leg: legFor(state.countLoss),
    stakeMultiple: Math.pow(BOT_SPEC.martingaleFactor, Math.max(0, state.countLoss)),
    updatedAt: Date.now(),
  };
  for (const l of listeners) l(state);
}

export function getBotState(): BotState {
  return state;
}

export function subscribeBotState(fn: (s: BotState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function setCountLoss(countLoss: number) {
  state.countLoss = Math.max(0, Math.floor(countLoss));
  emit();
}

/** Report a real bot outcome. Mirrors the bot's own CountLoss arithmetic. */
export function reportBotOutcome(win: boolean, confidence?: number) {
  if (win) {
    state.sessionPnl += state.stakeMultiple * 0.4;
    state.wins++;
    state.countLoss = 0;
  } else {
    state.sessionPnl -= state.stakeMultiple;
    state.losses++;
    state.countLoss++;
  }
  if (confidence !== undefined) recordCalibration(confidence, win);
  emit();
}

export function resetBotState() {
  state = { ...initial, updatedAt: Date.now() };
  calibration.clear();
  emit();
}

export function recordCalibration(confidence: number, win: boolean) {
  const bucket = Math.max(0, Math.min(90, Math.floor(confidence / 10) * 10));
  const cur = calibration.get(bucket) ?? { hits: 0, total: 0, sumConf: 0 };
  cur.total++;
  cur.sumConf += confidence;
  if (win) cur.hits++;
  calibration.set(bucket, cur);
}

export function calibrationBuckets(): CalibrationBucket[] {
  return [...calibration.entries()]
    .map(([bucket, c]) => ({
      bucket,
      predicted: c.sumConf / Math.max(1, c.total) / 100,
      observed: c.hits / Math.max(1, c.total),
      samples: c.total,
    }))
    .sort((a, b) => a.bucket - b.bucket);
}

/**
 * Reliability 0-1: how well stated confidence has matched observed outcomes.
 * Falls back to a sample-count ramp while the log is still thin, so the system
 * openly reports "not yet calibrated" instead of faking certainty.
 */
export function calibrationReliability(): number {
  const buckets = calibrationBuckets();
  const samples = buckets.reduce((a, b) => a + b.samples, 0);
  if (samples < 20) return samples / 60; // ramps to 0.33 at 20 samples
  const err =
    buckets.reduce((a, b) => a + Math.abs(b.predicted - b.observed) * b.samples, 0) / samples;
  return Math.max(0, Math.min(1, 1 - err * 2));
}
