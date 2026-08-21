// PART P — FEEDBACK-LOOP TESTS.
//
// These lock the two-channel contract: a written note acts immediately, but is
// bounded, scoped, decaying, expiring, supersedable — and NEVER an outcome.
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TTL_MS,
  MAX_GUIDANCE_ENTRY_DELTA,
  MAX_GUIDANCE_RANKING_DELTA,
  activeDirectives,
  guidanceRevision,
  immediateGuidanceLookup,
  interpretFeedback,
  recordFeedbackDirective,
  removeDirectivesBySource,
  resetGuidanceForTests,
} from "./immediate-guidance";
import { assignDigitRoles } from "../digit-roles";
import type { TradeSnapshot } from "./trade-feedback";

function snap(over: Partial<TradeSnapshot> = {}): TradeSnapshot {
  return {
    symbol: "R_10",
    name: "Volatility 10",
    contract: "under7",
    contractLabel: "Under 7",
    entryDigit: 4,
    entryConfidence: 60,
    entryMargin: 5,
    runnerUpDigit: 5,
    signalState: "ARMED",
    signalLabel: "ARMED",
    score: 70,
    absoluteEdge: 2,
    relativeEdge: "LEVEL",
    danger: 20,
    agreement: "ALIGNED",
    persistence: 3,
    stability: 60,
    evidence: "OK",
    simulatorSupport: "—",
    entryCondition: "—",
    validityWindow: "—",
    setupGrade: "B",
    setupScore: 60,
    ...over,
  };
}

describe("immediate operator guidance (Channel 1)", () => {
  beforeEach(() => resetGuidanceForTests());

  it("interprets an explicit late-entry note as an entry-timing directive", () => {
    const d = interpretFeedback("I entered too late", "ENTRY TOO LATE", { symbol: "R_10", contractLabel: "Under 7", entryDigit: 4 });
    expect(d.type).toBe("ENTRY_TIMING_LATE");
    expect(d.entryDigitAdjustment).toBeLessThan(0);
    expect(d.targetDigit).toBe(4);
  });

  it("never turns ambiguous text into a directional rule", () => {
    const d = interpretFeedback("hmm", null, { symbol: "R_10", contractLabel: "Under 7", entryDigit: 4 });
    expect(d.type).toBe("CAUTION");
    expect(d.entryDigitAdjustment).toBe(0);
    expect(d.targetDigit).toBeNull();
  });

  it("acts on the very next ranking pass and bumps the revision", () => {
    const before = guidanceRevision();
    recordFeedbackDirective({
      sourceId: "obs:1",
      text: "entry digit 4 keeps failing",
      category: "ENTRY DIGIT",
      snapshot: snap(),
    });
    expect(guidanceRevision()).toBeGreaterThan(before);
    const look = immediateGuidanceLookup();
    expect(look.forCandidate("R_10", "under7").active).toBe(true);
    expect(look.entryAdjustment("R_10", "under7", 4)).toBeLessThan(0);
  });

  it("is scoped: another market or contract is never influenced", () => {
    recordFeedbackDirective({
      sourceId: "obs:1",
      text: "digit 4 is dangerous here",
      category: "DANGER",
      snapshot: snap(),
    });
    const look = immediateGuidanceLookup();
    expect(look.forCandidate("R_25", "under7").active).toBe(false);
    expect(look.forCandidate("R_10", "over2").active).toBe(false);
    expect(look.entryAdjustment("R_10", "under7", 7)).toBe(0);
  });

  it("keeps ranking and entry influence bounded even with many directives", () => {
    for (let i = 0; i < 12; i++) {
      recordFeedbackDirective({
        sourceId: `obs:${i}`,
        text: `note ${i}: digit 4 keeps failing, avoid`,
        category: "ENTRY DIGIT",
        snapshot: snap(),
      });
    }
    const look = immediateGuidanceLookup();
    const pts = look.forCandidate("R_10", "under7").points;
    expect(Math.abs(pts)).toBeLessThanOrEqual(MAX_GUIDANCE_RANKING_DELTA);
    expect(Math.abs(look.entryAdjustment("R_10", "under7", 4))).toBeLessThanOrEqual(
      MAX_GUIDANCE_ENTRY_DELTA,
    );
  });

  it("decays over its lifetime and expires completely", () => {
    const now = Date.now();
    recordFeedbackDirective({
      sourceId: "obs:1",
      text: "digit 4 keeps failing, avoid",
      category: "ENTRY DIGIT",
      snapshot: snap(),
      now,
    });
    const fresh = Math.abs(immediateGuidanceLookup(now).entryAdjustment("R_10", "under7", 4));
    const aged = Math.abs(
      immediateGuidanceLookup(now + DEFAULT_TTL_MS * 0.9).entryAdjustment("R_10", "under7", 4),
    );
    expect(aged).toBeLessThan(fresh);
    expect(
      immediateGuidanceLookup(now + DEFAULT_TTL_MS + 1).forCandidate("R_10", "under7").active,
    ).toBe(false);
  });

  it("supersedes an earlier note from the same source", () => {
    recordFeedbackDirective({
      sourceId: "obs:1",
      text: "digit 4 keeps failing, avoid",
      category: "ENTRY DIGIT",
      snapshot: snap(),
    });
    recordFeedbackDirective({
      sourceId: "obs:1",
      text: "actually this setup is working well",
      category: "STRONG SIGNAL",
      snapshot: snap(),
    });
    const live = activeDirectives();
    expect(live).toHaveLength(1);
    expect(live[0].type).toBe("SUPPORT");
    expect(immediateGuidanceLookup().entryAdjustment("R_10", "under7", 4)).toBeGreaterThan(0);
  });

  it("removes directives when the source note is deleted", () => {
    recordFeedbackDirective({
      sourceId: "obs:1",
      text: "digit 4 keeps failing",
      category: "ENTRY DIGIT",
      snapshot: snap(),
    });
    removeDirectivesBySource("obs:1");
    expect(activeDirectives()).toHaveLength(0);
  });

  it("ignores empty text", () => {
    expect(
      recordFeedbackDirective({ sourceId: "x", text: "   ", category: null, snapshot: snap() }),
    ).toBeNull();
  });
});

describe("every digit is eligible for roles", () => {
  it("lets a former barrier digit hold a colour role", () => {
    const pct = [1, 1, 30, 1, 1, 1, 1, 1, 1, 1];
    const roles = assignDigitRoles(pct, new Array(10).fill(0));
    expect(roles.hot).toBe(2);
  });
});
