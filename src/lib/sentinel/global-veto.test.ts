import { beforeEach, describe, expect, it } from "vitest";
import {
  activeGlobalVetoRules,
  allPatternRiskStats,
  checkGlobalVeto,
  createGlobalVetoRule,
  evaluateSignalGovernance,
  isExplicitGlobalVetoRequest,
  isExplicitVetoReleaseRequest,
  patternRiskStats,
  recordPatternOutcome,
  releaseAllGlobalVetoRules,
  releaseGlobalVetoRule,
  resetGlobalVetoForTests,
} from "./global-veto";

const NOW = 1_700_000_000_000;

beforeEach(() => {
  resetGlobalVetoForTests();
});

describe("isExplicitGlobalVetoRequest", () => {
  it("recognises explicit, durable veto language", () => {
    expect(isExplicitGlobalVetoRequest("Never take this pattern again, it burned me.")).toBe(true);
    expect(isExplicitGlobalVetoRequest("Please globally veto this setup.")).toBe(true);
    expect(isExplicitGlobalVetoRequest("Block this pattern on all markets until I say so.")).toBe(
      true,
    );
  });

  it("does NOT treat an ordinary loss comment as a global veto", () => {
    expect(isExplicitGlobalVetoRequest("This setup lost.")).toBe(false);
    expect(isExplicitGlobalVetoRequest("I noticed digit 4 increasing.")).toBe(false);
    expect(isExplicitGlobalVetoRequest("That was a bad entry, too late.")).toBe(false);
  });
});

describe("isExplicitVetoReleaseRequest", () => {
  it("recognises a release instruction", () => {
    expect(isExplicitVetoReleaseRequest("Please release the veto on that pattern.")).toBe(true);
    expect(isExplicitVetoReleaseRequest("You can lift the global veto now.")).toBe(true);
  });

  it("does not fire on unrelated text", () => {
    expect(isExplicitVetoReleaseRequest("This setup lost again.")).toBe(false);
  });
});

describe("createGlobalVetoRule / checkGlobalVeto", () => {
  const pattern = {
    tags: ["contract:under", "side_digit:red", "losing_side:rising"],
  };

  it("vetoes an exact pattern match across every market (GLOBAL scope)", () => {
    createGlobalVetoRule({
      sourceId: "trade-1",
      operatorText: "Never take this pattern again — RED on the losing side rising.",
      pattern,
      reason: "Losing-side RED strengthening while contract = UNDER",
      now: NOW,
    });

    const v25 = checkGlobalVeto({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED", "LOSING_SIDE:RISING", "REGIME:STABLE"],
      symbol: "R_25",
    });
    const v10 = checkGlobalVeto({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED", "LOSING_SIDE:RISING"],
      symbol: "R_10",
    });
    expect(v25.vetoed).toBe(true);
    expect(v10.vetoed).toBe(true);
    expect(v25.rule?.scope).toBe("GLOBAL");
  });

  it("does NOT veto a signal missing part of the pattern (no blind, whole-market veto)", () => {
    createGlobalVetoRule({
      sourceId: "trade-1",
      operatorText: "Never take this pattern again.",
      pattern,
      reason: "test",
      now: NOW,
    });

    const partial = checkGlobalVeto({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED"], // missing LOSING_SIDE:RISING
      symbol: "R_25",
    });
    expect(partial.vetoed).toBe(false);
  });

  it("even a very strong statistical candidate is still blocked once vetoed", () => {
    createGlobalVetoRule({
      sourceId: "trade-1",
      operatorText: "Never take this pattern again.",
      pattern,
      reason: "reported loss condition",
      now: NOW,
    });
    const result = evaluateSignalGovernance({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED", "LOSING_SIDE:RISING"],
      symbol: "R_25",
    });
    expect(result.verdict).toBe("VETOED");
    expect(result.vetoed).toBe(true);
  });

  it("can be scoped to a single market instead of GLOBAL", () => {
    createGlobalVetoRule({
      sourceId: "trade-2",
      operatorText: "Never take this again on R_10 specifically.",
      pattern,
      reason: "test",
      scope: "MARKET",
      symbol: "R_10",
      now: NOW,
    });
    const onR10 = checkGlobalVeto({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED", "LOSING_SIDE:RISING"],
      symbol: "R_10",
    });
    const onR25 = checkGlobalVeto({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED", "LOSING_SIDE:RISING"],
      symbol: "R_25",
    });
    expect(onR10.vetoed).toBe(true);
    expect(onR25.vetoed).toBe(false);
  });

  it("release removes the rule from future checks", () => {
    const rule = createGlobalVetoRule({
      sourceId: "trade-3",
      operatorText: "Never take this again.",
      pattern,
      reason: "test",
      now: NOW,
    });
    expect(activeGlobalVetoRules().length).toBe(1);
    const released = releaseGlobalVetoRule(rule.id, NOW + 1000);
    expect(released).toBe(true);
    expect(activeGlobalVetoRules().length).toBe(0);

    const check = checkGlobalVeto({
      tags: ["CONTRACT:UNDER", "SIDE_DIGIT:RED", "LOSING_SIDE:RISING"],
      symbol: "R_25",
    });
    expect(check.vetoed).toBe(false);
  });

  it("releaseAllGlobalVetoRules clears every active rule", () => {
    createGlobalVetoRule({ sourceId: "a", operatorText: "never again", pattern, reason: "x", now: NOW });
    createGlobalVetoRule({
      sourceId: "b",
      operatorText: "never again",
      pattern: { tags: ["contract:over"] },
      reason: "y",
      now: NOW,
    });
    expect(activeGlobalVetoRules().length).toBe(2);
    const count = releaseAllGlobalVetoRules(NOW + 1);
    expect(count).toBe(2);
    expect(activeGlobalVetoRules().length).toBe(0);
  });
});

describe("Level 2 — cross-market pattern risk learning", () => {
  const pattern = { tags: ["contract:over", "digit_role:hot"] };

  it("accumulates losses/wins for a pattern across multiple markets", () => {
    recordPatternOutcome(pattern, "LOSS", "R_10", NOW);
    recordPatternOutcome(pattern, "LOSS", "R_25", NOW + 1);
    recordPatternOutcome(pattern, "LOSS", "R_50", NOW + 2);
    recordPatternOutcome(pattern, "WIN", "R_50", NOW + 3);
    recordPatternOutcome(pattern, "LOSS", "R_75", NOW + 4);

    const stats = patternRiskStats(pattern);
    expect(stats.n).toBe(5);
    expect(stats.losses).toBe(4);
    expect(stats.marketBreadth).toBe(4);
    expect(stats.riskLevel).toBe("SEVERE");
  });

  it("does not escalate risk on a thin sample even with one loss", () => {
    recordPatternOutcome({ tags: ["contract:under", "digit_role:cold"] }, "LOSS", "R_10", NOW);
    const stats = patternRiskStats({ tags: ["contract:under", "digit_role:cold"] });
    expect(stats.n).toBe(1);
    expect(stats.riskLevel).not.toBe("SEVERE");
  });

  it("evaluateSignalGovernance suggests a bounded penalty (not a veto) for elevated risk without an explicit veto", () => {
    for (let i = 0; i < 6; i++) {
      recordPatternOutcome(pattern, "LOSS", `R_${i}`, NOW + i);
    }
    const result = evaluateSignalGovernance({
      tags: ["CONTRACT:OVER", "DIGIT_ROLE:HOT"],
      symbol: "R_99",
    });
    expect(result.vetoed).toBe(false);
    expect(result.verdict).toBe("ELEVATED_RISK");
    expect(result.suggestedPenalty).toBeGreaterThan(0);
    expect(result.suggestedPenalty).toBeLessThanOrEqual(12);
  });

  it("allPatternRiskStats surfaces every tracked pattern, worst first", () => {
    recordPatternOutcome({ tags: ["a"] }, "LOSS", "R_1", NOW);
    recordPatternOutcome({ tags: ["b"] }, "WIN", "R_1", NOW);
    const all = allPatternRiskStats();
    expect(all.length).toBe(2);
    expect(all[0].lossRate).toBeGreaterThanOrEqual(all[1].lossRate);
  });
});

describe("evaluateSignalGovernance — a clear pattern with no history", () => {
  it("returns CLEAR with zero penalty", () => {
    const result = evaluateSignalGovernance({ tags: ["CONTRACT:OVER"], symbol: "R_1" });
    expect(result.verdict).toBe("CLEAR");
    expect(result.suggestedPenalty).toBe(0);
    expect(result.vetoed).toBe(false);
  });
});
