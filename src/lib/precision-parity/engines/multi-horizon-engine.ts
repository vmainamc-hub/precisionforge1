// Precision Parity AI — Multi-Horizon Agreement Engine.
// Evaluates parity alignment across short (W20), medium (W50, W120), and long (W500) horizons.
// Disagreement between horizons automatically downgrades confidence or vetoes the signal.

import type { ParityStatsEngineResult } from "./stats-engine";

export interface MultiHorizonResult {
  isAligned: boolean;
  shortHorizonSide: "EVEN" | "ODD" | "NEUTRAL";
  mediumHorizonSide: "EVEN" | "ODD" | "NEUTRAL";
  longHorizonSide: "EVEN" | "ODD" | "NEUTRAL";
  consensusSide: "EVEN" | "ODD" | "NEUTRAL";
  agreementScore: number; // 0..100
  horizonDivergencePenalty: number; // points to subtract from confidence
  summary: string;
}

export function runMultiHorizonEngine(stats: ParityStatsEngineResult): MultiHorizonResult {
  const w20 = stats.windows[20];
  const w50 = stats.windows[50];
  const w120 = stats.windows[120];
  const w500 = stats.windows[500];

  const shortSide = w20
    ? w20.evenRate > 0.52
      ? "EVEN"
      : w20.oddRate > 0.52
        ? "ODD"
        : "NEUTRAL"
    : "NEUTRAL";
  const medSide = w50
    ? w50.evenRate > 0.51
      ? "EVEN"
      : w50.oddRate > 0.51
        ? "ODD"
        : "NEUTRAL"
    : "NEUTRAL";
  const longSide = w500
    ? w500.evenRate > 0.505
      ? "EVEN"
      : w500.oddRate > 0.505
        ? "ODD"
        : "NEUTRAL"
    : w120
      ? w120.evenRate > 0.51
        ? "EVEN"
        : w120.oddRate > 0.51
          ? "ODD"
          : "NEUTRAL"
      : "NEUTRAL";

  let evenVotes = 0;
  let oddVotes = 0;
  if (shortSide === "EVEN") evenVotes += 1.5;
  else if (shortSide === "ODD") oddVotes += 1.5;

  if (medSide === "EVEN") evenVotes += 2.0;
  else if (medSide === "ODD") oddVotes += 2.0;

  if (longSide === "EVEN") evenVotes += 1.0;
  else if (longSide === "ODD") oddVotes += 1.0;

  let consensusSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
  if (evenVotes > oddVotes && evenVotes >= 2.5) consensusSide = "EVEN";
  else if (oddVotes > evenVotes && oddVotes >= 2.5) consensusSide = "ODD";

  // Check alignment
  const isAligned =
    (shortSide === medSide && medSide !== "NEUTRAL") ||
    (medSide === longSide && medSide !== "NEUTRAL");

  let divergencePenalty = 0;
  let agreementScore = 50;

  if (shortSide !== "NEUTRAL" && medSide !== "NEUTRAL" && shortSide !== medSide) {
    // Direct contradiction between short and medium
    divergencePenalty = 15;
    agreementScore = 25;
  } else if (isAligned) {
    divergencePenalty = 0;
    agreementScore = 90;
  } else {
    divergencePenalty = 6;
    agreementScore = 60;
  }

  const summary = `Horizons: Short(${shortSide}) · Medium(${medSide}) · Long(${longSide}) -> ${isAligned ? "ALIGNED" : `DIVERGENT (-${divergencePenalty}pts)`}`;

  return {
    isAligned,
    shortHorizonSide: shortSide,
    mediumHorizonSide: medSide,
    longHorizonSide: longSide,
    consensusSide,
    agreementScore,
    horizonDivergencePenalty: divergencePenalty,
    summary,
  };
}
