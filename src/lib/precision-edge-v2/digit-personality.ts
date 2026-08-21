// Digit Personality Engine — V3.
// Classifies every digit 0..9 into a live state reflecting how it is
// behaving right now vs how it has behaved over the reasoning window.
// This is *not* a prediction of the next digit; it is a description of
// each digit's current identity that other engines reason on.

import type { DigitStatistics, MarketPsychology } from "./types";

export type DigitState =
  | "Growing"
  | "Weakening"
  | "Stable"
  | "Dominant"
  | "Suppressed"
  | "Recovering"
  | "Inflated"
  | "Depressed"
  | "Manipulated"
  | "Natural";

export interface DigitPersonality {
  d: number;
  state: DigitState;
  score: number; // -1 (bearish for the digit) .. +1 (bullish for the digit)
  detail: string;
}

const FAIR = 0.1;

export function classifyDigits(stats: DigitStatistics, psy: MarketPsychology): DigitPersonality[] {
  const out: DigitPersonality[] = [];
  const manipulated = psy.manipulation >= 26;
  for (let d = 0; d < 10; d++) {
    const p = stats.pct[d];
    const rp = stats.recentPct[d];
    const pressure = rp - p;
    const anomaly = p - FAIR;
    let state: DigitState = "Natural";
    let score = 0;
    let detail = "";

    if (p >= 0.16 && pressure >= 0.015) {
      state = "Dominant";
      score = 0.9;
      detail = `over-represented (${(p * 100).toFixed(1)}%) and still rising`;
    } else if (p >= 0.15 && manipulated) {
      state = "Inflated";
      score = 0.4;
      detail = `over-represented but market shows manipulation ${psy.manipulation.toFixed(0)}%`;
    } else if (p <= 0.05 && pressure <= -0.01) {
      state = "Suppressed";
      score = -0.9;
      detail = `under-represented (${(p * 100).toFixed(1)}%) and still fading`;
    } else if (p <= 0.06 && manipulated) {
      state = "Depressed";
      score = -0.4;
      detail = `chronically low while manipulation elevated`;
    } else if (pressure >= 0.02) {
      state = "Growing";
      score = 0.55;
      detail = `probability migrating in (+${(pressure * 100).toFixed(1)} pts)`;
    } else if (pressure <= -0.02) {
      state = "Weakening";
      score = -0.55;
      detail = `probability draining out (${(pressure * 100).toFixed(1)} pts)`;
    } else if (Math.abs(anomaly) < 0.02 && Math.abs(pressure) < 0.008) {
      state = "Stable";
      score = 0;
      detail = `holding fair share`;
    } else if (p < FAIR && pressure > 0.008) {
      state = "Recovering";
      score = 0.3;
      detail = `climbing back toward fair share`;
    } else if (manipulated && Math.abs(anomaly) >= 0.04) {
      state = "Manipulated";
      score = anomaly > 0 ? 0.2 : -0.2;
      detail = `anomalous share under manipulation flag`;
    } else {
      state = "Natural";
      score = pressure * 6;
      detail = `natural behaviour`;
    }
    out.push({ d, state, score, detail });
  }
  return out;
}

export function groupStrength(personalities: DigitPersonality[], digits: number[]): number {
  if (digits.length === 0) return 0;
  return digits.reduce((a, d) => a + personalities[d].score, 0) / digits.length;
}
