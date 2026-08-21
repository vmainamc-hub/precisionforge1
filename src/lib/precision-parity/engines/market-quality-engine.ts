// Precision Parity AI — Market Quality & Feed Integrity Engine.
// Evaluates tick arrival consistency, timestamp gaps, stale ticks, and data drops.
// A degraded or frozen feed results in a hard VETO to protect capital.

import type { Tick } from "@/lib/analytics";

export interface MarketQualityResult {
  isFeedClean: boolean;
  isHardVeto: boolean;
  staleTickCount: number;
  averageIntervalMs: number;
  maxIntervalMs: number;
  qualityScore: number; // 0..100
  vetoReason: string | null;
  summary: string;
}

export function runMarketQualityEngine(
  ticks: Tick[],
  maxAcceptableGapMs: number = 6000,
): MarketQualityResult {
  const n = ticks.length;
  if (n < 5) {
    return {
      isFeedClean: false,
      isHardVeto: true,
      staleTickCount: 0,
      averageIntervalMs: 0,
      maxIntervalMs: 0,
      qualityScore: 20,
      vetoReason: "Feed initializing: fewer than 5 ticks received",
      summary: "Insufficient ticks for feed quality audit",
    };
  }

  const sample = ticks.slice(-30);
  let totalInterval = 0;
  let maxInterval = 0;
  let staleCount = 0;
  let duplicateCount = 0;

  for (let i = 1; i < sample.length; i++) {
    const tPrev = sample[i - 1].t;
    const tCurr = sample[i].t;
    const dt = tCurr - tPrev;

    if (dt <= 0) duplicateCount++;
    else {
      totalInterval += dt;
      if (dt > maxInterval) maxInterval = dt;
    }

    if (dt > maxAcceptableGapMs) {
      staleCount++;
    }
  }

  const avgInterval = sample.length > 1 ? totalInterval / (sample.length - 1) : 1000;
  const nowSec = Date.now() / 1000;
  const lastTickSec = sample[sample.length - 1].t;
  const currentLagSec = Math.max(0, nowSec - lastTickSec);

  let qualityScore = 100;
  let isHardVeto = false;
  let vetoReason: string | null = null;

  if (currentLagSec > 10) {
    isHardVeto = true;
    vetoReason = `Feed frozen: last tick arrived ${currentLagSec.toFixed(1)}s ago`;
    qualityScore = 0;
  } else if (staleCount >= 2) {
    isHardVeto = true;
    vetoReason = `Feed dropped: ${staleCount} excessive tick gaps observed`;
    qualityScore = 30;
  } else if (duplicateCount >= 5) {
    isHardVeto = true;
    vetoReason = "Duplicate timestamp bursts detected in feed";
    qualityScore = 40;
  } else {
    qualityScore = Math.max(
      50,
      Math.min(100, 100 - (maxInterval > 2500 ? 20 : 0) - duplicateCount * 5),
    );
  }

  const isFeedClean = !isHardVeto && qualityScore >= 70;
  const summary = isFeedClean
    ? `Feed Clean (Score ${qualityScore}/100, dt_avg=${(avgInterval / 1000).toFixed(2)}s)`
    : `Feed Degraded: ${vetoReason ?? `Score ${qualityScore}/100`}`;

  return {
    isFeedClean,
    isHardVeto,
    staleTickCount: staleCount,
    averageIntervalMs: avgInterval,
    maxIntervalMs: maxInterval,
    qualityScore,
    vetoReason,
    summary,
  };
}
