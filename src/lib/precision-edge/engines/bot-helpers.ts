// Shared helpers for bot-retargeted engines.
// Every engine's score now answers ONE question: "how favourable is this for
// Precision_Percentage_Bot_V6_CONTINUOUS_SAFE_FIXED_v4?" — 100 = ideal, 0 = it
// will bleed here. Each engine additionally publishes its verdict for the bot:
// contribution to OVER, to UNDER and to VETO.
import type { EngineContext, EngineScore } from "../types";

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}

export interface BotVerdictContribution {
  /** 0-100 support for an OVER entry. */
  over: number;
  /** 0-100 support for an UNDER entry. */
  under: number;
  /** 0-100 pressure to block the bot entirely. */
  veto: number;
}

/** Flattens a contribution into the `features` map every engine publishes. */
export function withVerdict(
  features: Record<string, number | string | boolean>,
  v: BotVerdictContribution,
): Record<string, number | string | boolean> {
  return {
    ...features,
    botOver: clamp(v.over),
    botUnder: clamp(v.under),
    botVeto: clamp(v.veto),
  };
}

/** Engine result used when the bot evidence bundle is unavailable. */
export function neutralScore(name: string, ctx: EngineContext, reason: string): EngineScore {
  return {
    name,
    score: 50,
    weight: ctx.config.engineWeights[name] ?? 0,
    features: withVerdict({ evidence: false }, { over: 0, under: 0, veto: 0 }),
    reasons: [reason],
  };
}

/** Share of digits in `set` — used all over the barrier maths. */
export function shareOf(digits: number[], pred: (d: number) => boolean): number {
  if (!digits.length) return 0;
  return digits.filter(pred).length / digits.length;
}

/** How close a measured share is to its theoretical value, as a 0-100 score. */
export function closeness(measured: number, theory: number, tolerance: number): number {
  return clamp(100 * (1 - Math.abs(measured - theory) / Math.max(1e-9, tolerance)));
}
