// APEX SENTINEL — CANONICAL DIGIT-FREQUENCY PSYCHOLOGY (1,000-TICK LAYER).
//
// NON-DESTRUCTIVE: this module adds one canonical, normalised digit-frequency
// state and a positional (winning / losing / boundary) reading of it per
// contract. It scores nothing on its own authority: every output is bounded
// evidence handed to the EXISTING ranking, entry and explanation layers.
//
// Roles are earned from the data. There is no universal digit veto here — a
// digit may hold any role when the observed frequencies say so.
//
//   GREEN          = highest-frequency digit over the canonical window
//   2ND GREEN      = second-highest
//   RED            = lowest-frequency digit
//   2ND RED        = second-lowest
//   MOST INCREASING= strongest validated recent gain in frequency
//   MOST DECREASING= strongest validated recent loss in frequency
//
// Shorter windows are NOT collapsed away: they decide whether the canonical
// configuration is stable, strengthening, weakening, rotating or invalidated.
//
// ── OPERATOR EDGE RULES (canonical — encodes the operator's own trading
//    heuristic, verified against Deriv digit markets) ────────────────────
//
// OVER:
//   • GREEN and 2ND GREEN must be EVEN — on {0,2,4,6,8}.
//   • If GREEN sits on the extreme digit 0: digit 0 must be > 10.5% of the
//     window AND actively decreasing (exhaustion pattern).
//   • RED and 2ND RED must be ODD — on {3,5,7,9} — and may NEVER sit on
//     digit 1.
//   • Digits 7/8/9 should each be under 10% and RISING.
//   • More broadly, digits 5-9 (the OVER pace group) should be picking up
//     pace (positive average momentum).
//   • Even digits overall should be declining in share; odd digits gaining.
//
// UNDER (mirror image):
//   • GREEN and 2ND GREEN must be ODD — on {9,7,5,3,1}.
//   • If GREEN sits on the extreme digit 9: digit 9 must be > 10.5% AND
//     decreasing.
//   • RED and 2ND RED must be EVEN — on {0,2,4,6} — and may NEVER sit on
//     digit 8.
//   • Digits 0/1/2 should each be under 10% and RISING.
//   • Digits 0-4 (the UNDER pace group) should be picking up pace.
//   • Odd digits overall should be declining in share; even digits gaining.
//
// BOTH SIDES — non-negotiable:
//   • RED, 2ND RED, 2ND GREEN and MOST INCREASING must NEVER sit on the
//     losing side. Period — not "unless strengthening." If they are on the
//     losing side at all, the configuration is hard-blocked.
//   • RED/2ND RED may never sit on the excluded digit (1 for OVER, 8 for
//     UNDER), even if that digit's parity would otherwise qualify.
//   • Zone contest: if the top two frequency contenders for the GREEN role
//     (or the bottom two for the RED role) sit in OPPOSITE zones (one
//     winning, one losing) and are close enough in share to be effectively
//     tied, that leadership is unstable and flagged — it is not treated as
//     a clean signal.
import {
  BUILDING_STATES,
  FADING_STATES,
  type PressureField,
} from "../precision-edge-v2/pressure-engine";
import type { DigitIntel } from "../apex/digit-intel";

/** Canonical window length in ticks. */
export const CANONICAL_WINDOW = 1000;
/**
 * Recency window used to measure change against the canonical structure (200 ticks).
 * Slower than PRESSURE_SUB (150 ticks) to ensure structural classification stability across scans.
 */
export const RECENCY_WINDOW = 200;
/** Minimum |pp| move before a digit is called increasing / decreasing. */
export const MOVE_MIN_PP = 0.5;
/** Minimum |pp| gap before two zone-opposed contenders are no longer "tied". */
export const ZONE_CONTEST_GAP_PP = 1.0;
/** Threshold used for the extreme-digit (0 for OVER / 9 for UNDER) share requirement. */
export const EXTREME_SHARE_MIN_PCT = 10.5;
/** Threshold used for the edge-group (7/8/9 or 0/1/2) suppression requirement. */
export const EDGE_GROUP_MAX_PCT = 10;

export type PsychologyChange =
  "INSUFFICIENT" | "STABLE" | "STRENGTHENING" | "WEAKENING" | "ROTATING" | "INVALIDATED";

export interface CanonicalDigitState {
  /** Ticks actually used from the canonical window. */
  n: number;
  /** Per-digit share of the canonical window, in percent. */
  pct: number[];
  /** Per-digit recent share (RECENCY_WINDOW), in percent. */
  recentPct: number[];
  /** recentPct − pct, in percentage points. */
  deltaPp: number[];
  green: number | null;
  secondGreen: number | null;
  red: number | null;
  secondRed: number | null;
  mostIncreasing: number | null;
  mostDecreasing: number | null;
  change: PsychologyChange;
  changeDetail: string;
  summary: string;
}

function shareOf(seg: number[], d: number): number {
  if (!seg.length) return 0;
  let c = 0;
  for (const x of seg) if (x === d) c++;
  return (c / seg.length) * 100;
}

/**
 * Build the canonical 1,000-tick digit-frequency state. Pure, and derived only
 * from observed digits (the DigitIntel argument is used for corroboration of
 * momentum, never to invent a role).
 */
export function canonicalDigitState(
  digits: number[],
  intel?: DigitIntel | null,
): CanonicalDigitState {
  const window = digits.slice(-CANONICAL_WINDOW);
  const recent = digits.slice(-RECENCY_WINDOW);
  const n = window.length;
  const pct = Array.from({ length: 10 }, (_, d) => shareOf(window, d));
  const recentPct = Array.from({ length: 10 }, (_, d) => shareOf(recent, d));
  const deltaPp = pct.map((p, d) => recentPct[d] - p);

  const enough = n >= 300;
  const byFreq = pct.map((p, d) => ({ d, p })).sort((a, b) => b.p - a.p || a.d - b.d);
  const green = enough ? byFreq[0].d : null;
  const secondGreen = enough ? byFreq[1].d : null;
  const red = enough ? byFreq[byFreq.length - 1].d : null;
  const secondRed = enough ? byFreq[byFreq.length - 2].d : null;

  // Momentum is corroborated: the recent share move must agree in sign with the
  // per-digit momentum the existing intelligence layer already measures.
  const agrees = (d: number, sign: 1 | -1) => {
    const m = intel?.profiles?.[d]?.momentum;
    if (m === undefined) return true;
    return sign > 0 ? m >= 0 : m <= 0;
  };
  let inc: number | null = null;
  let dec: number | null = null;
  if (enough) {
    let bestUp = MOVE_MIN_PP;
    let bestDown = -MOVE_MIN_PP;
    for (let d = 0; d < 10; d++) {
      if (deltaPp[d] > bestUp && agrees(d, 1)) {
        bestUp = deltaPp[d];
        inc = d;
      }
      if (deltaPp[d] < bestDown && agrees(d, -1)) {
        bestDown = deltaPp[d];
        dec = d;
      }
    }
  }

  // ── Configuration change, from the shorter window ────────────────────
  let change: PsychologyChange = "INSUFFICIENT";
  let changeDetail = `Only ${n} tick(s) of canonical history — the 1,000-tick configuration is not yet measurable.`;
  if (enough && recent.length >= 80 && green !== null && red !== null) {
    const shortRank = recentPct.map((p, d) => ({ d, p })).sort((a, b) => b.p - a.p || a.d - b.d);
    const shortTop = shortRank[0].d;
    const shortBottomTwo = [shortRank[8].d, shortRank[9].d];
    const greenMove = deltaPp[green];
    if (shortBottomTwo.includes(green)) {
      change = "INVALIDATED";
      changeDetail = `Green digit ${green} has collapsed into the least-frequent pair of the last ${recent.length} ticks (${greenMove.toFixed(2)}pp).`;
    } else if (shortTop !== green && recentPct[green] < 10) {
      change = "ROTATING";
      changeDetail = `Leadership is rotating: digit ${shortTop} now leads the last ${recent.length} ticks while canonical green ${green} sits at ${recentPct[green].toFixed(2)}%.`;
    } else if (shortTop === green && greenMove >= 0.4) {
      change = "STRENGTHENING";
      changeDetail = `Green digit ${green} still leads the recent window and is gaining ${greenMove.toFixed(2)}pp.`;
    } else if (greenMove <= -0.6) {
      change = "WEAKENING";
      changeDetail = `Green digit ${green} is losing ${Math.abs(greenMove).toFixed(2)}pp of share in the last ${recent.length} ticks.`;
    } else {
      change = "STABLE";
      changeDetail = `Canonical configuration is holding (green ${green} moved ${greenMove.toFixed(2)}pp over the last ${recent.length} ticks).`;
    }
  }

  const summary = enough
    ? `GREEN ${green} · 2ND GREEN ${secondGreen} · RED ${red} · 2ND RED ${secondRed} · MOST INCREASING ${inc ?? "—"} · MOST DECREASING ${dec ?? "—"} (${n} ticks, ${change})`
    : `Canonical digit psychology unavailable — ${n} tick(s) of ${CANONICAL_WINDOW}.`;

  return {
    n,
    pct,
    recentPct,
    deltaPp,
    green,
    secondGreen,
    red,
    secondRed,
    mostIncreasing: inc,
    mostDecreasing: dec,
    change,
    changeDetail,
    summary,
  };
}

// ──────────────────────────────────────────────────────────────────────
// POSITIONAL PSYCHOLOGY — where the roles sit for a given contract, scored
// against the operator's OVER / UNDER edge rules documented above.
// ──────────────────────────────────────────────────────────────────────

export type Zone = "WINNING" | "LOSING" | "BOUNDARY" | "UNKNOWN";
export type PsychologyVerdict = "SUPPORT" | "NEUTRAL" | "CONFLICT";

export interface RolePosition {
  role:
    | "GREEN"
    | "2ND GREEN"
    | "RED"
    | "2ND RED"
    | "MOST INCREASING"
    | "MOST DECREASING"
    | "EDGE GROUP"
    | "PACE GROUP"
    | "PARITY TREND";
  digit: number | null;
  zone: Zone;
  /** +1 supports the contract, −1 conflicts, 0 neutral / not evaluable. */
  support: -1 | 0 | 1;
  note: string;
}

export interface ContractPsychology {
  contract: string;
  side: "OVER" | "UNDER";
  barrier: number;
  winningZone: number[];
  losingZone: number[];
  boundary: number[];
  positions: RolePosition[];
  /** 0..100 — 50 is neutral. */
  score: number;
  /** 0..100 — how much of the configuration could actually be measured. */
  confidence: number;
  verdict: PsychologyVerdict;
  /** Bounded ranking contribution in score points (±4). */
  rankingDelta: number;
  /** True when non-negotiable roles violate losing-side rules. */
  hardBlock: boolean;
  /** Human-readable reason for hard-block, or null if not blocked. */
  hardBlockReason: string | null;
  /** True when GREEN or RED leadership is contested by an opposite-zone digit within ZONE_CONTEST_GAP_PP. */
  zoneContested: boolean;
  zoneContestedReason: string | null;
  reasons: string[];
  cautions: string[];
  summary: string;
}

export interface ContractShape {
  label: string;
  side: "OVER" | "UNDER";
  barrier: number;
  winners: number[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function zoneOf(d: number, winners: number[], boundary: number[]): Zone {
  if (boundary.includes(d)) return "BOUNDARY";
  return winners.includes(d) ? "WINNING" : "LOSING";
}

function decayingEnough(
  state: CanonicalDigitState,
  d: number,
  pressure?: PressureField | null,
): boolean {
  const move = state.deltaPp[d] ?? 0;
  const p = pressure?.digits?.[d];
  const fading = p ? FADING_STATES.includes(p.state) || p.momentum < 0 : false;
  return move < -MOVE_MIN_PP || fading;
}

/**
 * Evaluate the canonical roles against one contract's winning / losing /
 * boundary regions plus the operator's OVER / UNDER edge rules.
 *
 * Weighted evidence for most factors — but RED, 2ND RED, 2ND GREEN and
 * MOST INCREASING landing on the losing side, or RED/2ND RED landing on the
 * excluded digit, are HARD, absolute blocks per the operator's own rules.
 */
export function contractPsychology(
  state: CanonicalDigitState,
  shape: ContractShape,
  pressure?: PressureField | null,
): ContractPsychology {
  const winners = shape.winners;
  const all = Array.from({ length: 10 }, (_, d) => d);
  const losers = all.filter((d) => !winners.includes(d));
  const boundary =
    shape.side === "OVER"
      ? [shape.barrier, shape.barrier + 1].filter((d) => d >= 0 && d <= 9)
      : [shape.barrier - 1, shape.barrier].filter((d) => d >= 0 && d <= 9);

  const isOver = shape.side === "OVER";
  const isEven = (d: number) => d % 2 === 0;
  /** Digit whose exhaustion the extreme-green rule watches (0 for OVER, 9 for UNDER). */
  const extremeDigit = isOver ? 0 : 9;
  /** Digit RED/2ND RED may never occupy, regardless of parity. */
  const excludedRedDigit = isOver ? 1 : 8;
  const greenParitySet = isOver ? [0, 2, 4, 6, 8] : [9, 7, 5, 3, 1];
  const redParitySet = isOver ? [3, 5, 7, 9] : [0, 2, 4, 6];
  /** Suppressed-but-rising edge group (7/8/9 for OVER, 0/1/2 for UNDER). */
  const edgeGroup = isOver ? [7, 8, 9] : [0, 1, 2];
  /** Broader pace group that should be picking up momentum (5-9 / 0-4). */
  const paceGroup = isOver ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  const evenDigits = [0, 2, 4, 6, 8];
  const oddDigits = [1, 3, 5, 7, 9];

  const zoneOfD = (d: number) => zoneOf(d, winners, boundary);

  const positions: RolePosition[] = [];
  const reasons: string[] = [];
  const cautions: string[] = [];
  let gained = 0;
  let weightTotal = 0;
  let measured = 0;
  let measurable = 0;

  const add = (
    role: RolePosition["role"],
    digit: number | null,
    weight: number,
    evaluate: (d: number, zone: Zone) => { support: -1 | 0 | 1; note: string },
  ) => {
    measurable += 1;
    if (digit === null) {
      positions.push({
        role,
        digit: null,
        zone: "UNKNOWN",
        support: 0,
        note: "Not measurable yet.",
      });
      return;
    }
    measured += 1;
    const zone = zoneOfD(digit);
    const { support, note } = evaluate(digit, zone);
    positions.push({ role, digit, zone, support, note });
    weightTotal += weight;
    gained += support * weight;
    if (support > 0) reasons.push(`${role} ${digit} — ${note}`);
    if (support < 0) cautions.push(`${role} ${digit} — ${note}`);
  };

  // ── GREEN — must be the parity matching the side; extreme digit (0/9)
  //    additionally requires >10.5% share AND active decay ──────────────
  add("GREEN", state.green, 26, (d, zone) => {
    const parityOk = isOver ? isEven(d) : !isEven(d);
    if (!parityOk) {
      return {
        support: -1 as const,
        note: `wrong parity for ${shape.side} — GREEN must sit on ${greenParitySet.join("/")}.`,
      };
    }
    if (d === extremeDigit) {
      const decaying = decayingEnough(state, d, pressure);
      const highEnough = state.pct[d] > EXTREME_SHARE_MIN_PCT;
      if (!highEnough || !decaying) {
        return {
          support: -1 as const,
          note: `extreme digit ${d} must be above ${EXTREME_SHARE_MIN_PCT}% and decreasing for ${shape.side} psychology (currently ${state.pct[d].toFixed(2)}%, ${decaying ? "decaying" : "not decaying"}).`,
        };
      }
      return {
        support: 1 as const,
        note: `extreme digit ${d} is above ${EXTREME_SHARE_MIN_PCT}% (${state.pct[d].toFixed(2)}%) and decaying — correct ${shape.side} exhaustion pattern.`,
      };
    }
    if (zone === "LOSING") {
      return { support: -1 as const, note: `correct parity but sits in the losing region.` };
    }
    return {
      support: 1 as const,
      note: `${isOver ? "even" : "odd"} and in the ${zone.toLowerCase()} region — supports ${shape.side}.`,
    };
  });

  // ── 2ND GREEN — parity-matched AND must sit strictly in the winning zone ──
  add("2ND GREEN", state.secondGreen, 12, (d, zone) => {
    const parityOk = isOver ? isEven(d) : !isEven(d);
    if (!parityOk) {
      return {
        support: -1 as const,
        note: `wrong parity — 2ND GREEN must be ${isOver ? "even" : "odd"} (${greenParitySet.join("/")}).`,
      };
    }
    if (zone !== "WINNING") {
      return {
        support: -1 as const,
        note: `2ND GREEN must sit in the winning zone — currently ${zone.toLowerCase()}.`,
      };
    }
    return { support: 1 as const, note: "correct parity and confirmed in the winning zone." };
  });

  // ── RED — parity-matched, never on the excluded digit, must sit in the
  //    winning zone (never the losing zone) ──────────────────────────────
  add("RED", state.red, 20, (d, zone) => {
    if (d === excludedRedDigit) {
      return {
        support: -1 as const,
        note: `RED may never sit on digit ${excludedRedDigit} for ${shape.side} psychology.`,
      };
    }
    const parityOk = isOver ? !isEven(d) : isEven(d);
    if (!parityOk) {
      return {
        support: -1 as const,
        note: `wrong parity — RED must be ${isOver ? "odd (3/5/7/9)" : "even (0/2/4/6)"}.`,
      };
    }
    if (zone !== "WINNING") {
      return {
        support: -1 as const,
        note: `RED must sit in the winning zone — currently ${zone.toLowerCase()}.`,
      };
    }
    return { support: 1 as const, note: `correct parity (${redParitySet.join("/")}), confirmed in the winning zone.` };
  });

  // ── 2ND RED — same rule as RED ─────────────────────────────────────────
  add("2ND RED", state.secondRed, 10, (d, zone) => {
    if (d === excludedRedDigit) {
      return {
        support: -1 as const,
        note: `2ND RED may never sit on digit ${excludedRedDigit} for ${shape.side} psychology.`,
      };
    }
    const parityOk = isOver ? !isEven(d) : isEven(d);
    if (!parityOk) {
      return {
        support: -1 as const,
        note: `wrong parity — 2ND RED must be ${isOver ? "odd (3/5/7/9)" : "even (0/2/4/6)"}.`,
      };
    }
    if (zone !== "WINNING") {
      return {
        support: -1 as const,
        note: `2ND RED must sit in the winning zone — currently ${zone.toLowerCase()}.`,
      };
    }
    return { support: 1 as const, note: "correct parity, confirmed in the winning zone." };
  });

  // ── MOST INCREASING — must be gaining inside the winning zone; landing
  //    on the losing side is never acceptable, since "most increasing"
  //    already means it is strengthening against the contract ────────────
  add("MOST INCREASING", state.mostIncreasing, 22, (d, zone) =>
    zone === "WINNING"
      ? {
          support: 1 as const,
          note: `gaining ${state.deltaPp[d].toFixed(2)}pp inside the winning region.`,
        }
      : {
          support: -1 as const,
          note: `gaining ${state.deltaPp[d].toFixed(2)}pp outside the winning region (${zone.toLowerCase()}) — pressure against the contract.`,
        },
  );

  // ── MOST DECREASING — fading out of the losing region is supportive;
  //    fading out of the winning region is a caution ─────────────────────
  add("MOST DECREASING", state.mostDecreasing, 8, (d, zone) =>
    zone === "LOSING"
      ? {
          support: 1 as const,
          note: `fading ${Math.abs(state.deltaPp[d]).toFixed(2)}pp out of the losing region.`,
        }
      : zone === "WINNING"
        ? {
            support: -1 as const,
            note: `fading ${Math.abs(state.deltaPp[d]).toFixed(2)}pp out of the winning region.`,
          }
        : { support: 0 as const, note: "fading on the boundary." },
  );

  // ── EDGE GROUP — 7/8/9 (OVER) or 0/1/2 (UNDER) should each be under 10%
  //    and rising ───────────────────────────────────────────────────────
  measurable += 1;
  if (state.n >= 300) {
    measured += 1;
    const weight = 14;
    const allSuppressedAndRising = edgeGroup.every(
      (d) => state.pct[d] < EDGE_GROUP_MAX_PCT && state.deltaPp[d] > 0,
    );
    const avgMove = edgeGroup.reduce((a, d) => a + state.deltaPp[d], 0) / edgeGroup.length;
    const support: -1 | 0 | 1 = allSuppressedAndRising ? 1 : avgMove < 0 ? -1 : 0;
    const detail = `digits ${edgeGroup.join("/")} at ${edgeGroup
      .map((d) => `${state.pct[d].toFixed(1)}%`)
      .join("/")}, avg move ${avgMove >= 0 ? "+" : ""}${avgMove.toFixed(2)}pp`;
    weightTotal += weight;
    gained += support * weight;
    positions.push({ role: "EDGE GROUP", digit: null, zone: "UNKNOWN", support, note: detail });
    if (support > 0) reasons.push(`EDGE GROUP — ${detail} (suppressed and rising, as required).`);
    if (support < 0) cautions.push(`EDGE GROUP — ${detail} (should be suppressed and rising).`);
  } else {
    positions.push({ role: "EDGE GROUP", digit: null, zone: "UNKNOWN", support: 0, note: "Not measurable yet." });
  }

  // ── PACE GROUP — 5-9 (OVER) or 0-4 (UNDER) should be picking up pace ───
  measurable += 1;
  if (state.n >= 300) {
    measured += 1;
    const weight = 10;
    const avgMove = paceGroup.reduce((a, d) => a + state.deltaPp[d], 0) / paceGroup.length;
    const support: -1 | 0 | 1 = avgMove >= MOVE_MIN_PP ? 1 : avgMove <= -MOVE_MIN_PP ? -1 : 0;
    const detail = `pace group ${paceGroup.join("/")} averaging ${avgMove >= 0 ? "+" : ""}${avgMove.toFixed(2)}pp`;
    weightTotal += weight;
    gained += support * weight;
    positions.push({ role: "PACE GROUP", digit: null, zone: "UNKNOWN", support, note: detail });
    if (support > 0) reasons.push(`PACE GROUP — ${detail}.`);
    if (support < 0) cautions.push(`PACE GROUP — ${detail} (should be picking up, not fading).`);
  } else {
    positions.push({ role: "PACE GROUP", digit: null, zone: "UNKNOWN", support: 0, note: "Not measurable yet." });
  }

  // ── PARITY TREND — even digits declining / odd digits gaining for OVER;
  //    mirrored for UNDER ────────────────────────────────────────────────
  measurable += 1;
  if (state.n >= 300) {
    measured += 1;
    const weight = 10;
    const evenAvg = evenDigits.reduce((a, d) => a + state.deltaPp[d], 0) / evenDigits.length;
    const oddAvg = oddDigits.reduce((a, d) => a + state.deltaPp[d], 0) / oddDigits.length;
    // OVER wants even declining & odd gaining; UNDER wants the opposite.
    const wantDecliningAvg = isOver ? evenAvg : oddAvg;
    const wantGainingAvg = isOver ? oddAvg : evenAvg;
    const matched = wantDecliningAvg < 0 && wantGainingAvg > 0;
    const partial = wantDecliningAvg < 0 || wantGainingAvg > 0;
    const support: -1 | 0 | 1 = matched ? 1 : partial ? 0 : -1;
    const detail = `even avg ${evenAvg >= 0 ? "+" : ""}${evenAvg.toFixed(2)}pp, odd avg ${oddAvg >= 0 ? "+" : ""}${oddAvg.toFixed(2)}pp (${shape.side} wants ${isOver ? "even declining / odd gaining" : "odd declining / even gaining"})`;
    weightTotal += weight;
    gained += support * weight;
    positions.push({ role: "PARITY TREND", digit: null, zone: "UNKNOWN", support, note: detail });
    if (support > 0) reasons.push(`PARITY TREND — ${detail}.`);
    if (support < 0) cautions.push(`PARITY TREND — ${detail}.`);
  } else {
    positions.push({ role: "PARITY TREND", digit: null, zone: "UNKNOWN", support: 0, note: "Not measurable yet." });
  }

  // ── ZONE CONTEST — GREEN/2ND GREEN or RED/2ND RED tied across opposite
  //    zones. Unstable leadership, never treated as a clean signal ───────
  let zoneContested = false;
  let zoneContestedReason: string | null = null;
  if (state.green !== null && state.secondGreen !== null) {
    const gGap = Math.abs(state.pct[state.green] - state.pct[state.secondGreen]);
    const gZone = zoneOfD(state.green);
    const g2Zone = zoneOfD(state.secondGreen);
    if (gZone !== g2Zone && gGap < ZONE_CONTEST_GAP_PP) {
      zoneContested = true;
      zoneContestedReason = `GREEN bar contested: digit ${state.green} (${gZone}) and digit ${state.secondGreen} (${g2Zone}) are only ${gGap.toFixed(2)}pp apart — unstable leadership split between winning and losing zones.`;
    }
  }
  if (!zoneContested && state.red !== null && state.secondRed !== null) {
    const rGap = Math.abs(state.pct[state.red] - state.pct[state.secondRed]);
    const rZone = zoneOfD(state.red);
    const r2Zone = zoneOfD(state.secondRed);
    if (rZone !== r2Zone && rGap < ZONE_CONTEST_GAP_PP) {
      zoneContested = true;
      zoneContestedReason = `RED bar contested: digit ${state.red} (${rZone}) and digit ${state.secondRed} (${r2Zone}) are only ${rGap.toFixed(2)}pp apart — unstable leadership split between winning and losing zones.`;
    }
  }
  if (zoneContested && zoneContestedReason) {
    cautions.push(`ZONE CONTEST — ${zoneContestedReason}`);
  }

  // ── HARD-BLOCK ENFORCEMENT ──────────────────────────────────────────────
  // Non-negotiable per the operator's rules: RED, 2ND RED, 2ND GREEN and
  // MOST INCREASING may NEVER sit on the losing side — no exceptions, and
  // no "unless strengthening" carve-out. RED/2ND RED may never sit on the
  // excluded digit either. GREEN on the losing side keeps the narrower
  // decay + replacement carve-out, since the operator did not flag GREEN
  // itself as an absolute-never-losing role the way they did the other four.
  let hardBlock = false;
  let hardBlockReason: string | null = null;

  // Excluded-digit check runs first for RED/2ND RED so it produces the more
  // specific reason whenever both conditions happen to hold at once (the
  // excluded digit is, in virtually every real barrier, already inside the
  // losing zone anyway).
  if (state.red === excludedRedDigit) {
    hardBlock = true;
    hardBlockReason = `RED sits on the forbidden digit ${excludedRedDigit} for ${shape.side} psychology.`;
  }
  if (!hardBlock && state.secondRed === excludedRedDigit) {
    hardBlock = true;
    hardBlockReason = `2ND RED sits on the forbidden digit ${excludedRedDigit} for ${shape.side} psychology.`;
  }

  const blockIfLosing = (digit: number | null, roleName: string) => {
    if (hardBlock || digit === null) return;
    const zone = zoneOfD(digit);
    if (zone === "LOSING") {
      hardBlock = true;
      hardBlockReason = `${roleName} (digit ${digit}) sits on the losing side — never permitted for ${shape.side} psychology.`;
    }
  };
  blockIfLosing(state.red, "RED");
  blockIfLosing(state.secondRed, "2ND RED");
  blockIfLosing(state.secondGreen, "2ND GREEN");
  blockIfLosing(state.mostIncreasing, "MOST INCREASING");

  const isGreenDecaying = (d: number): boolean => {
    const p = pressure?.digits?.[d];
    if (p) {
      if (FADING_STATES.includes(p.state) || p.momentum < 0) return true;
    }
    const delta = state.deltaPp[d] ?? 0;
    return delta < 0;
  };

  const hasConfirmedReplacement = (): boolean => {
    if (state.mostIncreasing !== null && winners.includes(state.mostIncreasing)) {
      return true;
    }
    if (pressure) {
      for (const w of winners) {
        const p = pressure.digits?.[w];
        if (p && (BUILDING_STATES.includes(p.state) || (p.momentum > 0 && p.accel > 0))) {
          return true;
        }
      }
    }
    return false;
  };

  if (!hardBlock && state.green !== null && losers.includes(state.green)) {
    const decaying = isGreenDecaying(state.green);
    const replacement = hasConfirmedReplacement();
    if (!decaying || !replacement) {
      hardBlock = true;
      if (!decaying && !replacement) {
        hardBlockReason = `GREEN (digit ${state.green}) sits on the losing side without confirmed decay or winning-side replacement`;
      } else if (!decaying) {
        hardBlockReason = `GREEN (digit ${state.green}) sits on the losing side without confirmed decay`;
      } else {
        hardBlockReason = `GREEN (digit ${state.green}) is decaying on the losing side but lacks a confirmed winning-side replacement`;
      }
    }
  }

  if (hardBlock && hardBlockReason) {
    cautions.push(`HARD BLOCK — ${hardBlockReason}`);
  }

  const score = weightTotal > 0 ? Math.round(50 + (gained / weightTotal) * 50) : 50;
  const coverage = measurable ? measured / measurable : 0;
  const dataFactor = Math.min(1, state.n / CANONICAL_WINDOW);
  const changePenalty =
    state.change === "INVALIDATED" ? 0.55 : state.change === "ROTATING" ? 0.75 : 1;
  const contestPenalty = zoneContested ? 0.7 : 1;
  const confidence = Math.round(
    clamp((coverage * 55 + dataFactor * 45) * changePenalty * contestPenalty, 0, 100),
  );
  const verdict: PsychologyVerdict = score >= 65 ? "SUPPORT" : score <= 35 ? "CONFLICT" : "NEUTRAL";
  const rankingDelta =
    Math.round(clamp(((score - 50) / 50) * 4 * (confidence / 100), -4, 4) * 10) / 10;

  if (state.change === "ROTATING" || state.change === "INVALIDATED") {
    cautions.push(`Configuration ${state.change} — ${state.changeDetail}`);
  }

  return {
    contract: shape.label,
    side: shape.side,
    barrier: shape.barrier,
    winningZone: winners,
    losingZone: losers,
    boundary,
    positions,
    score,
    confidence,
    verdict,
    rankingDelta,
    hardBlock,
    hardBlockReason,
    zoneContested,
    zoneContestedReason,
    reasons,
    cautions,
    summary: `${shape.label}: digit psychology ${hardBlock ? "BLOCKED" : verdict} (${score}/100 at confidence ${confidence}/100, configuration ${state.change}${zoneContested ? ", ZONE CONTESTED" : ""})${hardBlock ? ` [${hardBlockReason}]` : ""}.`,
  };
}

/**
 * Bounded, per-digit psychology bias for the Entry-Point Engine. It answers
 * "given this configuration, is entering on THIS digit psychologically sound?"
 * and never exceeds ±3 points, so it can shade a ranking but not create one.
 */
export function entryDigitPsychologyBias(
  state: CanonicalDigitState,
  psych: ContractPsychology,
  digit: number,
): { points: number; detail: string } {
  if (state.n < 300) {
    return {
      points: 0,
      detail: "Canonical digit psychology not measurable yet — no entry influence.",
    };
  }
  const zone = zoneOf(digit, psych.winningZone, psych.boundary);
  const notes: string[] = [`entry digit ${digit} is in the ${zone.toLowerCase()} region`];
  let pts = 0;
  if (zone === "WINNING") pts += 1.2;
  if (zone === "LOSING") pts -= 1.5;
  if (zone === "BOUNDARY") pts -= 0.5;

  if (digit === state.mostIncreasing) {
    const bonus = zone === "LOSING" ? -1.2 : 1.2;
    pts += bonus;
    notes.push(`it is the MOST INCREASING digit (${state.deltaPp[digit].toFixed(2)}pp)`);
  }
  if (digit === state.mostDecreasing) {
    pts += zone === "WINNING" ? -0.8 : 0.6;
    notes.push(`it is the MOST DECREASING digit (${state.deltaPp[digit].toFixed(2)}pp)`);
  }
  if (digit === state.green) {
    pts += zone === "LOSING" ? -0.8 : 0.6;
    notes.push("it is the GREEN (highest-frequency) digit");
  }
  if (digit === state.red) {
    // RED must sit in the WINNING zone per the operator's rules — reward it
    // there, penalise it in the losing zone (inverted from the old model).
    pts += zone === "WINNING" ? 0.5 : -0.4;
    notes.push("it is the RED (lowest-frequency) digit");
  }
  if (psych.zoneContested) {
    pts -= 0.4;
    notes.push("GREEN/RED leadership is currently zone-contested");
  }
  // The overall configuration verdict tilts every candidate slightly, and the
  // positional part above is what differentiates them.
  pts += psych.verdict === "SUPPORT" ? 0.5 : psych.verdict === "CONFLICT" ? -0.5 : 0;

  const scaled = pts * Math.max(0.4, psych.confidence / 100);
  return {
    points: Math.round(clamp(scaled, -3, 3) * 10) / 10,
    detail: `${notes.join("; ")}. Contract psychology ${psych.verdict} (${psych.score}/100).`,
  };
}
