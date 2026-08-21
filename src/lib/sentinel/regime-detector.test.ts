import { describe, expect, it } from "vitest";
import { detectRegimeChange, resetRegimeState } from "./regime-detector";

describe("Regime & Changepoint Engine (Engine #1)", () => {
  it("detects STABLE regime under stationary uniform distribution", () => {
    resetRegimeState("R_100");
    // 500 uniform digits
    const digits: number[] = [];
    for (let i = 0; i < 500; i++) {
      digits.push(i % 10);
    }
    const report = detectRegimeChange(digits, { symbol: "R_100" });
    expect(report.state).toBe("STABLE");
    expect(report.changeScore).toBeLessThan(30);
    expect(report.shouldDiscountOldEvidence).toBe(false);
  });

  it("detects REGIME_CHANGE / TRANSITION when digit distribution shifts abruptly", () => {
    resetRegimeState("R_50");
    // Start with low digits [0, 1, 2], then shift abruptly to high digits [7, 8, 9]
    const digits: number[] = [];
    for (let i = 0; i < 300; i++) {
      digits.push(i % 3);
    }
    for (let i = 0; i < 150; i++) {
      digits.push(7 + (i % 3));
    }
    const report = detectRegimeChange(digits, { symbol: "R_50" });
    expect(["REGIME_CHANGE", "TRANSITION", "WATCH"]).toContain(report.state);
    expect(report.changeScore).toBeGreaterThan(0);
  });

  it("handles thin tick data safely without crashing", () => {
    resetRegimeState("R_10");
    const report = detectRegimeChange([1, 2, 3], { symbol: "R_10" });
    expect(report.state).toBe("STABLE");
    expect(report.detectedAtTick).toBe(3);
  });
});
