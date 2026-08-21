import { describe, expect, it } from "vitest";
import { computeStakeSizing } from "./stake-sizing";

describe("STAKE_SIZING (fractional Kelly)", () => {
  it("recommends zero stake when calibration is insufficient", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.7,
      reliabilityState: "INSUFFICIENT CALIBRATION DATA",
      sampleSize: 4,
      payoutRatio: 0.95,
    });
    expect(r.guard).toBe("INSUFFICIENT_CALIBRATION");
    expect(r.recommendedFraction).toBe(0);
  });

  it("recommends zero stake on negative edge", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.4,
      reliabilityState: "CALIBRATED",
      sampleSize: 100,
      payoutRatio: 0.95,
    });
    expect(r.fullKelly).toBeLessThanOrEqual(0);
    expect(r.guard).toBe("NEGATIVE_EDGE");
    expect(r.recommendedFraction).toBe(0);
  });

  it("recommends a positive, capped stake on a genuine calibrated edge", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.65,
      reliabilityState: "CALIBRATED",
      sampleSize: 150,
      payoutRatio: 0.95,
      maxBankrollFraction: 0.03,
    });
    expect(r.guard).toBe("NONE");
    expect(r.fullKelly).toBeGreaterThan(0);
    expect(r.recommendedFraction).toBeGreaterThan(0);
    expect(r.recommendedFraction).toBeLessThanOrEqual(0.03);
  });

  it("halves the stake for PROVISIONAL calibration relative to CALIBRATED", () => {
    const base = {
      calibratedProbability: 0.65,
      payoutRatio: 0.95,
      maxBankrollFraction: 0.1, // wide enough that the Kelly cap doesn't mask the halving
    };
    const calibrated = computeStakeSizing({ ...base, reliabilityState: "CALIBRATED", sampleSize: 150 });
    const provisional = computeStakeSizing({ ...base, reliabilityState: "PROVISIONAL", sampleSize: 15 });
    expect(provisional.recommendedFraction).toBeCloseTo(calibrated.recommendedFraction / 2, 3);
  });

  it("zeroes the stake when losing-side pressure is HOSTILE, even with positive Kelly", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.65,
      reliabilityState: "CALIBRATED",
      sampleSize: 150,
      payoutRatio: 0.95,
      losingSideState: "HOSTILE",
    });
    expect(r.guard).toBe("LOSING_SIDE_HOSTILE");
    expect(r.recommendedFraction).toBe(0);
  });

  it("applies the cooldown guard after 3+ consecutive losses", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.65,
      reliabilityState: "CALIBRATED",
      sampleSize: 150,
      payoutRatio: 0.95,
      consecutiveLosses: 3,
    });
    expect(r.guard).toBe("COOLDOWN_ACTIVE");
    expect(r.recommendedFraction).toBe(0);
  });

  it("never exceeds maxBankrollFraction regardless of how large Kelly is", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.95,
      reliabilityState: "CALIBRATED",
      sampleSize: 500,
      payoutRatio: 0.95,
      maxBankrollFraction: 0.02,
      kellyFraction: 1, // full Kelly, to stress the cap
    });
    expect(r.recommendedFraction).toBeLessThanOrEqual(0.02);
  });

  it("computes a concrete currency stake when bankroll is supplied", () => {
    const r = computeStakeSizing({
      calibratedProbability: 0.65,
      reliabilityState: "CALIBRATED",
      sampleSize: 150,
      payoutRatio: 0.95,
      bankroll: 1000,
    });
    expect(r.recommendedStake).not.toBeNull();
    expect(r.recommendedStake).toBeCloseTo(1000 * r.recommendedFraction, 1);
  });
});
