// Precision Parity AI — Adversarial Danger & Threat Engine.
// Independent checker that vetoes otherwise high-confluence signals if structural traps or regime risks are detected.

import type { ParityRunEngineResult } from "./run-hazard-engine";
import type { ParityChangepointResult } from "./changepoint-engine";
import type { ParityEntropyResult } from "./entropy-engine";
import type { MarketQualityResult } from "./market-quality-engine";
import type { MultiHorizonResult } from "./multi-horizon-engine";

export interface ParityThreat {
  engine: string;
  severity: "CRITICAL_VETO" | "WARNING";
  reason: string;
}

export interface ParityDangerResult {
  hasCriticalVeto: boolean;
  threats: ParityThreat[];
  vetoReasons: string[];
  dangerScore: number; // 0..100
  summary: string;
}

export function runParityDangerEngine(
  targetSide: "EVEN" | "ODD",
  ticksLength: number,
  runEngine: ParityRunEngineResult,
  changepoint: ParityChangepointResult,
  entropy: ParityEntropyResult,
  quality: ParityQualityEngineResultWrapper,
  multiHorizon: MultiHorizonResult,
): ParityDangerResult {
  const threats: ParityThreat[] = [];

  // 1. Feed Integrity Check
  if (quality.isHardVeto) {
    threats.push({
      engine: "Market Quality",
      severity: "CRITICAL_VETO",
      reason: quality.vetoReason || "Feed degraded or frozen",
    });
  }

  // 2. Sample Depth Check
  if (ticksLength < 50) {
    threats.push({
      engine: "Sample Depth",
      severity: "CRITICAL_VETO",
      reason: `Insufficient tick history (N=${ticksLength}, minimum 50 required)`,
    });
  }

  // 3. High Shannon Entropy Veto
  if (entropy.isHighEntropyVeto) {
    threats.push({
      engine: "Entropy Engine",
      severity: "CRITICAL_VETO",
      reason: `Stream indistinguishable from uniform noise (Entropy ${(entropy.aggregateEntropy * 100).toFixed(1)}%)`,
    });
  }

  // 4. Fresh Changepoint Trap
  if (changepoint.hasChangepoint && changepoint.changepointTickAge <= 5) {
    threats.push({
      engine: "Changepoint Detector",
      severity: "CRITICAL_VETO",
      reason: `Regime shift detected ${changepoint.changepointTickAge} ticks ago — market in transient flux`,
    });
  }

  // 5. Extended Streak Trap (Attempting to enter the same side at run length >= 6)
  if (runEngine.activeSide === targetSide && runEngine.activeLength >= 6) {
    threats.push({
      engine: "Run Hazard",
      severity: "CRITICAL_VETO",
      reason: `Late-streak exhaustion trap: active ${targetSide} run reached ${runEngine.activeLength} ticks (P(break)=${(runEngine.pBreakNextTick * 100).toFixed(0)}%)`,
    });
  }

  // 6. Multi-Horizon Severe Conflict
  if (multiHorizon.horizonDivergencePenalty >= 15) {
    threats.push({
      engine: "Multi-Horizon Agreement",
      severity: "WARNING",
      reason: `Short-term (${multiHorizon.shortHorizonSide}) directly opposes medium-term trend (${multiHorizon.mediumHorizonSide})`,
    });
  }

  const criticalVetoes = threats.filter((t) => t.severity === "CRITICAL_VETO");
  const hasCriticalVeto = criticalVetoes.length > 0;
  const vetoReasons = criticalVetoes.map((v) => `${v.engine}: ${v.reason}`);

  const dangerScore = Math.min(
    100,
    criticalVetoes.length * 40 + threats.filter((t) => t.severity === "WARNING").length * 15,
  );

  const summary = hasCriticalVeto
    ? `DANGER VETO (${criticalVetoes.length} critical blocks): ${vetoReasons.join("; ")}`
    : threats.length > 0
      ? `Threats monitored (${threats.length} advisories)`
      : "No adversarial threats identified";

  return {
    hasCriticalVeto,
    threats,
    vetoReasons,
    dangerScore,
    summary,
  };
}

export type ParityQualityEngineResultWrapper = MarketQualityResult;
