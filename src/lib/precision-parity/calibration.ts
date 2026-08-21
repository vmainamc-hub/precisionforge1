// Phase 6 — Regime-Conditional Calibration with Hierarchical Shrinkage
// Keys reliability by (market, regime, hiddenRegime) with 10-bin reliability curve, Brier score, and ECE.

import { listParityJournal, type ParityJournalEntry } from "./journal";
import type { MarketRegime, HiddenRegime } from "./types";

export interface ReliabilityBin {
  bin: number; // 0..9 (representing 0.0-0.1 up to 0.9-1.0)
  claimed: number;
  actual: number;
  count: number;
}

export interface ContextCalibrationResult {
  delta: number;
  sampleSize: number;
  brier: number;
  ece: number; // Expected Calibration Error
  reliabilityCurve: ReliabilityBin[];
  shrinkageWeight: number; // 0..1 weight given to the specific context bucket
  narrative: string;
}

export interface ParityCalibrationResult {
  delta: number;
  sampleSize: number;
  hitRate: number;
  meanConfidence: number;
  narrative: string;
}

const MIN_BUCKET_SAMPLES = 15;
const LARGE_BUCKET_SAMPLES = 60;
const BASE_CAP = 15;
const WIDE_CAP = 20;

function computeReliabilityCurve(entries: ParityJournalEntry[]): {
  curve: ReliabilityBin[];
  brier: number;
  ece: number;
  hitRate: number;
  meanClaimed: number;
} {
  const bins: { claimedSum: number; winSum: number; count: number }[] = Array.from(
    { length: 10 },
    () => ({ claimedSum: 0, winSum: 0, count: 0 }),
  );

  let totalBrier = 0;
  let totalWins = 0;
  let totalClaimed = 0;

  for (const e of entries) {
    const y = e.outcome === "win" ? 1 : 0;
    totalBrier += (e.pModel - y) ** 2;
    totalWins += y;
    totalClaimed += e.pModel;

    const binIdx = Math.min(9, Math.max(0, Math.floor(e.pModel * 10)));
    bins[binIdx].claimedSum += e.pModel;
    bins[binIdx].winSum += y;
    bins[binIdx].count++;
  }

  const n = entries.length;
  const brier = n > 0 ? totalBrier / n : 0.25;
  const hitRate = n > 0 ? totalWins / n : 0.5;
  const meanClaimed = n > 0 ? totalClaimed / n : 0.5;

  let ece = 0;
  const curve: ReliabilityBin[] = bins.map((b, idx) => {
    const claimed = b.count > 0 ? b.claimedSum / b.count : (idx + 0.5) / 10;
    const actual = b.count > 0 ? b.winSum / b.count : (idx + 0.5) / 10;
    if (n > 0 && b.count > 0) {
      ece += (b.count / n) * Math.abs(claimed - actual);
    }
    return {
      bin: idx,
      claimed,
      actual,
      count: b.count,
    };
  });

  return { curve, brier, ece, hitRate, meanClaimed };
}

export function parityCalibrationForContext(
  market: string,
  regime: MarketRegime = "STABLE",
  hiddenRegime: HiddenRegime = "BALANCED",
  entries: ParityJournalEntry[] = listParityJournal(),
): ContextCalibrationResult {
  const decided = entries.filter((e) => e.outcome === "win" || e.outcome === "loss");

  // 1. Global level
  const globalStats = computeReliabilityCurve(decided);

  // 2. Market level
  const marketDecided = decided.filter((e) => e.market === market);
  const marketStats = computeReliabilityCurve(marketDecided);

  // 3. (Market, Regime) bucket level
  // Note: We match entries with matching metadata if available
  const bucketDecided = marketDecided.filter(
    (e) => (e as any).regime === regime || (e as any).hiddenRegime === hiddenRegime,
  );
  const targetSamples = bucketDecided.length > 0 ? bucketDecided : marketDecided;
  const bucketStats = computeReliabilityCurve(targetSamples);

  const sampleSize = targetSamples.length;

  // Hierarchical shrinkage:
  // wBucket = min(1, sampleSize / MIN_BUCKET_SAMPLES)
  // wMarket = min(1, marketDecided.length / MIN_BUCKET_SAMPLES)
  const wBucket = Math.min(1, sampleSize / MIN_BUCKET_SAMPLES);
  const wMarket = Math.min(1, marketDecided.length / MIN_BUCKET_SAMPLES);

  const gapBucket = bucketStats.hitRate - bucketStats.meanClaimed;
  const gapMarket = marketStats.hitRate - marketStats.meanClaimed;
  const gapGlobal = globalStats.hitRate - globalStats.meanClaimed;

  // Hierarchical shrink
  const shrunkGap =
    wBucket * gapBucket + (1 - wBucket) * (wMarket * gapMarket + (1 - wMarket) * gapGlobal);

  const cap = sampleSize >= LARGE_BUCKET_SAMPLES ? WIDE_CAP : BASE_CAP;
  const delta = Math.max(-cap, Math.min(cap, shrunkGap * 40));

  const blendedBrier = wBucket * bucketStats.brier + (1 - wBucket) * marketStats.brier;
  const blendedECE = wBucket * bucketStats.ece + (1 - wBucket) * marketStats.ece;

  const narrative =
    sampleSize >= MIN_BUCKET_SAMPLES
      ? `Calibrated for context [${market} / ${regime} / ${hiddenRegime}] (N=${sampleSize}, Brier: ${blendedBrier.toFixed(3)}, ECE: ${(blendedECE * 100).toFixed(1)}%). Delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pts.`
      : `Hierarchical shrinkage active (bucket N=${sampleSize}, shrunk to market/global). Delta: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pts.`;

  return {
    delta,
    sampleSize,
    brier: blendedBrier,
    ece: blendedECE,
    reliabilityCurve: bucketStats.curve,
    shrinkageWeight: wBucket,
    narrative,
  };
}

export function parityCalibrationForMarket(
  market: string,
  entries: ParityJournalEntry[] = listParityJournal(),
): ParityCalibrationResult {
  const res = parityCalibrationForContext(market, "STABLE", "BALANCED", entries);
  const hit =
    res.reliabilityCurve.reduce((a, b) => a + b.actual * b.count, 0) / Math.max(1, res.sampleSize);
  const meanConf =
    res.reliabilityCurve.reduce((a, b) => a + b.claimed * b.count, 0) / Math.max(1, res.sampleSize);
  return {
    delta: res.delta,
    sampleSize: res.sampleSize,
    hitRate: hit,
    meanConfidence: meanConf,
    narrative: res.narrative,
  };
}

export function calibrateParityConfidence(
  claimedPct: number,
  market: string,
  regime: MarketRegime = "STABLE",
  hiddenRegime: HiddenRegime = "BALANCED",
  entries?: ParityJournalEntry[],
): { calibrated: number; result: ContextCalibrationResult } {
  const result = parityCalibrationForContext(market, regime, hiddenRegime, entries);
  const calibrated = Math.max(0, Math.min(100, claimedPct + result.delta));
  return { calibrated, result };
}
