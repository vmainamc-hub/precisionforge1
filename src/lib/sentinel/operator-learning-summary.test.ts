import { describe, expect, it } from "vitest";
import { summariseOperatorLearning } from "./operator-learning-summary";
import type { OperatorPattern } from "./operator-learning";

function pattern(p: Partial<OperatorPattern>): OperatorPattern {
  return {
    key: "k",
    symbol: "R_50",
    contract: "under7",
    contractLabel: "Under 7",
    entryDigit: 6,
    category: "ENTRY DIGIT",
    polarity: "NEUTRAL",
    observations: 1,
    weightedObservations: 1,
    relatedTrades: 0,
    wins: 0,
    losses: 0,
    lossRate: 0,
    baselineLossRate: 0.5,
    status: "OBSERVATION",
    feedbackConfidence: 10,
    entryAdjustment: 0,
    rankingAdjustment: 0,
    outcomeRelationship: "UNTESTED",
    influence: "NONE",
    lastObservedAt: 1,
    summary: "",
    reason: "",
    samples: [],
    ...p,
  } as OperatorPattern;
}

describe("summariseOperatorLearning", () => {
  it("counts remembered observations and each existing state", () => {
    const s = summariseOperatorLearning([
      pattern({ key: "a", observations: 3 }),
      pattern({ key: "b", observations: 2, status: "EMERGING" }),
      pattern({ key: "c", observations: 1, status: "SUPPORTED" }),
      pattern({ key: "d", observations: 1, status: "VALIDATED" }),
      pattern({ key: "e", observations: 1, status: "DISCOUNTED" }),
    ]);
    expect(s.counts).toEqual({
      observationsRemembered: 8,
      beingTested: 2,
      supported: 1,
      validated: 1,
      discounted: 1,
    });
  });

  it("reports the existing next-stage requirement without changing it", () => {
    const s = summariseOperatorLearning([
      pattern({ key: "a", status: "EMERGING", relatedTrades: 2 }),
    ]);
    const p = s.inProgress[0];
    expect(p.nextStage).toBe("SUPPORTED");
    expect(p.requiredForNextStage).toBe(6);
    expect(p.tradesRemaining).toBe(4);
    expect(p.explanation).toContain("remembered");
  });

  it("shows no influence when bounded adjustments are negligible", () => {
    const s = summariseOperatorLearning([pattern({ entryAdjustment: 0.1 })]);
    expect(s.influence.active).toBe(false);
  });

  it("surfaces bounded influence produced by the engine", () => {
    const s = summariseOperatorLearning([
      pattern({ status: "VALIDATED", entryAdjustment: -3.2, rankingAdjustment: -1.3 }),
    ]);
    expect(s.influence).toEqual({ entry: -3.2, ranking: -1.3, active: true });
  });
});
