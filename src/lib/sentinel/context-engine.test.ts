import { describe, expect, it } from "vitest";
import { evaluateVariableOrderMarkov } from "./context-engine";

describe("Variable-Order Markov / Context Engine (Engine #4)", () => {
  it("computes transitions across orders 1, 2, and 3", () => {
    // 600 repeating pattern digits
    const digits: number[] = [];
    const pattern = [2, 4, 6, 8, 1, 3, 5, 7, 0, 9];
    for (let i = 0; i < 60; i++) {
      digits.push(...pattern);
    }

    const winners = [0, 1, 2, 3, 4, 5, 6]; // Under 7
    const report = evaluateVariableOrderMarkov(digits, winners, 0.7, {
      symbol: "R_100",
      contractLabel: "Under 7",
    });

    expect(report.evaluations.length).toBe(10);
    expect(report.currentSequence.length).toBeGreaterThan(0);
  });

  it("penalizes losing side strengthening digits", () => {
    const digits: number[] = [];
    for (let i = 0; i < 500; i++) {
      digits.push(i % 10);
    }
    const winners = [0, 1, 2, 3, 4, 5, 6]; // Under 7, losing digits are [7, 8, 9]
    // 8 is strengthening on losing side
    const report = evaluateVariableOrderMarkov(digits, winners, 0.7, {
      symbol: "R_100",
      contractLabel: "Under 7",
      losingStrengtheningDigits: [8],
    });

    const eval8 = report.evaluations.find((e) => e.digit === 8);
    expect(eval8).toBeDefined();
    expect(eval8?.isLosingSideStrengthening).toBe(true);
    expect(eval8?.rankingDelta).toBeLessThanOrEqual(-2.0);
    expect(eval8?.notes.length).toBeGreaterThan(0);
  });

  it("bounds rankingDelta within [-3, +3]", () => {
    const digits: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    const winners = [3, 4, 5, 6, 7, 8, 9]; // Over 2
    const report = evaluateVariableOrderMarkov(digits, winners, 0.7, {
      symbol: "R_50",
      contractLabel: "Over 2",
    });

    for (const e of report.evaluations) {
      expect(e.rankingDelta).toBeGreaterThanOrEqual(-3);
      expect(e.rankingDelta).toBeLessThanOrEqual(3);
    }
  });
});
