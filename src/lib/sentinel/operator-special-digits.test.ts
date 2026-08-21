import { describe, expect, it } from "vitest";
import { operatorSpecialDigitAction } from "./operator-special-digits";
import type { DigitIntel } from "../apex/digit-intel";

function intelWith(digit: number, patch: Record<string, number>): DigitIntel {
  const profiles: Record<number, unknown> = {};
  for (let d = 0; d <= 9; d++) {
    profiles[d] = {
      digit: d,
      windowShare: [],
      windowN: [],
      baseline: 0.1,
      fast: 0.1,
      medium: 0.1,
      frequencyVelocity: 0,
      frequencyAcceleration: 0,
      pressure: 0,
      pressureVelocity: 0,
      pressureAcceleration: 0,
      consecutive: 0,
      clusterDensity: 1,
      recurrenceInterval: 10,
      expectedInterval: 10,
      sinceSeen: 3,
      historicalPercentile: 50,
      transitionInflow: 0.1,
      exhaustion: 0,
      recovery: 0,
      anomaly: 0,
      state: "STABLE",
      ...(d === digit ? patch : {}),
    };
  }
  return { profiles } as unknown as DigitIntel;
}

const ABNORMAL = {
  fast: 0.24,
  medium: 0.12,
  pressure: 0.14,
  pressureAcceleration: 0.02,
  frequencyVelocity: 0.12,
  clusterDensity: 2.4,
  consecutive: 3,
  transitionInflow: 0.3,
  anomaly: 90,
  historicalPercentile: 97,
};

describe("operator special-digit action", () => {
  it("penalises abnormal digit-1 action on an Over contract", () => {
    const r = operatorSpecialDigitAction("OVER", [3, 4, 5, 6, 7, 8, 9], intelWith(1, ABNORMAL));
    expect(r.digit).toBe(1);
    expect(r.state).toBe("ABNORMAL");
    expect(r.rankingDelta).toBeLessThan(0);
    expect(r.rankingDelta).toBeGreaterThanOrEqual(-6);
  });

  it("penalises abnormal digit-8 action on an Under contract", () => {
    const r = operatorSpecialDigitAction("UNDER", [0, 1, 2, 3, 4, 5, 6], intelWith(8, ABNORMAL));
    expect(r.digit).toBe(8);
    expect(r.rankingDelta).toBeLessThan(0);
  });

  it("applies little or no penalty for normal activity", () => {
    const r = operatorSpecialDigitAction("OVER", [3, 4, 5, 6, 7, 8, 9], intelWith(1, {}));
    expect(r.state).toBe("NORMAL");
    expect(r.rankingDelta).toBe(0);
  });

  it("never blocks — the penalty stays bounded", () => {
    const r = operatorSpecialDigitAction(
      "OVER",
      [3, 4, 5, 6, 7, 8, 9],
      intelWith(1, { ...ABNORMAL, pressure: 5, anomaly: 100, consecutive: 20 }),
    );
    expect(r.rankingDelta).toBeGreaterThanOrEqual(-6);
  });

  it("does not penalise when the watched digit wins the contract", () => {
    const r = operatorSpecialDigitAction(
      "UNDER",
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      intelWith(8, ABNORMAL),
    );
    expect(r.onLosingSide).toBe(false);
    expect(r.rankingDelta).toBe(0);
  });

  it("stays neutral when the digit is unmeasured", () => {
    const r = operatorSpecialDigitAction("OVER", [3, 4, 5], null);
    expect(r.state).toBe("UNMEASURED");
    expect(r.rankingDelta).toBe(0);
  });
});
