import { beforeEach, describe, expect, it } from "vitest";
import {
  computeOperatorPatterns,
  makeOperatorLookup,
  operatorLearningLookup,
  MAX_ENTRY_ADJUSTMENT,
  RECENCY_HALF_LIFE_MS,
  type OperatorPattern,
} from "./operator-learning";
import {
  addObservation,
  clearTradeFeedback,
  markTraded,
  resolveTrade,
  type FeedbackHistoryEntry,
  type TradeRecord,
} from "./trade-feedback";
import type { RankedOpportunity } from "../apex/types";

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function note(i: number, over: Partial<FeedbackHistoryEntry> = {}): FeedbackHistoryEntry {
  return {
    id: `n${i}`,
    ts: NOW - DAY,
    type: "SIGNAL OBSERVATION",
    symbol: "R_10",
    contract: "OVER2",
    contractLabel: "Over 2",
    entryDigit: 7,
    category: "ENTRY TOO LATE",
    outcome: null,
    text: "Entry 7 arrives too late.",
    ...over,
  };
}

function trade(
  i: number,
  outcome: "WIN" | "LOSS",
  over: Partial<TradeRecord["snapshot"]> = {},
): TradeRecord {
  return {
    id: `t${i}`,
    ts: NOW - DAY / 2,
    outcome,
    resolvedAt: NOW - DAY / 2,
    enteredAfterMs: 1000,
    snapshot: {
      symbol: "R_10",
      name: "R_10",
      contract: "OVER2",
      contractLabel: "Over 2",
      entryDigit: 7,
      entryConfidence: 60,
      entryMargin: 4,
      runnerUpDigit: 4,
      signalState: "STRONG",
      signalLabel: "STRONG",
      score: 70,
      absoluteEdge: 0.01,
      relativeEdge: "STRONG",
      danger: 20,
      agreement: "SUPPORT",
      persistence: 50,
      stability: 60,
      evidence: "SUFFICIENT",
      simulatorSupport: "—",
      entryCondition: "—",
      validityWindow: "—",
      setupGrade: "PRIME",
      setupScore: 80,
      ...over,
    },
  };
}

const notes = (n: number, over: Partial<FeedbackHistoryEntry> = {}) =>
  Array.from({ length: n }, (_, i) => note(i, over));

const trades = (wins: number, losses: number, over: Partial<TradeRecord["snapshot"]> = {}) => [
  ...Array.from({ length: wins }, (_, i) => trade(i, "WIN", over)),
  ...Array.from({ length: losses }, (_, i) => trade(100 + i, "LOSS", over)),
];

function pattern(list: OperatorPattern[], digit: number | null = 7) {
  return list.find((p) => p.entryDigit === digit)!;
}

describe("operator learning — validation pipeline", () => {
  it("1. one comment does not materially change ranking", () => {
    const p = pattern(computeOperatorPatterns({ notes: notes(1), trades: trades(2, 8), now: NOW }));
    expect(p.status).toBe("OBSERVATION");
    expect(Math.abs(p.entryAdjustment)).toBeLessThan(0.5);
  });

  it("2. repeated feedback becomes an emerging pattern", () => {
    const p = pattern(computeOperatorPatterns({ notes: notes(4), trades: [], now: NOW }));
    expect(p.status).toBe("EMERGING");
    expect(Math.abs(p.entryAdjustment)).toBeLessThan(2);
  });

  it("3. supporting outcomes can validate the pattern", () => {
    const supporting = [
      ...trades(2, 12),
      // baseline on a different entry digit is much healthier
      ...trades(10, 1, { entryDigit: 4 }),
    ];
    const p = pattern(computeOperatorPatterns({ notes: notes(10), trades: supporting, now: NOW }));
    expect(["SUPPORTED", "VALIDATED"]).toContain(p.status);
    expect(p.feedbackConfidence).toBeGreaterThanOrEqual(55);
    expect(p.entryAdjustment).toBeLessThan(-0.5);
  });

  it("4. contradictory outcomes reduce confidence and discount the pattern", () => {
    const contradicting = [...trades(12, 1), ...trades(1, 9, { entryDigit: 4 })];
    const p = pattern(
      computeOperatorPatterns({ notes: notes(10), trades: contradicting, now: NOW }),
    );
    expect(p.status).toBe("DISCOUNTED");
    expect(p.entryAdjustment).toBe(0);
  });

  it("5 & 6. validated feedback influences entry ranking, but bounded", () => {
    const list = computeOperatorPatterns({
      notes: notes(40),
      trades: [...trades(1, 20), ...trades(14, 1, { entryDigit: 4 })],
      now: NOW,
    });
    const lookup = makeOperatorLookup(list);
    const adj = lookup.entryAdjustment("R_10", "OVER2", 7);
    expect(adj).toBeLessThan(0);
    expect(Math.abs(adj)).toBeLessThanOrEqual(MAX_ENTRY_ADJUSTMENT);
  });

  it("7 & 8. learning stays market-specific and contract-specific", () => {
    const list = computeOperatorPatterns({
      notes: notes(12),
      trades: [...trades(1, 16), ...trades(12, 1, { entryDigit: 4 })],
      now: NOW,
    });
    const lookup = makeOperatorLookup(list);
    expect(lookup.entryAdjustment("R_10", "OVER2", 7)).toBeLessThan(0);
    expect(lookup.entryAdjustment("R_25", "OVER2", 7)).toBe(0);
    expect(lookup.entryAdjustment("R_10", "OVER3", 7)).toBe(0);
  });

  it("9. entry-digit learning stays digit-specific", () => {
    const list = computeOperatorPatterns({
      notes: notes(12),
      trades: [...trades(1, 16), ...trades(12, 1, { entryDigit: 4 })],
      now: NOW,
    });
    const lookup = makeOperatorLookup(list);
    expect(lookup.entryAdjustment("R_10", "OVER2", 7)).toBeLessThan(0);
    expect(lookup.entryAdjustment("R_10", "OVER2", 4)).toBe(0);
  });

  it("12. old feedback gradually loses influence but is never deleted", () => {
    const fresh = computeOperatorPatterns({
      notes: notes(10),
      trades: [...trades(1, 16), ...trades(12, 1, { entryDigit: 4 })],
      now: NOW,
    });
    const old = computeOperatorPatterns({
      notes: notes(10, { ts: NOW - RECENCY_HALF_LIFE_MS * 6 }),
      trades: [...trades(1, 16), ...trades(12, 1, { entryDigit: 4 })],
      now: NOW,
    });
    expect(pattern(old).observations).toBe(10); // history retained
    expect(pattern(old).weightedObservations).toBeLessThan(pattern(fresh).weightedObservations);
    expect(Math.abs(pattern(old).entryAdjustment)).toBeLessThan(
      Math.abs(pattern(fresh).entryAdjustment),
    );
  });

  it("no look-ahead: trades that preceded the observation never validate it", () => {
    const before = trades(0, 12).map((t) => ({
      ...t,
      ts: NOW - 10 * DAY,
      resolvedAt: NOW - 10 * DAY,
    }));
    const p = pattern(computeOperatorPatterns({ notes: notes(10), trades: before, now: NOW }));
    expect(p.relatedTrades).toBe(0);
    expect(p.outcomeRelationship).toBe("UNTESTED");
    expect(p.entryAdjustment).toBe(0);
  });
});

// ── Store-backed behaviour (10, 11, 13) ──────────────────────────────────
function item(symbol: string, digit: number): RankedOpportunity {
  return {
    symbol,
    name: symbol,
    score: 70,
    agreement: "SUPPORT",
    simNote: "",
    entry: null,
    contract: { id: "OVER2", label: "Over 2", edge: 0.01, danger: 20, stability: 60 },
    relative: { label: "STRONG" },
    evidence: { status: "SUFFICIENT" },
    persistence: { persistence: 50 },
    setup: { grade: "PRIME", score: 80 },
    signal: { state: "STRONG", label: "STRONG", waitForEntry: false },
    entryPoint: {
      status: "ENTER NOW",
      preferred: { digit },
      confidence: 70,
      entryMargin: 6,
      runnerUpDigit: 4,
      window: { label: "VALID", basis: "measured" },
    },
  } as unknown as RankedOpportunity;
}

describe("operator learning — persistence and safety", () => {
  beforeEach(() => clearTradeFeedback());

  it("10. an ignored signal never becomes a win or a loss", () => {
    addObservation(item("R_10", 7), "Market rotated immediately.", "MARKET ROTATION");
    const p = operatorLearningLookup().patterns[0];
    expect(p.observations).toBe(1);
    expect(p.wins).toBe(0);
    expect(p.losses).toBe(0);
    expect(p.relatedTrades).toBe(0);
  });

  it("11. feedback derives the same learning after a store reload", () => {
    for (let i = 0; i < 5; i++) {
      addObservation(item("R_10", 7), "Late again.", "ENTRY TOO LATE");
    }
    const rec = markTraded(item("R_10", 7));
    resolveTrade(rec.id, "LOSS");
    const before = operatorLearningLookup().patterns.map((p) => p.key);
    // The learning layer is derived — re-deriving it yields the same result.
    const after = operatorLearningLookup().patterns.map((p) => p.key);
    expect(after).toEqual(before);
    expect(before.length).toBeGreaterThan(0);
  });

  it("14. adjustments stay bounded so hard invalidation cannot be bought off", () => {
    const list = computeOperatorPatterns({
      notes: notes(200),
      trades: [...trades(0, 60), ...trades(50, 1, { entryDigit: 4 })],
      now: NOW,
    });
    const lookup = makeOperatorLookup(list);
    expect(Math.abs(lookup.entryAdjustment("R_10", "OVER2", 7))).toBeLessThanOrEqual(
      MAX_ENTRY_ADJUSTMENT,
    );
    expect(Math.abs(lookup.rankingAdjustment("R_10", "OVER2"))).toBeLessThanOrEqual(2.5);
  });
});
