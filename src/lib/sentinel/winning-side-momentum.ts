// SENTINEL — WINNING-SIDE DIGIT MOMENTUM.
//
// The symmetric counterpart to LOSING_SIDE_PRESSURE. Every digit that can
// make a contract WIN is watched for rising momentum (reusing
// DigitProfile.momentum, which already existed but wasn't consumed this
// way). The whole winning side is aggregated into ONE named, bounded
// ranking modifier: WINNING_SIDE_MOMENTUM.
//
// Unlike the losing-side module, this one is reward-only by design: it can
// never penalize a contract, only confirm it when the winning digits are
// themselves gaining ground. "When winning digits are gaining, we go that
// direction" — there is no SUPPRESS-style verdict here, because a quiet or
// even declining winning side is not itself a danger signal (that's what
// LOSING_SIDE_PRESSURE is for).
import type { DigitIntel } from "@/lib/apex/digit-intel";

export type WinningSideMomentumState = "FLAT" | "BUILDING" | "SURGING";

export interface WinningSideContributor {
  digit: number;
  /** −100..100 raw momentum from DigitProfile.momentum. */
  momentum: number;
  rising: boolean;
}

export interface WinningSideMomentum {
  /** 0..100 aggregate winning-side momentum (positive contributions only). */
  index: number;
  state: WinningSideMomentumState;
  /** Bounded, reward-only ranking modifier: 1..MAX_MODIFIER. Never < 1. */
  modifier: number;
  /** Points added to a 0..100 opportunity score by this modifier. */
  bonusPoints: number;
  /** How many winning digits are simultaneously gaining. */
  risingCount: number;
  /** Winning digits ordered strongest-momentum-first. */
  contributors: WinningSideContributor[];
  reason: string;
}

/** Hard bound — reward-only, so the floor is always exactly 1. */
export const WINNING_SIDE_MAX_MODIFIER = 1.06;

/** Momentum threshold above which a digit counts as "rising" — matches the
 *  threshold digitIntelligence() itself uses for its `increasing` ranking. */
const RISING_MOMENTUM_THRESHOLD = 4;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function stateOf(index: number): WinningSideMomentumState {
  if (index >= 55) return "SURGING";
  if (index >= 25) return "BUILDING";
  return "FLAT";
}

/**
 * Aggregate the whole winning side into a single bounded, reward-only
 * modifier. Pure function of already-computed digit intelligence.
 */
export function winningSideMomentum(
  intel: DigitIntel | null,
  winners: number[],
): WinningSideMomentum {
  if (!intel || winners.length === 0) {
    return {
      index: 0,
      state: "FLAT",
      modifier: 1,
      bonusPoints: 0,
      risingCount: 0,
      contributors: [],
      reason: "No winning-side telemetry available — modifier neutral.",
    };
  }

  const contributors: WinningSideContributor[] = winners
    .map((d) => intel.profiles[d])
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      digit: p.digit,
      momentum: p.momentum,
      rising: p.momentum > RISING_MOMENTUM_THRESHOLD,
    }))
    .sort((a, b) => b.momentum - a.momentum);

  const risingCount = contributors.filter((c) => c.rising).length;

  // Only positive momentum can ever contribute — a winning side that is
  // losing momentum should not be rewarded, but it must not be penalized
  // here either (that would just be LOSING_SIDE_PRESSURE by another name).
  const positive = contributors.map((c) => Math.max(0, c.momentum));
  const best = positive[0] ?? 0;
  const mean = positive.length ? positive.reduce((a, b) => a + b, 0) / positive.length : 0;
  const breadth = (risingCount / Math.max(1, winners.length)) * 100;

  const index = clamp(best * 0.45 + mean * 0.35 + breadth * 0.2, 0, 100);

  const modifier = clamp(
    1 + (index / 100) * (WINNING_SIDE_MAX_MODIFIER - 1),
    1,
    WINNING_SIDE_MAX_MODIFIER,
  );

  const state = stateOf(index);
  const top = contributors
    .slice(0, 3)
    .map((c) => `${c.digit} (${c.momentum.toFixed(0)}${c.rising ? "↑" : ""})`);
  const reason =
    `WINNING_SIDE_MOMENTUM ${index.toFixed(0)}/100 (${state}) — ` +
    `${risingCount}/${winners.length} winning digits rising, ` +
    `best ${top.join(", ") || "none"}. Ranking modifier ×${modifier.toFixed(3)} ` +
    `(reward-only, capped ${WINNING_SIDE_MAX_MODIFIER}).`;

  return {
    index,
    state,
    modifier,
    bonusPoints: 0,
    risingCount,
    contributors,
    reason,
  };
}

/** Apply the bounded, reward-only modifier to an opportunity score. */
export function applyWinningSideMomentum(
  opportunity: number,
  momentum: WinningSideMomentum,
): { opportunity: number; momentum: WinningSideMomentum } {
  const next = clamp(opportunity * momentum.modifier, 0, 100);
  return {
    opportunity: next,
    momentum: { ...momentum, bonusPoints: Number((next - opportunity).toFixed(2)) },
  };
}
