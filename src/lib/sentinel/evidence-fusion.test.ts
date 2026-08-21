import { describe, expect, it } from "vitest";
import { fuseEvidence, type EngineEvidenceInput } from "./evidence-fusion";

describe("Correlation-Aware Evidence Fusion Engine (Engine #2)", () => {
  it("returns neutral fallback when inputs are empty", () => {
    const report = fuseEvidence([]);
    expect(report.effectiveScore).toBe(50);
    expect(report.consensus).toBe("NEUTRAL");
    expect(report.rankingDelta).toBe(0);
  });

  it("downweights collinear/correlated redundant signals (Pressure & Price Action)", () => {
    const collinearInputs: EngineEvidenceInput[] = [
      {
        source: "PRESSURE",
        label: "Pressure",
        signal: 0.8,
        confidence: 80,
        summary: "Pressure bull",
      },
      {
        source: "PRICE_ACTION",
        label: "Price Action",
        signal: 0.8,
        confidence: 80,
        summary: "Price action bull",
      },
    ];

    const report = fuseEvidence(collinearInputs);
    // Redundancy penalty must be applied due to high cross-correlation (0.68)
    expect(report.redundancyScore).toBeGreaterThan(20);
    expect(report.effectiveDegreesOfFreedom).toBeLessThan(2.0);
    expect(report.effectiveScore).toBeLessThan(report.rawAgreement);
  });

  it("preserves independent orthogonal signals (Digit Psychology + Simulator)", () => {
    const orthogonalInputs: EngineEvidenceInput[] = [
      {
        source: "DIGIT_PSYCHOLOGY",
        label: "Digit Psychology",
        signal: 0.9,
        confidence: 90,
        summary: "Psychology support",
      },
      {
        source: "SIMULATOR_LAB",
        label: "Simulator Lab",
        signal: 0.9,
        confidence: 85,
        summary: "Simulator profit",
      },
    ];

    const report = fuseEvidence(orthogonalInputs);
    expect(report.independenceScore).toBeGreaterThan(65);
    expect(report.consensus).toBe("STRONG_SUPPORT");
  });

  it("strictly bounds rankingDelta within [-6, +6]", () => {
    const extremeInputs: EngineEvidenceInput[] = [
      { source: "DIGIT_PSYCHOLOGY", label: "P", signal: 1.0, confidence: 100, summary: "P" },
      { source: "PRESSURE", label: "Pr", signal: 1.0, confidence: 100, summary: "Pr" },
      { source: "PRICE_ACTION", label: "PA", signal: 1.0, confidence: 100, summary: "PA" },
      { source: "TRANSITION", label: "T", signal: 1.0, confidence: 100, summary: "T" },
      { source: "CONTEXT_MARKOV", label: "M", signal: 1.0, confidence: 100, summary: "M" },
      { source: "SIMULATOR_LAB", label: "S", signal: 1.0, confidence: 100, summary: "S" },
    ];
    const report = fuseEvidence(extremeInputs);
    expect(report.rankingDelta).toBeLessThanOrEqual(6);
    expect(report.rankingDelta).toBeGreaterThanOrEqual(-6);
  });
});
