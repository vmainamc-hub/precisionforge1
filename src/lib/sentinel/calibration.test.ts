import { describe, expect, it } from "vitest";
import { calibrateScore, fitIsotonicRegression, type HistoricalOutcome } from "./calibration";

describe("Calibration Engine (Engine #3)", () => {
  it("fits isotonic regression monotonically", () => {
    const rawScores = [20, 30, 40, 50, 60, 70, 80, 90];
    const empiricalWins = [0.1, 0.4, 0.35, 0.6, 0.55, 0.8, 0.75, 0.95]; // non-monotonic raw

    const data = rawScores.map((x, i) => ({ x, y: empiricalWins[i] }));
    const curve = fitIsotonicRegression(data);
    // Verified monotonically non-decreasing
    for (let i = 1; i < curve.probabilities.length; i++) {
      expect(curve.probabilities[i]).toBeGreaterThanOrEqual(curve.probabilities[i - 1]);
    }
  });

  it("calibrates a score when empirical history is available", () => {
    const outcomes: HistoricalOutcome[] = [];
    // Generate 60 past trades where high score correlated with winning
    for (let i = 0; i < 60; i++) {
      const score = 40 + (i % 50);
      const win = score > 65;
      outcomes.push({
        score,
        win,
        market: "R_100",
        contract: "Under 7",
        at: Date.now() - i * 60000,
      });
    }

    const result = calibrateScore(80, outcomes, {
      symbol: "R_100",
      contract: "Under 7",
      theoreticalBaseline: 0.7,
    });

    expect(result.calibratedProbability).toBeGreaterThan(0.5);
    expect(result.sampleSize).toBe(60);
    expect(result.method).toBe("ISOTONIC");
  });

  it("uses fallback baseline without distorting when sample is insufficient", () => {
    const result = calibrateScore(75, [], {
      symbol: "R_25",
      contract: "Over 2",
      theoreticalBaseline: 0.7,
    });

    expect(result.sampleSize).toBe(0);
    expect(result.method).toBe("CONSERVATIVE_FALLBACK");
    expect(result.calibratedProbability).toBeGreaterThanOrEqual(0.6);
  });
});
