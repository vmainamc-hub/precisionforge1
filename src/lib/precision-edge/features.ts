// Feature Extraction Layer — pure functions over rolling windows.
// Shared once per evaluation cycle across every analytical engine.
import type { FeatureBundle, Tick, MarketDNA } from "./types";
import { digit } from "./rolling-store";

export function extractFeatures(ticks: Tick[], windowSize: number, dna?: MarketDNA): FeatureBundle {
  const win = ticks.slice(-windowSize);
  const digits = win.map((t) => digit(t.price));
  const freq = new Array(10).fill(0);
  digits.forEach((d) => freq[d]++);
  const total = Math.max(1, digits.length);
  const pct = freq.map((f) => f / total);

  const missing = pct.map((p, i) => (p === 0 ? i : -1)).filter((v) => v >= 0);
  const sorted = pct.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  const dominant = sorted.slice(0, 3).map((x) => x.i);
  const weak = [...sorted]
    .reverse()
    .slice(0, 3)
    .map((x) => x.i);

  // Entropy
  const entropy = -pct.reduce((a, p) => (p > 0 ? a + p * Math.log2(p) : a), 0);
  const entropyNorm = entropy / Math.log2(10);

  // Skewness of digit distribution
  const mean = pct.reduce((a, p, i) => a + p * i, 0);
  const variance = pct.reduce((a, p, i) => a + p * (i - mean) ** 2, 0);
  const std = Math.sqrt(variance) || 1e-9;
  const skewness = pct.reduce((a, p, i) => a + p * ((i - mean) / std) ** 3, 0);

  // Odd/Even & Zones
  const oddPct = digits.filter((d) => d % 2).length / total;
  const evenPct = 1 - oddPct;
  const zoneA = digits.filter((d) => d <= 4).length / total;
  const zoneB = 1 - zoneA;

  // Green / Red — price direction
  let green = 0,
    red = 0;
  for (let i = 1; i < win.length; i++) {
    if (win[i].price > win[i - 1].price) green++;
    else if (win[i].price < win[i - 1].price) red++;
  }
  const dirTotal = Math.max(1, green + red);
  const greenPct = green / dirTotal;
  const redPct = red / dirTotal;

  // Momentum / acceleration on price returns
  const rets: number[] = [];
  for (let i = 1; i < win.length; i++) rets.push(Math.log(win[i].price / win[i - 1].price));
  const halfMom = rets.slice(-Math.floor(rets.length / 2));
  const momentumRaw = halfMom.reduce((a, b) => a + b, 0);
  const momentum = Math.tanh(momentumRaw * 500);
  const accHalf =
    halfMom.length >= 2
      ? halfMom.slice(-Math.floor(halfMom.length / 2)).reduce((a, b) => a + b, 0) -
        halfMom.slice(0, Math.floor(halfMom.length / 2)).reduce((a, b) => a + b, 0)
      : 0;
  const acceleration = Math.tanh(accHalf * 800);

  // Velocity — digits per second
  const dtSec = Math.max(1, (win[win.length - 1]?.t ?? 0) - (win[0]?.t ?? 0)) / 1000;
  const velocity = digits.length / dtSec;

  // Tick consistency: 1 - variance of inter-tick intervals normalised
  const intervals: number[] = [];
  for (let i = 1; i < win.length; i++) intervals.push(win[i].t - win[i - 1].t);
  const iMean = intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);
  const iVar = intervals.reduce((a, b) => a + (b - iMean) ** 2, 0) / Math.max(1, intervals.length);
  const tickConsistency = 1 / (1 + Math.sqrt(iVar) / Math.max(1, iMean));

  // Distribution stability: compare first vs second half frequencies
  const halfLen = Math.floor(digits.length / 2);
  const f1 = new Array(10).fill(0),
    f2 = new Array(10).fill(0);
  for (let i = 0; i < halfLen; i++) f1[digits[i]]++;
  for (let i = halfLen; i < digits.length; i++) f2[digits[i]]++;
  const n1 = Math.max(1, halfLen),
    n2 = Math.max(1, digits.length - halfLen);
  const tvd = 0.5 * f1.reduce((a, v, i) => a + Math.abs(v / n1 - f2[i] / n2), 0);
  const distributionStability = 1 - Math.min(1, tvd);

  // Historical deviation vs DNA
  let historicalDeviation = 0;
  if (dna && dna.samples > 0) {
    historicalDeviation =
      0.5 * pct.reduce((a, p, i) => a + Math.abs(p - dna.meanDistribution[i]), 0);
    historicalDeviation = Math.min(1, historicalDeviation);
  }

  // Digit rotation: how often dominant digit changes across sub-windows
  const sub = 5;
  const chunkLen = Math.max(5, Math.floor(digits.length / sub));
  let rotations = 0;
  let prevDom = -1;
  for (let s = 0; s < sub; s++) {
    const start = s * chunkLen;
    const end = Math.min(digits.length, start + chunkLen);
    if (end - start < 3) continue;
    const cf = new Array(10).fill(0);
    for (let i = start; i < end; i++) cf[digits[i]]++;
    const dom = cf.indexOf(Math.max(...cf));
    if (prevDom !== -1 && dom !== prevDom) rotations++;
    prevDom = dom;
  }
  const digitRotation = rotations / Math.max(1, sub - 1);

  // Digit pressure & velocity — recent 20 vs baseline
  const recent = digits.slice(-Math.min(20, digits.length));
  const rf = new Array(10).fill(0);
  recent.forEach((d) => rf[d]++);
  const rTotal = Math.max(1, recent.length);
  const digitPressure = rf.map((f, i) => f / rTotal - pct[i]);
  const digitVelocity = digitPressure.map((p) => Math.tanh(p * 5));

  return {
    ticks: win,
    windowSize,
    digits,
    freq,
    pct,
    missing,
    dominant,
    weak,
    entropy,
    entropyNorm,
    skewness,
    oddPct,
    evenPct,
    greenPct,
    redPct,
    momentum,
    acceleration,
    velocity,
    tickConsistency,
    distributionStability,
    historicalDeviation,
    zoneA,
    zoneB,
    digitRotation,
    digitPressure,
    digitVelocity,
    lastDigit: digits[digits.length - 1] ?? 0,
    timestamp: win[win.length - 1]?.t ?? Date.now(),
  };
}
