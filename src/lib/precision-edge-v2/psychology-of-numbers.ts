// Precision Edge V4 — Market Psychology Engine (Demand Zone Philosophy).
//
// Philosophy (updated per operator specification):
//   The engine evaluates the five structural bar positions against a strict
//   parity and zone rule set. Every rule is a hard requirement — a single
//   violation is enough to reject the hypothesis.
//
// UNDER trades — required bar structure:
//   • Green  (most appearing)       → MUST be an ODD digit (1,3,5,7,9 preferred 3,5,7).
//                                     Digit 9 is a losing digit; only valid if ≥10.5%
//                                     AND pressure ≤ 0 (releasing/decreasing).
//   • Yellow / Blue (2nd most)      → MUST be in the winning zone.
//   • Red   (least appearing)       → MUST be an EVEN digit in the winning zone (0,2,4,6).
//                                     NEVER digit 8.
//   • Light-Red (2nd least)         → MUST be in the winning zone.
//   • Purple (fastest growing)      → MUST be in the winning zone.
//   • Digit 9                       → MUST be ≥ 10.5% AND pressure ≤ 0 (decreasing).
//
// OVER trades — required bar structure:
//   • Green  (most appearing)       → MUST be an EVEN digit (0,2,4,6,8 preferred 2,4,6).
//                                     Digit 0 is a losing digit; only valid if ≥10.5%
//                                     AND pressure ≤ 0 (releasing/decreasing).
//   • Yellow / Blue (2nd most)      → MUST be in the winning zone.
//   • Red   (least appearing)       → MUST be an ODD digit in the winning zone (3,5,7,9).
//                                     NEVER digit 1.
//   • Light-Red (2nd least)         → MUST be in the winning zone.
//   • Purple (fastest growing)      → MUST be in the winning zone.
//   • Digit 0                       → MUST be ≥ 10.5% AND pressure ≤ 0 (decreasing).

import type { ContractVerdict, DigitStatistics } from "./types";

// ── Tunable configuration ────────────────────────────────────────────────
export interface PsychologyConfig {
  /** Anchor / boundary-digit "elevated" threshold. */
  anchorExhaustionPct: number;
  /** Pressure ceiling that still counts as "flat or decreasing". */
  anchorReleasePressure: number;
  /** Winning-side "room-to-grow" cap. */
  winningRoomCapPct: number;
  /** Digit-competition tolerance for identifying disputed ranks. */
  competitionEpsilon: number;
  /** Max losing-zone bars allowed before immediate rejection. */
  maxLosingBars: number;
}

export const PSYCHOLOGY_CONFIG: PsychologyConfig = {
  anchorExhaustionPct: 0.105,
  anchorReleasePressure: 0.005,
  winningRoomCapPct: 0.1,
  competitionEpsilon: 0.003,
  maxLosingBars: 2,
};

export interface PsychologyBars {
  green: number;
  yellow: number;
  red: number;
  lightRed: number;
  purple: number | null;
}

export type PsychologyOutcome = "accept" | "watch" | "reject";

export interface PsychologyReview {
  outcome: PsychologyOutcome;
  bars: PsychologyBars;
  narrative: string;
  reason?: string;
  confidenceAdjust: number;
}

/** Rank digits and identify the four psychological bars plus Purple. */
export function readPsychology(stats: DigitStatistics): PsychologyBars {
  const byFreq = [...stats.pct.keys()].sort((a, b) => stats.pct[b] - stats.pct[a]);
  const green = byFreq[0];
  const yellow = byFreq[1];
  const red = byFreq[byFreq.length - 1];
  const lightRed = byFreq[byFreq.length - 2];
  let purple: number | null = null;
  let best = 0.005;
  for (const p of stats.profiles) {
    if (p.pressure > best) {
      best = p.pressure;
      purple = p.d;
    }
  }
  return { green, yellow, red, lightRed, purple };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : ""}${pct(x)}`;

/** Zone classification for a given contract. */
function classifyZones(v: ContractVerdict) {
  const winners = new Set<number>();
  const losers = new Set<number>();
  for (let d = 0; d < 10; d++) {
    if (v.side === "OVER" ? d > v.barrier : d < v.barrier) winners.add(d);
    else losers.add(d);
  }
  return { winners, losers };
}

/** Sum of profile.pressure across a digit set. */
function collectivePressure(stats: DigitStatistics, set: Set<number>) {
  let s = 0;
  for (const d of set) s += stats.profiles[d].pressure;
  return s;
}

/**
 * Review a contract verdict through the Demand Zone psychology lens.
 * All laws are hard requirements. Any single violation returns "reject".
 */
export function psychologyReview(v: ContractVerdict, stats: DigitStatistics): PsychologyReview {
  const cfg = PSYCHOLOGY_CONFIG;
  const bars = readPsychology(stats);
  const { winners, losers } = classifyZones(v);

  const winPressure = collectivePressure(stats, winners);
  const losePressure = collectivePressure(stats, losers);
  const rotationTowardWinners = winPressure > losePressure;

  const barList: Array<{ name: string; digit: number | null }> = [
    { name: "Green", digit: bars.green },
    { name: "Yellow", digit: bars.yellow },
    { name: "Red", digit: bars.red },
    { name: "Light-Red", digit: bars.lightRed },
    { name: "Purple", digit: bars.purple },
  ];

  // ── LAW 1: Demand Zone Rule — ≥3 bars inside the losing zone → REJECT ──
  const losingBars = barList.filter((b) => b.digit !== null && losers.has(b.digit));
  if (losingBars.length > cfg.maxLosingBars) {
    return {
      outcome: "reject",
      bars,
      narrative:
        `Demand collapse against ${v.label} — ${losingBars.length} scanner bars ` +
        `(${losingBars.map((b) => `${b.name} d${b.digit}`).join(", ")}) sit inside the losing zone. ` +
        `Probability is accumulating on the wrong side; this contract has no coherent psychological story.`,
      reason: `${losingBars.length} of 5 bars in losing zone (max ${cfg.maxLosingBars}).`,
      confidenceAdjust: 0,
    };
  }

  // ── LAW 2: Red / Light-Red must live in the winning zone ──────────────
  if (losers.has(bars.red)) {
    return {
      outcome: "reject",
      bars,
      narrative:
        `Red d${bars.red} sits inside the losing zone. The market has already abandoned this losing digit — ` +
        `probability is more likely to rotate back than to stay away. ${v.label} carries a hidden return risk.`,
      reason: `Red Bar d${bars.red} is a losing digit — return-to-mean risk.`,
      confidenceAdjust: 0,
    };
  }
  if (losers.has(bars.lightRed)) {
    return {
      outcome: "reject",
      bars,
      narrative:
        `Light-Red d${bars.lightRed} is a losing digit — weakness is concentrated where the contract needs the market NOT to return. ` +
        `Two losing digits already look "spent"; ${v.label} is exposed to their rebound.`,
      reason: `Light-Red Bar d${bars.lightRed} is a losing digit.`,
      confidenceAdjust: 0,
    };
  }

  // ── LAW 3: Yellow must live in the winning zone ───────────────────────
  if (losers.has(bars.yellow)) {
    return {
      outcome: "reject",
      bars,
      narrative:
        `Yellow d${bars.yellow} confirms demand on the losing side. The market's second-strongest anchor opposes ${v.label}; ` +
        `the psychological centre is not aligned with this hypothesis.`,
      reason: `Yellow Bar d${bars.yellow} belongs to the losing zone of ${v.label}.`,
      confidenceAdjust: 0,
    };
  }

  // ── LAW 4: Green Bar — winning zone, or conditionally-valid boundary ──
  // Refinement (V7.1): near-threshold Green cases return "watch" so the
  // Chief Analyst can weigh them against the full evidence stack instead of
  // hard-rejecting on one borderline reading. Structural violations remain
  // hard rejects.
  const greenProfile = stats.profiles[bars.green];
  let greenClause = "";
  if (losers.has(bars.green)) {
    const elevated = greenProfile.pct >= cfg.anchorExhaustionPct;
    const nearElevated = greenProfile.pct >= cfg.anchorExhaustionPct - 0.015;
    const releasing = greenProfile.pressure <= cfg.anchorReleasePressure;
    const nearReleasing = greenProfile.pressure <= cfg.anchorReleasePressure + 0.005;
    if (!elevated && !nearElevated) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Green d${bars.green} sits in the losing zone at only ${pct(greenProfile.pct)} — absence is not exhaustion. ` +
          `Probability has not yet been spent there; ${v.label} is premature.`,
        reason: `Green d${bars.green} is a losing digit and below ${pct(cfg.anchorExhaustionPct)} exhaustion threshold.`,
        confidenceAdjust: 0,
      };
    }
    if (!elevated) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Green d${bars.green} in losing zone at ${pct(greenProfile.pct)} — just under the ${pct(cfg.anchorExhaustionPct)} ` +
          `exhaustion line. Structure is nearly ripe; Chief will weigh surrounding evidence before publishing ${v.label}.`,
        reason: `Green d${bars.green} borderline exhaustion (${pct(greenProfile.pct)}).`,
        confidenceAdjust: -8,
      };
    }
    if (!releasing && !nearReleasing) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Green d${bars.green} is a losing digit still gaining pressure (${signed(greenProfile.pressure)}). ` +
          `The losing zone is loading, not exhausting — probability is NOT rotating toward ${v.label} yet.`,
        reason: `Green d${bars.green} in losing zone; pressure ${signed(greenProfile.pressure)} (must be ≤ ${signed(cfg.anchorReleasePressure)}).`,
        confidenceAdjust: 0,
      };
    }
    if (!releasing) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Green d${bars.green} exhausted, pressure only just above the release line (${signed(greenProfile.pressure)}). ` +
          `Chief will confirm rotation from adjacent evidence before publishing ${v.label}.`,
        reason: `Green d${bars.green} pressure borderline (${signed(greenProfile.pressure)}).`,
        confidenceAdjust: -6,
      };
    }
    if (!rotationTowardWinners) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Green d${bars.green} looks exhausted but the winning zone is not absorbing what leaves it ` +
          `(winners ${signed(winPressure)} vs losers ${signed(losePressure)}). No rotation, no signal.`,
        reason: `Green d${bars.green} exhausting but rotation not toward winners.`,
        confidenceAdjust: 0,
      };
    }
    greenClause =
      `Boundary exhausted — Green d${bars.green} at ${pct(greenProfile.pct)} is releasing (${signed(greenProfile.pressure)}) ` +
      `while probability rotates into the winning zone (winners ${signed(winPressure)}).`;
  } else {
    greenClause = `Green d${bars.green} anchors demand inside the winning zone (${pct(greenProfile.pct)}).`;
  }

  // ── LAW 5: Purple — fastest-growing demand MUST be in winning zone ────
  // Per operator specification: Purple is a hard requirement — any losing
  // purple is an immediate rejection, regardless of pressure magnitude.
  let purpleClause: string | null = null;
  let purpleAdjust = 0;
  if (bars.purple !== null) {
    if (winners.has(bars.purple)) {
      purpleClause = `Purple d${bars.purple} rising — future demand migrating INTO the winning zone.`;
      purpleAdjust = +2;
    } else if (losers.has(bars.purple)) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Purple d${bars.purple} is the fastest-growing demand and it sits in the losing zone. ` +
          `Tomorrow's dominant bar is forming on the wrong side of ${v.label} — demand is accumulating against this contract.`,
        reason: `Purple d${bars.purple} rising in losing zone.`,
        confidenceAdjust: 0,
      };
    }
  }

  // ── LAW 5A: UNDER — Green must be ODD ─────────────────────────────────
  // Operator rule: for UNDER trades the dominant bar must be an odd digit
  // (preferred 3, 5 or 7). An even green means probability is anchoring on
  // the wrong parity — even digits signal a different market psychology.
  if (v.side === "UNDER" && !losers.has(bars.green)) {
    if (bars.green % 2 === 0) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Green d${bars.green} is an even digit. UNDER psychology requires the dominant bar to be an odd digit ` +
          `(preferred 3, 5 or 7). Even dominance signals the market is not structurally set up for ${v.label}; ` +
          `demand is anchored on the wrong parity.`,
        reason: `Green d${bars.green} is even; UNDER trades require an odd Green digit.`,
        confidenceAdjust: 0,
      };
    }
  }

  // ── LAW 5B: OVER — Green must be EVEN ─────────────────────────────────
  // Operator rule: for OVER trades the dominant bar must be an even digit
  // (preferred 2, 4 or 6). An odd green signals misaligned parity.
  if (v.side === "OVER" && !losers.has(bars.green)) {
    if (bars.green % 2 !== 0) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Green d${bars.green} is an odd digit. OVER psychology requires the dominant bar to be an even digit ` +
          `(preferred 2, 4 or 6). Odd dominance signals the market is not structurally aligned with ${v.label}; ` +
          `demand is anchored on the wrong parity for an over-barrier trade.`,
        reason: `Green d${bars.green} is odd; OVER trades require an even Green digit.`,
        confidenceAdjust: 0,
      };
    }
  }

  // ── LAW 5C: UNDER — Red must be EVEN, never digit 8 ──────────────────
  // Operator rule: for UNDER the least-appearing digit must be an even digit
  // (preferred 0, 2, 4 or 6) and must never be digit 8. An odd Red creates
  // an unbalanced demand structure — odd weakness does not match UNDER parity.
  if (v.side === "UNDER" && !losers.has(bars.red)) {
    if (bars.red === 8) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Red d8 appears in the winning zone — digit 8 is structurally forbidden as the Red bar for UNDER trades. ` +
          `Its proximity to the losing boundary creates an inherent rebound risk that undermines ${v.label}.`,
        reason: `Red d8 is forbidden for UNDER trades.`,
        confidenceAdjust: 0,
      };
    }
    if (bars.red % 2 !== 0) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Red d${bars.red} is an odd digit. UNDER psychology requires the least-appearing digit to be an even number ` +
          `(preferred 0, 2, 4 or 6). Odd-digit weakness in the winning zone creates a parity imbalance — ` +
          `even digits should dominate the replenishment signal for ${v.label}.`,
        reason: `Red d${bars.red} is odd; UNDER trades require an even Red digit.`,
        confidenceAdjust: 0,
      };
    }
  }

  // ── LAW 5D: OVER — Red must be ODD, never digit 1 ─────────────────────
  // Operator rule: for OVER the least-appearing digit must be an odd digit
  // (preferred 3, 5, 7 or 9) and must never be digit 1. An even Red signals
  // parity misalignment for over-barrier psychology.
  if (v.side === "OVER" && !losers.has(bars.red)) {
    if (bars.red === 1) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Red d1 appears in the winning zone — digit 1 is structurally forbidden as the Red bar for OVER trades. ` +
          `Its proximity to the losing boundary introduces boundary-rebound risk that contradicts ${v.label}.`,
        reason: `Red d1 is forbidden for OVER trades.`,
        confidenceAdjust: 0,
      };
    }
    if (bars.red % 2 === 0) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Red d${bars.red} is an even digit. OVER psychology requires the least-appearing digit to be an odd number ` +
          `(preferred 3, 5, 7 or 9). Even-digit weakness in the winning zone creates a parity imbalance — ` +
          `odd digits should dominate the replenishment signal for ${v.label}.`,
        reason: `Red d${bars.red} is even; OVER trades require an odd Red digit.`,
        confidenceAdjust: 0,
      };
    }
  }

  // ── LAW 5E: UNDER — Digit 9 must be ≥10.5% AND decreasing ───────────
  // Operator rule: digit 9 must already be elevated (≥10.5%) AND its
  // pressure must be flat or falling. This confirms losing-zone exhaustion.
  // A digit 9 below threshold or still rising means the losing zone has
  // not yet spent itself — UNDER is premature.
  // Refinement (V7.1): tolerance bands turn near-misses into "watch" so the
  // Chief can weigh them against edge / momentum / migration evidence.
  if (v.side === "UNDER") {
    const d9 = stats.profiles[9];
    const belowHard = d9.pct < cfg.anchorExhaustionPct - 0.015; // <9.0%
    const belowSoft = d9.pct < cfg.anchorExhaustionPct; // <10.5%
    const pressHard = d9.pressure > cfg.anchorReleasePressure + 0.005; // >+1.0%
    const pressSoft = d9.pressure > cfg.anchorReleasePressure; // >+0.5%
    if (belowHard) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Digit 9 is only ${pct(d9.pct)} — UNDER trades require digit 9 above ${pct(cfg.anchorExhaustionPct)} to confirm ` +
          `losing-zone exhaustion. The extreme digit has not yet been sufficiently absorbed by the market.`,
        reason: `Digit 9 at ${pct(d9.pct)} below ${pct(cfg.anchorExhaustionPct)} UNDER threshold.`,
        confidenceAdjust: 0,
      };
    }
    if (belowSoft) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Digit 9 at ${pct(d9.pct)} — just under the ${pct(cfg.anchorExhaustionPct)} exhaustion line for UNDER. ` +
          `Chief will confirm from edge and migration whether the extreme is genuinely spent before publishing ${v.label}.`,
        reason: `Digit 9 borderline exhaustion (${pct(d9.pct)}).`,
        confidenceAdjust: -8,
      };
    }
    if (pressHard) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Digit 9 is at ${pct(d9.pct)} but still gaining pressure (${signed(d9.pressure)}). ` +
          `UNDER trades require digit 9 to be decreasing — a rising extreme digit means the losing zone ` +
          `is still loading, not exhausting. Wait for digit 9 to peak and decline before trading ${v.label}.`,
        reason: `Digit 9 elevated but still rising (${signed(d9.pressure)}).`,
        confidenceAdjust: 0,
      };
    }
    if (pressSoft) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Digit 9 at ${pct(d9.pct)} elevated, pressure only just above flat (${signed(d9.pressure)}). ` +
          `Chief will read momentum and rotation to decide whether the extreme is truly rolling over for ${v.label}.`,
        reason: `Digit 9 pressure borderline (${signed(d9.pressure)}).`,
        confidenceAdjust: -6,
      };
    }
  }

  // ── LAW 5F: OVER — Digit 0 must be ≥10.5% AND decreasing ────────────
  if (v.side === "OVER") {
    const d0 = stats.profiles[0];
    const belowHard = d0.pct < cfg.anchorExhaustionPct - 0.015;
    const belowSoft = d0.pct < cfg.anchorExhaustionPct;
    const pressHard = d0.pressure > cfg.anchorReleasePressure + 0.005;
    const pressSoft = d0.pressure > cfg.anchorReleasePressure;
    if (belowHard) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Digit 0 is only ${pct(d0.pct)} — OVER trades require digit 0 above ${pct(cfg.anchorExhaustionPct)} to confirm ` +
          `floor exhaustion. The floor digit has not been sufficiently absorbed; the low zone has not peaked yet.`,
        reason: `Digit 0 at ${pct(d0.pct)} below ${pct(cfg.anchorExhaustionPct)} OVER threshold.`,
        confidenceAdjust: 0,
      };
    }
    if (belowSoft) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Digit 0 at ${pct(d0.pct)} — just under the ${pct(cfg.anchorExhaustionPct)} exhaustion line for OVER. ` +
          `Chief will confirm from edge and migration whether the floor is genuinely spent before publishing ${v.label}.`,
        reason: `Digit 0 borderline exhaustion (${pct(d0.pct)}).`,
        confidenceAdjust: -8,
      };
    }
    if (pressHard) {
      return {
        outcome: "reject",
        bars,
        narrative:
          `Digit 0 is at ${pct(d0.pct)} but still gaining pressure (${signed(d0.pressure)}). ` +
          `OVER trades require digit 0 to be decreasing — a rising floor digit means the low-digit zone ` +
          `is still strengthening. Wait for digit 0 to peak and decline before trading ${v.label}.`,
        reason: `Digit 0 elevated but still rising (${signed(d0.pressure)}).`,
        confidenceAdjust: 0,
      };
    }
    if (pressSoft) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Digit 0 at ${pct(d0.pct)} elevated, pressure only just above flat (${signed(d0.pressure)}). ` +
          `Chief will read momentum and rotation to decide whether the floor is truly rolling over for ${v.label}.`,
        reason: `Digit 0 pressure borderline (${signed(d0.pressure)}).`,
        confidenceAdjust: -6,
      };
    }
  }

  // ── LAW 6: Pressure Rotation Engine ───────────────────────────────────
  // Refinement (V7.1): a near-tie in rotation returns "watch" so the Chief
  // can lean on momentum and migration evidence before killing the setup.
  if (!rotationTowardWinners) {
    const gap = winPressure - losePressure;
    if (gap > -0.015) {
      return {
        outcome: "watch",
        bars,
        narrative:
          `Rotation is nearly balanced — winners ${signed(winPressure)} vs losers ${signed(losePressure)}. ` +
          `Chief will use momentum and migration to decide whether flow is turning toward ${v.label}.`,
        reason: `Rotation borderline (winners ${signed(winPressure)} vs losers ${signed(losePressure)}).`,
        confidenceAdjust: -7,
      };
    }
    return {
      outcome: "reject",
      bars,
      narrative:
        `Pressure rotation opposes ${v.label} — losing zone gaining ${signed(losePressure)} vs winning zone ${signed(winPressure)}. ` +
        `Probability is not migrating toward the winning side.`,
      reason: `Winners pressure ${signed(winPressure)} not greater than losers ${signed(losePressure)}.`,
      confidenceAdjust: 0,
    };
  }

  // ── LAW 7: High-Fluctuation Detector ─────────────────────────────────
  const eps = cfg.competitionEpsilon;
  const byFreq = [...stats.pct.keys()].sort((a, b) => stats.pct[b] - stats.pct[a]);
  const bottomFreq = [...byFreq].reverse();
  const disputes: string[] = [];
  const checkPair = (label: string, a: number, b: number) => {
    if (Math.abs(stats.pct[a] - stats.pct[b]) < eps) {
      const opp = (winners.has(a) && losers.has(b)) || (winners.has(b) && losers.has(a));
      if (opp) disputes.push(`${label} d${a} vs d${b}`);
    }
  };
  checkPair("Green", byFreq[0], byFreq[1]);
  checkPair("Yellow", byFreq[1], byFreq[2]);
  checkPair("Red", bottomFreq[0], bottomFreq[1]);
  checkPair("Light-Red", bottomFreq[1], bottomFreq[2]);
  if (disputes.length > 0) {
    return {
      outcome: "watch",
      bars,
      narrative:
        `HIGH FLUCTUATION — ${disputes.join(" · ")} contesting the same rank from opposite zones. ` +
        `The market has not chosen a side; ${v.label} withheld until dominance resolves.`,
      reason: `Bar competition across zones: ${disputes.join(", ")}.`,
      confidenceAdjust: -5,
    };
  }

  // ── LAW 8: Boundary digit momentum ────────────────────────────────────
  const boundary = v.side === "OVER" ? v.barrier : v.barrier - 1;
  const losingBoundary = v.barrier;
  const bProfile = stats.profiles[losingBoundary];
  let boundaryClause = "";
  if (bProfile.pressure > cfg.anchorReleasePressure * 4) {
    return {
      outcome: "reject",
      bars,
      narrative:
        `Boundary digit d${losingBoundary} is accelerating hard (${signed(bProfile.pressure)}) — ` +
        `the losing zone is pressing back against ${v.label}. Wait for the boundary to soften.`,
      reason: `Boundary d${losingBoundary} pressure ${signed(bProfile.pressure)}.`,
      confidenceAdjust: 0,
    };
  }
  if (bProfile.pressure > cfg.anchorReleasePressure * 2) {
    return {
      outcome: "watch",
      bars,
      narrative:
        `Boundary d${losingBoundary} firming (${signed(bProfile.pressure)}) — moderate push-back against ${v.label}. ` +
        `Chief will confirm from momentum whether the boundary is genuinely resisting.`,
      reason: `Boundary d${losingBoundary} moderately firm (${signed(bProfile.pressure)}).`,
      confidenceAdjust: -5,
    };
  }
  boundaryClause = `Boundary d${losingBoundary} ${bProfile.pressure <= 0 ? "softening" : "stable"} (${signed(bProfile.pressure)}).`;
  void boundary;

  // ── LAW 9: Winning-zone headroom ─────────────────────────────────────
  const winnersList = [...winners].sort((a, b) => a - b);
  const [headroomA, headroomB] =
    v.side === "OVER"
      ? [winnersList[winnersList.length - 1], winnersList[winnersList.length - 2]]
      : [winnersList[0], winnersList[1]];
  let headroomAdjust = 0;
  const headroomOk =
    stats.pct[headroomA] < cfg.winningRoomCapPct && stats.pct[headroomB] < cfg.winningRoomCapPct;
  const headroomClause = headroomOk
    ? `d${headroomA} ${pct(stats.pct[headroomA])} and d${headroomB} ${pct(stats.pct[headroomB])} have room to grow.`
    : `d${headroomA} / d${headroomB} already elevated — winning-side headroom is limited.`;
  headroomAdjust = headroomOk ? +1 : -2;

  // ── Build accept narrative from verified clauses only ─────────────────
  const anchorLine =
    `Anchors Green d${bars.green} · Yellow d${bars.yellow} · Red d${bars.red} · Light-Red d${bars.lightRed}` +
    (bars.purple !== null ? ` · Purple d${bars.purple}` : "") +
    ".";
  const zoneLine =
    v.side === "OVER"
      ? `Winning zone {${winnersList.join(",")}} is absorbing probability; losing zone {${[...losers].sort((a, b) => a - b).join(",")}} is releasing it.`
      : `Winning zone {${winnersList.join(",")}} is absorbing probability; losing zone {${[...losers].sort((a, b) => a - b).join(",")}} is releasing it.`;
  const rotationLine = `Pressure rotation favours ${v.label}: winners ${signed(winPressure)} vs losers ${signed(losePressure)}.`;

  // Parity confirmation lines
  const parityLine =
    v.side === "UNDER"
      ? `Green d${bars.green} (odd ✓) · Red d${bars.red} (even ✓) · Digit 9 at ${pct(stats.profiles[9].pct)} releasing (${signed(stats.profiles[9].pressure)}) ✓`
      : `Green d${bars.green} (even ✓) · Red d${bars.red} (odd ✓) · Digit 0 at ${pct(stats.profiles[0].pct)} releasing (${signed(stats.profiles[0].pressure)}) ✓`;

  const parts = [
    anchorLine,
    zoneLine,
    greenClause,
    boundaryClause,
    headroomClause,
    rotationLine,
    parityLine,
  ];
  if (purpleClause) parts.push(purpleClause);
  if (losingBars.length > 0) {
    parts.push(
      `Note: ${losingBars.length} bar${losingBars.length === 1 ? "" : "s"} (${losingBars.map((b) => `${b.name} d${b.digit}`).join(", ")}) sit inside the losing zone but within tolerance.`,
    );
  }

  const confidenceAdjust = 4 + purpleAdjust + headroomAdjust - losingBars.length * 2;

  return {
    outcome: "accept",
    bars,
    narrative: parts.join(" "),
    confidenceAdjust,
  };
}
