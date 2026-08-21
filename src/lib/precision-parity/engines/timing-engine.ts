// Precision Parity AI — Entry Timing Engine.
// Determines not just *what* to trade, but *when* and *under what condition*.
// Outputs: 'NOW' | 'NEXT_TICK' | 'AFTER_RUN_BREAK' | 'ON_PULLBACK' | 'WAIT' with human-sentence condition and expiresInTicks.

import type { ParityRunEngineResult } from "./run-hazard-engine";
import type { ParityPressureResult } from "./pressure-engine";

export type EntryTimingType = "NOW" | "NEXT_TICK" | "AFTER_RUN_BREAK" | "ON_PULLBACK" | "WAIT";

export interface ParityTimingResult {
  timing: EntryTimingType;
  condition: string; // plain English actionable instruction
  expiresInTicks: number;
  urgency: "HIGH" | "MEDIUM" | "PATIENT";
  summary: string;
}

export function runParityTimingEngine(
  targetSide: "EVEN" | "ODD",
  runEngine: ParityRunEngineResult,
  pressureEngine: ParityPressureResult,
  isConfluenceReady: boolean,
): ParityTimingResult {
  if (!isConfluenceReady) {
    return {
      timing: "WAIT",
      condition: "Wait for multi-engine confluence and EV gate clearance",
      expiresInTicks: 10,
      urgency: "PATIENT",
      summary: "WAIT — awaiting confluence alignment",
    };
  }

  const oppositeSide = targetSide === "EVEN" ? "ODD" : "EVEN";

  // Scenario 1: Currently in an extended opposite run (e.g. want EVEN, but currently in 4+ ODD run)
  if (runEngine.activeSide === oppositeSide && runEngine.activeLength >= 3) {
    return {
      timing: "AFTER_RUN_BREAK",
      condition: `Enter ${targetSide} on the next tick immediately after the current ${oppositeSide.toLowerCase()} run of ${runEngine.activeLength} breaks`,
      expiresInTicks: Math.min(8, Math.max(3, 8 - runEngine.activeLength)),
      urgency: "HIGH",
      summary: `AFTER_RUN_BREAK — waiting for ${oppositeSide} run (${runEngine.activeLength}) to terminate`,
    };
  }

  // Scenario 2: Extended target run (already ran 4+ in our direction) -> risk of mean-reversion trap
  if (runEngine.activeSide === targetSide && runEngine.activeLength >= 4) {
    return {
      timing: "ON_PULLBACK",
      condition: `Wait for a 1-tick ${oppositeSide.toLowerCase()} pullback before entering continuation ${targetSide}`,
      expiresInTicks: 5,
      urgency: "MEDIUM",
      summary: `ON_PULLBACK — target ${targetSide} extended (${runEngine.activeLength} ticks), wait for pullback`,
    };
  }

  // Scenario 3: Fresh start (length 1 or 2 in target direction, or just broke opposite run)
  if (runEngine.activeSide === targetSide && runEngine.activeLength <= 2) {
    return {
      timing: "NEXT_TICK",
      condition: `Enter ${targetSide} on the next tick immediately to capture emerging ${targetSide.toLowerCase()} momentum`,
      expiresInTicks: 3,
      urgency: "HIGH",
      summary: `NEXT_TICK — prime entry on early ${targetSide} momentum`,
    };
  }

  // Scenario 4: Extreme pressure stretch requiring mean-reversion
  if (
    pressureEngine.stretchedState === "EXTREME_STRETCH" &&
    pressureEngine.favouredMeanReversion === targetSide
  ) {
    return {
      timing: "NOW",
      condition: `Enter ${targetSide} immediately to trade extreme statistical imbalance reversion (z=${pressureEngine.zScore.toFixed(2)})`,
      expiresInTicks: 4,
      urgency: "HIGH",
      summary: "NOW — extreme imbalance reversion entry",
    };
  }

  // Default clean entry
  return {
    timing: "NEXT_TICK",
    condition: `Enter ${targetSide} on next tick confirmation`,
    expiresInTicks: 4,
    urgency: "MEDIUM",
    summary: `NEXT_TICK — enter ${targetSide}`,
  };
}
