// §54 Cross-Market Danger Engine.
//
// Flags simultaneous manipulation spikes across markets, correlated
// fluctuation, and crowding cascades. Returns a global `dangerLevel` in
// [0, 100] that acts as a gate on ALL signal publication when severe.

import type { MarketReasoning } from "./types";

export type DangerLevel = "calm" | "elevated" | "high" | "extreme";

export interface CrossMarketDanger {
  level: DangerLevel;
  score: number; // 0..100
  reasons: string[];
  /** True when signal publication should be blocked globally. */
  blockPublication: boolean;
  components: {
    manipulationSpike: number;
    correlatedFluctuation: number;
    crowdingCascade: number;
  };
}

export function assessCrossMarketDanger(markets: MarketReasoning[]): CrossMarketDanger {
  if (markets.length === 0) {
    return {
      level: "calm",
      score: 0,
      reasons: ["no markets"],
      blockPublication: false,
      components: { manipulationSpike: 0, correlatedFluctuation: 0, crowdingCascade: 0 },
    };
  }

  const manipulations = markets.map((m) => m.psychology?.manipulation ?? 0);
  const fluctuations = markets.map((m) => m.fluctuation ?? 0);
  const crowdings = markets.map((m) => m.psychology?.crowding ?? 0);

  const highManip = manipulations.filter((x) => x >= 65).length;
  const manipulationSpike = clamp01((highManip / markets.length) * 1.3) * 100;

  const meanFluc = mean(fluctuations);
  const stdFluc = std(fluctuations, meanFluc);
  // High mean AND low stddev = markets moving TOGETHER → correlated risk.
  const correlatedFluctuation = clamp01((meanFluc - 0.3) * 2.5) * clamp01(1 - stdFluc * 3) * 100;

  const highCrowd = crowdings.filter((x) => x >= 60).length;
  const crowdingCascade = clamp01((highCrowd / markets.length) * 1.2) * 100;

  const score =
    clamp01(
      (0.4 * manipulationSpike + 0.35 * correlatedFluctuation + 0.25 * crowdingCascade) / 100,
    ) * 100;

  const reasons: string[] = [];
  if (manipulationSpike > 40)
    reasons.push(`${highManip}/${markets.length} markets show manipulation ≥ 65`);
  if (correlatedFluctuation > 40)
    reasons.push(`correlated fluctuation (mean ${meanFluc.toFixed(2)}, σ ${stdFluc.toFixed(2)})`);
  if (crowdingCascade > 40)
    reasons.push(`${highCrowd}/${markets.length} markets show crowding ≥ 60`);
  if (reasons.length === 0) reasons.push("no simultaneous anomalies");

  const level: DangerLevel =
    score >= 75 ? "extreme" : score >= 55 ? "high" : score >= 30 ? "elevated" : "calm";
  return {
    level,
    score,
    reasons,
    blockPublication: level === "extreme" || level === "high",
    components: { manipulationSpike, correlatedFluctuation, crowdingCascade },
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
}
function std(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
