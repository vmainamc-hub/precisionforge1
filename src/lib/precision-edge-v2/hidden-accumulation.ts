// §108 Hidden Accumulation Model.
//
// Silent-buildup detector. When a market appears superficially calm — no
// obvious streak or crowding — but multiple secondary signals conspire
// (rotation speed, clustering variance, zone drift, and pressure divergence)
// pressure is quietly building toward one side. This module returns a 0–100
// score plus a plain-English narrative. The score wires into
// `ContractVerdict.supports` when > 60.

import type { DigitStatistics, MarketPsychology } from "./types";

export interface HiddenAccumulationScore {
  /** 0..100 total silent-buildup score. */
  score: number;
  /** Component contributions (0..100 each). */
  components: {
    rotationSpeed: number;
    clusteringVariance: number;
    zoneDrift: number;
    pressureDivergence: number;
  };
  /** Which side is quietly accumulating, if any. */
  side: "OVER" | "UNDER" | null;
  /** Narrative safe to append to `ContractVerdict.supports`. */
  narrative: string;
  /** Convenience: true when score > 60. */
  significant: boolean;
}

/**
 * Compute the hidden-accumulation score for a market given its digit stats
 * and psychology. All inputs already exist on `MarketReasoning`.
 */
export function scoreHiddenAccumulation(
  stats: DigitStatistics,
  psy: MarketPsychology,
): HiddenAccumulationScore {
  // ── 1. Rotation speed: how quickly winners cycle through digits.
  // High rotation with LOW crowding = quiet distribution → silent build.
  const rotation = rotationSpeed(stats.digits.slice(-30));
  const rotationSpeedScore = clamp01(rotation * (1 - psy.crowding / 100)) * 100;

  // ── 2. Clustering variance: variance of digit-pct across zone A vs B.
  // Rising variance while entropy stays high = uneven buildup under the hood.
  const zoneA = stats.pct.slice(0, 5).reduce((a, x) => a + x, 0);
  const zoneB = stats.pct.slice(5).reduce((a, x) => a + x, 0);
  const clustering = Math.abs(zoneA - zoneB); // 0..1
  const clusteringVarianceScore = clamp01(clustering * (psy.entropyNorm > 0.75 ? 2 : 1)) * 100;

  // ── 3. Zone drift: recent share − window share by zone.
  const recentZoneA = stats.recentPct.slice(0, 5).reduce((a, x) => a + x, 0);
  const recentZoneB = stats.recentPct.slice(5).reduce((a, x) => a + x, 0);
  const driftA = recentZoneA - zoneA;
  const driftB = recentZoneB - zoneB;
  const drift = Math.max(Math.abs(driftA), Math.abs(driftB));
  const zoneDriftScore = clamp01(drift * 5) * 100;

  // ── 4. Pressure divergence: sum of per-digit |pressure| but only where
  //     manipulation is LOW (i.e. clean, un-crowded).
  const pressureSum = stats.profiles.reduce((a, p) => a + Math.abs(p.pressure), 0);
  const cleanFactor = 1 - psy.manipulation / 100;
  const pressureDivergenceScore = clamp01(pressureSum * cleanFactor * 3) * 100;

  const score =
    clamp01(
      (0.3 * rotationSpeedScore +
        0.2 * clusteringVarianceScore +
        0.25 * zoneDriftScore +
        0.25 * pressureDivergenceScore) /
        100,
    ) * 100;

  // Which side is building?  Sign of (recent high-digit share − low share).
  const overBuild = recentZoneB - zoneB;
  const underBuild = recentZoneA - zoneA;
  const side: "OVER" | "UNDER" | null =
    Math.abs(overBuild - underBuild) < 0.01 ? null : overBuild > underBuild ? "OVER" : "UNDER";

  const narrative = buildNarrative(score, side, {
    rotationSpeedScore,
    clusteringVarianceScore,
    zoneDriftScore,
    pressureDivergenceScore,
  });

  return {
    score,
    components: {
      rotationSpeed: rotationSpeedScore,
      clusteringVariance: clusteringVarianceScore,
      zoneDrift: zoneDriftScore,
      pressureDivergence: pressureDivergenceScore,
    },
    side,
    narrative,
    significant: score > 60,
  };
}

function rotationSpeed(digits: number[]): number {
  if (digits.length < 2) return 0;
  let changes = 0;
  for (let i = 1; i < digits.length; i++) if (digits[i] !== digits[i - 1]) changes++;
  return changes / (digits.length - 1);
}

function buildNarrative(
  score: number,
  side: "OVER" | "UNDER" | null,
  c: {
    rotationSpeedScore: number;
    clusteringVarianceScore: number;
    zoneDriftScore: number;
    pressureDivergenceScore: number;
  },
): string {
  if (score < 40) {
    return "Distribution is genuinely quiet — no hidden accumulation detected.";
  }
  const parts: string[] = [];
  if (c.rotationSpeedScore > 55) parts.push("fast rotation without crowding");
  if (c.clusteringVarianceScore > 55) parts.push("uneven zone clustering under high entropy");
  if (c.zoneDriftScore > 55) parts.push("recent-window zone drift");
  if (c.pressureDivergenceScore > 55) parts.push("clean per-digit pressure divergence");
  const sideLabel = side ? ` toward the ${side} side` : "";
  return `Hidden accumulation (${score.toFixed(0)}/100)${sideLabel} — ${parts.join(", ") || "multiple secondary signals converging"}.`;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
