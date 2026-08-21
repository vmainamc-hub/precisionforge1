// The five non-negotiable precision gates. Pure functions — no React, no IO.
import {
  BUILDING_STATES,
  PRESSURE_META,
  groupPressure,
  readPressure,
  type GroupPressure,
  type PressureField,
  type PressureState,
} from "@/lib/precision-edge-v2/pressure-engine";
import { CONTRACT_DEFS, type PrecisionContractId } from "./contracts";

export type GateResults = {
  /** PRIMARY — the live 0-9 distribution must favour the winning zone. */
  distributionEdge: boolean;
  colorDiversity: boolean;
  noCompetition: boolean;
  gateDigitCheck: boolean;
  winnersPressure: boolean;
  losersPressure: boolean;
};

export type GateDetail = { key: keyof GateResults; label: string; pass: boolean; note: string };

export type GateEvaluation = {
  passed: boolean;
  gateResults: GateResults;
  details: GateDetail[];
  wGroup: GroupPressure;
  lGroup: GroupPressure;
  gateDigitShare: number;
  gateDigitMomentum: number;
  confidence: number;
  /** Building (coloured) digits sitting inside the winning zone. */
  buildingInWinners: number[];
  /** Building (coloured) digits sitting on the losing side — must be empty. */
  buildingOutsideWinners: number[];
  /** Distribution readings (primary evidence). */
  winnerShare: number;
  loserShare: number;
  distEdgePct: number;
  winnersAboveFair: number[];
  hotLosers: number[];
  /** Human-readable labels of the gates that failed. */
  blockedBy: string[];
};

const isBuilding = (s: PressureState) => BUILDING_STATES.includes(s);

export function pressureColor(state: PressureState): string {
  return PRESSURE_META[state].color;
}

export type GateOptions = {
  /** How many coloured (building) digits must sit inside the winning zone. */
  minBuildingWinners: number;
  /** Minimum distribution edge of the winning zone over fair share, in %. */
  minEdgePct: number;
  /** A loser digit may not exceed this share (fair share = 10%). */
  maxLoserShare: number;
};

export const DEFAULT_GATE_OPTIONS: GateOptions = {
  minBuildingWinners: 4,
  minEdgePct: 0.8,
  maxLoserShare: 0.102,
};

export function evaluateGates(
  id: PrecisionContractId,
  field: PressureField,
  options: Partial<GateOptions> = {},
): GateEvaluation {
  const opts = { ...DEFAULT_GATE_OPTIONS, ...options };
  const def = CONTRACT_DEFS[id];
  const { fullWinners, losers, gateDigit } = def;

  // ═══ PRIMARY GATE — the live 0-9 distribution over the last N ticks ═══
  // The scanner trades what the distribution says. Pressure/scarcity is only
  // allowed to confirm it, never to override it.
  const shares = field.digits.map((d) => d.share);
  const winnerShare = fullWinners.reduce((a, d) => a + shares[d], 0);
  const loserShare = losers.reduce((a, d) => a + shares[d], 0);
  const fairWinnerShare = fullWinners.length / 10;
  const distEdgePct = (winnerShare - fairWinnerShare) * 100;
  const winnersAboveFair = fullWinners.filter((d) => shares[d] > 0.1);
  const hotLosers = losers.filter((d) => shares[d] > opts.maxLoserShare);
  const meanWinnerShare = winnerShare / fullWinners.length;
  const maxLoserShare = losers.reduce((a, d) => Math.max(a, shares[d]), 0);
  // Every loser must be quieter than the average digit inside the zone.
  const zoneOutranksLosers = maxLoserShare <= meanWinnerShare;
  const needAboveFair = Math.min(opts.minBuildingWinners, Math.ceil(fullWinners.length / 2));
  const distributionEdge =
    distEdgePct >= opts.minEdgePct &&
    hotLosers.length === 0 &&
    zoneOutranksLosers &&
    winnersAboveFair.length >= needAboveFair;

  // ---- Gate 5 first (cheapest hard block: no recovering/dominant losers) ----
  const noRecoveringLosers = losers.every((d) => !isBuilding(field.digits[d].state));
  const lGroup = groupPressure(field, losers);
  const losersFadingMajority = lGroup.fading >= Math.ceil(losers.length * 0.5);
  const losersPressure = noRecoveringLosers && losersFadingMajority;

  // ---- Gate 1 — colour diversity on the winning side ----
  // THE rule: every coloured (building) bar on the board must sit inside the
  // winning zone, and enough of them must be there to call it a cluster.
  const winnerSet = new Set(fullWinners);
  const buildingInWinners: number[] = [];
  const buildingOutsideWinners: number[] = [];
  for (let d = 0; d < 10; d++) {
    if (!isBuilding(field.digits[d].state)) continue;
    if (winnerSet.has(d)) buildingInWinners.push(d);
    else buildingOutsideWinners.push(d);
  }
  const colorDiversity =
    buildingOutsideWinners.length === 0 && buildingInWinners.length >= opts.minBuildingWinners;

  // ---- Gate 2 — no competition from losers ----
  // A loser may sit above fair share only if it is actively exhausting (rolling
  // over); anything flat/fair must be at or below fair share.
  const noCompetition = losers.every((d) => {
    const p = field.digits[d];
    const fading = p.state === "exhausting" || p.state === "suppressed" || p.state === "fair";
    if (!fading) return false;
    if (p.state === "exhausting" || p.state === "suppressed") return p.momentum <= 0;
    return p.share <= 0.105;
  });

  // ---- Gate 3 — boundary gate digit ----
  // The barrier-adjacent loser must not be climbing back.
  const gd = field.digits[gateDigit];
  const gateDigitCheck = !isBuilding(gd.state) && gd.momentum <= 0.002;

  // ---- Gate 4 — winners building ----
  const wGroup = groupPressure(field, fullWinners);
  const winnersPressure =
    wGroup.building >= Math.min(opts.minBuildingWinners, Math.ceil(fullWinners.length / 2)) &&
    wGroup.momentum >= -0.005;

  const gateResults: GateResults = {
    distributionEdge,
    colorDiversity,
    noCompetition,
    gateDigitCheck,
    winnersPressure,
    losersPressure,
  };

  const details: GateDetail[] = [
    {
      key: "distributionEdge",
      label: "Distribution Edge",
      pass: distributionEdge,
      note:
        `zone ${(winnerShare * 100).toFixed(1)}% vs fair ${(fairWinnerShare * 100).toFixed(0)}% ` +
        `(${distEdgePct >= 0 ? "+" : ""}${distEdgePct.toFixed(1)}pt) · ` +
        `${winnersAboveFair.length}/${needAboveFair} above fair` +
        (hotLosers.length
          ? ` · ⚠ hot loser${hotLosers.length > 1 ? "s" : ""} ${hotLosers.join(",")}`
          : "") +
        (!zoneOutranksLosers
          ? ` · ⚠ loser ${(maxLoserShare * 100).toFixed(1)}% tops zone avg`
          : ""),
    },

    {
      key: "colorDiversity",
      label: "Colour Diversity",
      pass: colorDiversity,
      note:
        `${buildingInWinners.length}/${opts.minBuildingWinners} coloured in zone` +
        (buildingInWinners.length ? ` (${buildingInWinners.join(",")})` : "") +
        (buildingOutsideWinners.length
          ? ` · ⚠ coloured outside zone: ${buildingOutsideWinners.join(",")}`
          : ""),
    },

    {
      key: "noCompetition",
      label: "No Competition",
      pass: noCompetition,
      note: `${losers.map((d) => `${d}:${PRESSURE_META[field.digits[d].state].label}`).join(" · ")}`,
    },
    {
      key: "gateDigitCheck",
      label: `Gate Digit ${gateDigit}`,
      pass: gateDigitCheck,
      note: `${(gd.share * 100).toFixed(1)}% · ${gd.momentum >= 0 ? "+" : ""}${(gd.momentum * 100).toFixed(2)}pt · ${PRESSURE_META[gd.state].label}`,
    },
    {
      key: "winnersPressure",
      label: "Winners Building",
      pass: winnersPressure,
      note: `${wGroup.building}/${fullWinners.length} building · mom ${(wGroup.momentum * 100).toFixed(2)}pt`,
    },
    {
      key: "losersPressure",
      label: "Losers Exhausted",
      pass: losersPressure,
      note: `${lGroup.fading}/${losers.length} fading${noRecoveringLosers ? "" : " · loser still building"}`,
    },
  ];

  const passed =
    distributionEdge &&
    colorDiversity &&
    noCompetition &&
    gateDigitCheck &&
    winnersPressure &&
    losersPressure;

  return {
    passed,
    gateResults,
    details,
    wGroup,
    lGroup,
    gateDigitShare: gd.share,
    gateDigitMomentum: gd.momentum,
    confidence: passed ? computePrecisionConfidence(id, field) : 0,
    buildingInWinners,
    buildingOutsideWinners,
    winnerShare,
    loserShare,
    distEdgePct,
    winnersAboveFair,
    hotLosers,
    blockedBy: details.filter((d) => !d.pass).map((d) => d.label),
  };
}

export function computePrecisionConfidence(id: PrecisionContractId, field: PressureField): number {
  const { keyWinners, fullWinners, losers, gateDigit } = CONTRACT_DEFS[id];
  let score = 62;

  const dominantWinners = keyWinners.filter((d) => field.digits[d].state === "dominant").length;
  const recoveringWinners = keyWinners.filter((d) => field.digits[d].state === "recovering").length;
  score += dominantWinners * 3;
  score += recoveringWinners * 1.5;

  const pv = readPressure(field, fullWinners);
  score += Math.min(12, pv.asymmetry * 14);

  const gateShare = field.digits[gateDigit].share;
  if (gateShare < 0.108) score += 4;
  if (gateShare >= 0.115) score -= 3;

  const suppressedLosers = losers.filter((d) => field.digits[d].state === "suppressed").length;
  score += suppressedLosers * 2.5;

  return Math.max(60, Math.min(98, Math.round(score)));
}
