// Precision Edge V3.5 — Hypothesis Engine (Stage One of the reasoning pipeline).
//
// The engine no longer evaluates contracts first. It first asks:
//
//     "What is the market TRYING to do right now?"
//
// This module generates a small set of COMPETING hypotheses about the market's
// current psychological state, scores each from the existing engine outputs
// (digit statistics, psychology, behaviour, memory / historical agreement,
// personality, fluctuation), and returns the dominant hypothesis PLUS all
// challengers so the Analyst can weigh competing explanations before selecting
// a contract.
//
// This is ADDITIVE: no existing engine is replaced. Every existing module
// continues to run and continues to feed evidence. What changes is that
// contract verdicts now emerge FROM a surviving hypothesis instead of being
// checked independently.
//
// The hypotheses:
//   COMPRESSING_BELOW_7    Market capped beneath 7 (UNDER family).
//   BOUNCING_FROM_FLOOR    Digits 0-2 exhausted, rotating upward (OVER family).
//   ROTATING_UPWARD        General migration into 5-9 without a clean floor bounce.
//   ROTATING_DOWNWARD      General migration into 0-4 without a clean ceiling cap.
//   TRANSITIONAL           Historical windows disagree; direction unresolved.
//   HIGH_FLUCTUATION       Two digits contest structural bars across zones.
//   MANIPULATION           Distribution anomaly high (manipulation ≥ threshold).
//   BALANCED               Near-uniform distribution; no directional edge.

import type { ContractId, DigitStatistics, MarketPsychology, TraderBehaviour } from "./types";

export type HypothesisId =
  | "COMPRESSING_BELOW_7"
  | "BOUNCING_FROM_FLOOR"
  | "ROTATING_UPWARD"
  | "ROTATING_DOWNWARD"
  | "TRANSITIONAL"
  | "HIGH_FLUCTUATION"
  | "MANIPULATION"
  | "BALANCED";

export interface MarketHypothesis {
  id: HypothesisId;
  label: string;
  /** Confidence in this explanation of the market, 0..1. */
  strength: number;
  /** Short narrative — supports the Analyst's story. */
  narrative: string;
  /** Contracts that align with this hypothesis (may be empty for non-directional ones). */
  favours: ContractId[];
  /** Contracts that oppose this hypothesis. */
  opposes: ContractId[];
  /** Evidence bullets — plain language, cited from live metrics. */
  evidence: string[];
}

interface HypothesisContext {
  stats: DigitStatistics;
  psy: MarketPsychology;
  beh: TraderBehaviour;
  historical: number; // 0..1
  fluctuation: number; // 0..1
  disputedBars: number; // count from Psychology of Numbers
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const pctS = (x: number) => `${(x * 100).toFixed(1)}%`;

// ── Individual hypothesis scorers ────────────────────────────────────────
// Every scorer returns 0..1. High = market currently fits that description.

function scoreCompressingBelow7(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { stats, psy, beh } = ctx;
  const evidence: string[] = [];
  // Digits 0-6 dominate distribution.
  const zoneUnder = [0, 1, 2, 3, 4, 5, 6].reduce((a, d) => a + stats.pct[d], 0);
  const zoneOver = 1 - zoneUnder;
  // Digit 9 exhausted and decreasing (ceiling exhaustion).
  const d9 = stats.profiles[9];
  const d8 = stats.profiles[8];
  const ceilingExhausted =
    (d9.pct >= 0.11 && d9.pressure <= 0.005) || (d8.pct >= 0.11 && d8.pressure <= 0.005);
  // Under group gaining pressure.
  const underGaining = beh.underPressure > beh.overPressure;
  // Manipulation acceptable.
  const clean = psy.manipulation < 30;

  let s = 0;
  if (zoneUnder >= 0.72) {
    s += 0.35;
    evidence.push(`0-6 share ${pctS(zoneUnder)} vs 7-9 ${pctS(zoneOver)}.`);
  } else if (zoneUnder >= 0.68) {
    s += 0.2;
    evidence.push(`0-6 marginally dominant (${pctS(zoneUnder)}).`);
  }
  if (ceilingExhausted) {
    s += 0.25;
    evidence.push(`Ceiling exhausted — d${d9.pct >= 0.11 ? 9 : 8} elevated and releasing.`);
  }
  if (underGaining) {
    s += 0.2;
    evidence.push(
      `Under group absorbing pressure (${beh.underPressure.toFixed(2)} > ${beh.overPressure.toFixed(2)}).`,
    );
  }
  if (clean) {
    s += 0.1;
    evidence.push(`Manipulation ${psy.manipulation.toFixed(0)}% acceptable.`);
  }
  if (psy.zoneA >= 0.55) {
    s += 0.1;
    evidence.push(`Zone A (0-4) share ${pctS(psy.zoneA)}.`);
  }

  return { score: clamp01(s), evidence };
}

function scoreBouncingFromFloor(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { stats, psy, beh } = ctx;
  const evidence: string[] = [];
  // Digits 0-2 elevated AND decreasing (floor spent).
  const floor = [0, 1, 2];
  const floorPct = floor.reduce((a, d) => a + stats.pct[d], 0);
  const floorReleasing = floor.filter((d) => stats.profiles[d].pressure <= 0.005).length;
  const upperBuilding = [7, 8, 9].filter((d) => stats.profiles[d].pressure >= 0).length;
  const zoneOver = 1 - psy.zoneA;
  const overGaining = beh.overPressure > beh.underPressure;

  let s = 0;
  if (floorPct >= 0.32) {
    s += 0.2;
    evidence.push(`Floor 0-2 elevated (${pctS(floorPct)}).`);
  }
  if (floorReleasing >= 2) {
    s += 0.3;
    evidence.push(`${floorReleasing}/3 floor digits releasing pressure.`);
  }
  if (upperBuilding >= 2) {
    s += 0.15;
    evidence.push(`${upperBuilding}/3 upper digits (7-9) quietly building.`);
  }
  if (overGaining) {
    s += 0.2;
    evidence.push(`Over group absorbing pressure (${beh.overPressure.toFixed(2)}).`);
  }
  if (zoneOver >= 0.5) {
    s += 0.1;
    evidence.push(`Zone B (5-9) share ${pctS(zoneOver)}.`);
  }
  if (psy.manipulation < 30) {
    s += 0.05;
  }

  return { score: clamp01(s), evidence };
}

function scoreRotatingUpward(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { stats, beh } = ctx;
  const evidence: string[] = [];
  // Broad upward pressure without a specific floor-bounce signature.
  const upperPressure = [5, 6, 7, 8, 9].reduce((a, d) => a + stats.profiles[d].pressure, 0);
  const lowerPressure = [0, 1, 2, 3, 4].reduce((a, d) => a + stats.profiles[d].pressure, 0);
  const delta = upperPressure - lowerPressure;
  let s = 0;
  if (delta > 0.02) {
    s += Math.min(0.5, delta * 8);
    evidence.push(`Upper-zone pressure exceeds lower by ${delta.toFixed(3)}.`);
  }
  if (beh.overPressure > 0) {
    s += 0.2;
    evidence.push(`Over-group pressure positive.`);
  }
  if (beh.dominantGroup.includes("Over")) {
    s += 0.2;
    evidence.push(`Dominant group: ${beh.dominantGroup}.`);
  }
  return { score: clamp01(s), evidence };
}

function scoreRotatingDownward(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { stats, beh } = ctx;
  const evidence: string[] = [];
  const upperPressure = [5, 6, 7, 8, 9].reduce((a, d) => a + stats.profiles[d].pressure, 0);
  const lowerPressure = [0, 1, 2, 3, 4].reduce((a, d) => a + stats.profiles[d].pressure, 0);
  const delta = lowerPressure - upperPressure;
  let s = 0;
  if (delta > 0.02) {
    s += Math.min(0.5, delta * 8);
    evidence.push(`Lower-zone pressure exceeds upper by ${delta.toFixed(3)}.`);
  }
  if (beh.underPressure > 0) {
    s += 0.2;
    evidence.push(`Under-group pressure positive.`);
  }
  if (beh.dominantGroup.includes("Under")) {
    s += 0.2;
    evidence.push(`Dominant group: ${beh.dominantGroup}.`);
  }
  return { score: clamp01(s), evidence };
}

function scoreTransitional(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { historical, beh } = ctx;
  const evidence: string[] = [];
  let s = 0;
  if (historical < 0.5) {
    s += 0.5;
    evidence.push(`Historical windows disagree (${(historical * 100).toFixed(0)}%).`);
  } else if (historical < 0.6) {
    s += 0.25;
    evidence.push(`Historical agreement weak (${(historical * 100).toFixed(0)}%).`);
  }
  const conflict = Math.abs(beh.overPressure - beh.underPressure) < 0.01;
  if (conflict) {
    s += 0.3;
    evidence.push(`Trader groups roughly balanced — no dominant flow.`);
  }
  return { score: clamp01(s), evidence };
}

function scoreHighFluctuation(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const evidence: string[] = [];
  let s = 0;
  if (ctx.fluctuation > 0.5) {
    s += Math.min(0.6, ctx.fluctuation);
    evidence.push(`Fluctuation ${(ctx.fluctuation * 100).toFixed(0)}%.`);
  }
  if (ctx.disputedBars > 0) {
    s += Math.min(0.4, ctx.disputedBars * 0.25);
    evidence.push(
      `${ctx.disputedBars} scanner bar${ctx.disputedBars === 1 ? "" : "s"} contested across zones.`,
    );
  }
  return { score: clamp01(s), evidence };
}

function scoreManipulation(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { psy } = ctx;
  const evidence: string[] = [];
  let s = 0;
  if (psy.manipulation >= 30) {
    s = clamp01((psy.manipulation - 20) / 40);
    evidence.push(`Distribution anomaly ${psy.manipulation.toFixed(0)}%.`);
  } else if (psy.manipulation >= 22) {
    s = 0.35;
    evidence.push(`Manipulation elevated (${psy.manipulation.toFixed(0)}%).`);
  }
  if (psy.crowding >= 55) {
    s = Math.max(s, 0.55);
    evidence.push(`Single-digit crowding ${psy.crowding.toFixed(0)}%.`);
  }
  return { score: clamp01(s), evidence };
}

function scoreBalanced(ctx: HypothesisContext): {
  score: number;
  evidence: string[];
} {
  const { psy } = ctx;
  const evidence: string[] = [];
  // High entropy AND low pressure imbalance.
  let s = 0;
  if (psy.entropyNorm >= 0.98) {
    s += 0.5;
    evidence.push(`Entropy near maximum (${psy.entropyNorm.toFixed(3)}).`);
  } else if (psy.entropyNorm >= 0.96) {
    s += 0.25;
  }
  if (psy.manipulation < 15) {
    s += 0.3;
    evidence.push(`Manipulation low (${psy.manipulation.toFixed(0)}%).`);
  }
  return { score: clamp01(s), evidence };
}

// ── Contract alignment (which contract each hypothesis favours) ──────────

const CONTRACT_ALIGNMENT: Record<HypothesisId, { favours: ContractId[]; opposes: ContractId[] }> = {
  COMPRESSING_BELOW_7: {
    favours: ["UNDER6", "UNDER7", "UNDER8"],
    opposes: ["OVER1", "OVER2", "OVER3"],
  },
  BOUNCING_FROM_FLOOR: {
    favours: ["OVER1", "OVER2", "OVER3"],
    opposes: ["UNDER6", "UNDER7", "UNDER8"],
  },
  ROTATING_UPWARD: {
    favours: ["OVER2", "OVER3"],
    opposes: ["UNDER6", "UNDER7"],
  },
  ROTATING_DOWNWARD: {
    favours: ["UNDER6", "UNDER7"],
    opposes: ["OVER2", "OVER3"],
  },
  TRANSITIONAL: { favours: [], opposes: [] },
  HIGH_FLUCTUATION: { favours: [], opposes: [] },
  MANIPULATION: { favours: [], opposes: [] },
  BALANCED: { favours: [], opposes: [] },
};

const LABEL: Record<HypothesisId, string> = {
  COMPRESSING_BELOW_7: "Market compressing beneath 7",
  BOUNCING_FROM_FLOOR: "Market bouncing from the floor",
  ROTATING_UPWARD: "Probability rotating upward",
  ROTATING_DOWNWARD: "Probability rotating downward",
  TRANSITIONAL: "Transitional market",
  HIGH_FLUCTUATION: "High fluctuation",
  MANIPULATION: "Manipulation suspected",
  BALANCED: "Balanced distribution",
};

// ── Public API ───────────────────────────────────────────────────────────

export interface HypothesisSet {
  /** Highest-strength hypothesis — anchors the Analyst's story. */
  dominant: MarketHypothesis;
  /** All hypotheses sorted by strength (dominant first). */
  ranked: MarketHypothesis[];
  /** Blocking hypothesis when the dominant explanation forbids any contract. */
  blocking: MarketHypothesis | null;
}

export function generateHypotheses(input: HypothesisContext): HypothesisSet {
  const scorers: {
    id: HypothesisId;
    fn: (c: HypothesisContext) => { score: number; evidence: string[] };
  }[] = [
    { id: "COMPRESSING_BELOW_7", fn: scoreCompressingBelow7 },
    { id: "BOUNCING_FROM_FLOOR", fn: scoreBouncingFromFloor },
    { id: "ROTATING_UPWARD", fn: scoreRotatingUpward },
    { id: "ROTATING_DOWNWARD", fn: scoreRotatingDownward },
    { id: "TRANSITIONAL", fn: scoreTransitional },
    { id: "HIGH_FLUCTUATION", fn: scoreHighFluctuation },
    { id: "MANIPULATION", fn: scoreManipulation },
    { id: "BALANCED", fn: scoreBalanced },
  ];

  const ranked: MarketHypothesis[] = scorers.map(({ id, fn }) => {
    const { score, evidence } = fn(input);
    const align = CONTRACT_ALIGNMENT[id];
    return {
      id,
      label: LABEL[id],
      strength: score,
      favours: align.favours,
      opposes: align.opposes,
      evidence,
      narrative: buildNarrative(id, score, evidence),
    };
  });

  ranked.sort((a, b) => b.strength - a.strength);
  const dominant = ranked[0];

  // Blocking hypotheses veto any directional contract when clearly dominant.
  const blocking =
    (dominant.id === "MANIPULATION" && dominant.strength >= 0.55) ||
    (dominant.id === "HIGH_FLUCTUATION" && dominant.strength >= 0.75)
      ? dominant
      : null;

  return { dominant, ranked, blocking };
}

function buildNarrative(id: HypothesisId, score: number, evidence: string[]): string {
  const tier =
    score >= 0.75
      ? "strongly indicates"
      : score >= 0.55
        ? "indicates"
        : score >= 0.35
          ? "hints at"
          : "weakly suggests";
  const base = `Market ${tier} the "${LABEL[id]}" state`;
  return evidence.length ? `${base}: ${evidence.slice(0, 3).join(" ")}` : `${base}.`;
}

/**
 * How much a given contract aligns with the dominant hypothesis, -1..+1.
 * +1 = favoured  ·  0 = neutral  ·  -1 = opposed.
 * Weighted by hypothesis strength so weak hypotheses have small influence.
 */
export function hypothesisAlignment(
  hypotheses: HypothesisSet,
  contract: ContractId,
): { score: number; label: string; dominant: MarketHypothesis } {
  const d = hypotheses.dominant;
  if (d.favours.includes(contract)) {
    return {
      score: +d.strength,
      label: `Dominant hypothesis favours ${contract}`,
      dominant: d,
    };
  }
  if (d.opposes.includes(contract)) {
    return {
      score: -d.strength,
      label: `Dominant hypothesis opposes ${contract}`,
      dominant: d,
    };
  }
  // Non-directional dominant hypothesis — check second-strongest.
  const second = hypotheses.ranked[1];
  if (second) {
    if (second.favours.includes(contract)) {
      return {
        score: +second.strength * 0.5,
        label: `Secondary hypothesis favours ${contract}`,
        dominant: d,
      };
    }
    if (second.opposes.includes(contract)) {
      return {
        score: -second.strength * 0.5,
        label: `Secondary hypothesis opposes ${contract}`,
        dominant: d,
      };
    }
  }
  return { score: 0, label: `Dominant hypothesis is neutral on ${contract}`, dominant: d };
}
