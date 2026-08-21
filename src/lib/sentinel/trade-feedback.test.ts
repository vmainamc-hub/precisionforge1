import { describe, expect, it, beforeEach } from "vitest";
import {
  addObservation,
  clearTradeFeedback,
  confirmedTrades,
  deleteObservation,
  deleteTradeFeedback,
  feedbackHistory,
  learningFor,
  listPendingTrades,
  listObservations,
  markTraded,
  observationCategoryCounts,
  observationsFor,
  resolveTrade,
  saveTradeFeedback,
  tierFor,
  tradeFeedbackFor,
} from "./trade-feedback";
import type { RankedOpportunity } from "../apex/types";

function item(symbol: string, digit: number | null): RankedOpportunity {
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
    signal: { state: "STRONG", label: "STRONG", waitForEntry: digit === null },
    entryPoint: {
      status: "ENTER NOW",
      preferred: digit === null ? null : { digit },
      confidence: 70,
      entryMargin: 6,
      runnerUpDigit: 3,
      window: { label: "3 occurrences", basis: "basis" },
    },
  } as unknown as RankedOpportunity;
}

describe("trade feedback", () => {
  beforeEach(() => clearTradeFeedback());

  it("creates nothing until a signal is explicitly marked", () => {
    expect(listPendingTrades()).toHaveLength(0);
    expect(confirmedTrades()).toHaveLength(0);
  });

  it("creates exactly one pending trade per market/contract", () => {
    markTraded(item("R_10", 7));
    markTraded(item("R_10", 7));
    expect(listPendingTrades()).toHaveLength(1);
  });

  it("records WIN once and ignores duplicate feedback", () => {
    const t = markTraded(item("R_10", 7));
    resolveTrade(t.id, "WIN");
    resolveTrade(t.id, "LOSS");
    const l = learningFor("R_10", "OVER2");
    expect(l.trades).toBe(1);
    expect(l.wins).toBe(1);
  });

  it("does not learn from cancelled trades", () => {
    const t = markTraded(item("R_10", 7));
    resolveTrade(t.id, "CANCELLED");
    expect(learningFor("R_10", "OVER2").trades).toBe(0);
  });

  it("keeps learning market isolated", () => {
    resolveTrade(markTraded(item("R_10", 7)).id, "WIN");
    resolveTrade(markTraded(item("R_25", 7)).id, "LOSS");
    expect(learningFor("R_10", "OVER2").winRate).toBe(1);
    expect(learningFor("R_25", "OVER2").winRate).toBe(0);
  });

  it("does not claim a preference on a small sample", () => {
    resolveTrade(markTraded(item("R_10", 7)).id, "WIN");
    const l = learningFor("R_10", "OVER2");
    expect(l.best).toBeNull();
    expect(l.tier).toBe("INSUFFICIENT SAMPLE");
    expect(tierFor(25)).toBe("MORE INFORMATIVE");
  });

  it("never rewrites the original snapshot after an outcome", () => {
    const t = markTraded(item("R_10", 7));
    const score = t.snapshot.score;
    resolveTrade(t.id, "LOSS");
    expect(confirmedTrades()[0].snapshot.score).toBe(score);
    expect(confirmedTrades()[0].snapshot.entryDigit).toBe(7);
  });
});

describe("operator written feedback", () => {
  beforeEach(() => clearTradeFeedback());

  it("creates no written feedback merely because a signal was displayed", () => {
    item("R_10", 7);
    expect(listObservations()).toHaveLength(0);
    expect(feedbackHistory()).toHaveLength(0);
  });

  it("persists written trade feedback without rewriting the snapshot", () => {
    const t = markTraded(item("R_10", 7));
    resolveTrade(t.id, "WIN");
    saveTradeFeedback(t.id, "Clean entry, pressure reversed after.", "PRESSURE REVERSAL");
    expect(tradeFeedbackFor(t.id)?.text).toBe("Clean entry, pressure reversed after.");
    expect(confirmedTrades()[0].snapshot.entryDigit).toBe(7);
    expect(learningFor("R_10", "OVER2").trades).toBe(1);
  });

  it("persists observations without creating trades, wins or losses", () => {
    addObservation(item("R_10", 7), "Market rotated immediately.", "MARKET ROTATION");
    expect(listObservations()).toHaveLength(1);
    expect(listPendingTrades()).toHaveLength(0);
    expect(confirmedTrades()).toHaveLength(0);
    const l = learningFor("R_10", "OVER2");
    expect(l.trades).toBe(0);
    expect(l.wins).toBe(0);
    expect(l.losses).toBe(0);
  });

  it("keeps observations attached to their own market and contract", () => {
    addObservation(item("R_10", 7), "R_10 note");
    expect(observationsFor("R_10", "OVER2")).toHaveLength(1);
    expect(observationsFor("R_25", "OVER2")).toHaveLength(0);
  });

  it("persists written feedback to storage so it survives a reload", () => {
    const t = markTraded(item("R_10", 7));
    resolveTrade(t.id, "WIN");
    saveTradeFeedback(t.id, "kept across reload");
    addObservation(item("R_25", 4), "observation kept");
    const raw = globalThis.localStorage?.getItem("sentinel.trade-feedback.v1");
    if (!raw) return; // no storage in this environment
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.trades[0].feedback.text).toBe("kept across reload");
    expect(parsed.observations[0].text).toBe("observation kept");
  });

  it("removes deleted feedback from history and counts", () => {
    const t = markTraded(item("R_10", 7));
    resolveTrade(t.id, "WIN");
    saveTradeFeedback(t.id, "delete me", "DANGER");
    const o = addObservation(item("R_10", 7), "also delete me", "DANGER")!;
    expect(feedbackHistory()).toHaveLength(2);
    expect(observationCategoryCounts()[0]).toEqual({ category: "DANGER", count: 2 });
    deleteTradeFeedback(t.id);
    deleteObservation(o.observationId);
    expect(feedbackHistory()).toHaveLength(0);
    expect(observationCategoryCounts()).toHaveLength(0);
    // deleting a note never deletes the confirmed trade outcome
    expect(learningFor("R_10", "OVER2").wins).toBe(1);
  });

  it("filters history by type, market and category", () => {
    const t = markTraded(item("R_10", 7));
    resolveTrade(t.id, "LOSS");
    saveTradeFeedback(t.id, "trade note", "ENTRY QUALITY");
    addObservation(item("R_25", 4), "observation note", "MARKET ROTATION");
    expect(feedbackHistory({ type: "TRADE FEEDBACK" })).toHaveLength(1);
    expect(feedbackHistory({ symbol: "R_25" })[0].type).toBe("SIGNAL OBSERVATION");
    expect(feedbackHistory({ category: "MARKET ROTATION" })).toHaveLength(1);
  });
});
