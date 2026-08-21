import { describe, expect, it } from "vitest";
import {
  classifyTouches,
  computeEntryTrigger,
  digitGapProfile,
  entryTriggerHeadline,
  MAX_ENTRY_TRIGGER_DELTA,
} from "./entry-trigger";

const WINNERS = [8, 9]; // OVER7-style contract: theoretical 0.2

/**
 * Build a causal digit buffer where the FIRST print of the entry digit after a
 * long absence is followed by a winner, while the repeat prints inside the
 * cluster are followed by losers. The engine must discover that on its own.
 */
function firstTouchFavourableBuffer(entryDigit: number, cycles: number): number[] {
  const digits: number[] = [];
  for (let i = 0; i < cycles; i++) {
    // Long absence of the entry digit (filler digits, none of them winners).
    for (let k = 0; k < 14; k++) digits.push(k % 2 === 0 ? 3 : 4);
    // FIRST touch → next tick is a winner.
    digits.push(entryDigit);
    digits.push(8);
    // SUBSEQUENT touches, tightly clustered → next tick is a loser.
    digits.push(entryDigit);
    digits.push(2);
    digits.push(entryDigit);
    digits.push(1);
  }
  return digits;
}

describe("digitGapProfile", () => {
  it("measures the mean gap and how long ago the digit last printed", () => {
    const digits = [7, 0, 0, 7, 0, 0, 0, 7, 1, 1];
    const p = digitGapProfile(digits, 7);
    expect(p.occurrences).toBe(3);
    expect(p.meanGap).toBeCloseTo(3.5, 5);
    expect(p.sinceSeen).toBe(2);
  });

  it("falls back to the uniform expectation when a digit never repeats", () => {
    expect(digitGapProfile([1, 2, 3], 9).meanGap).toBe(10);
  });
});

describe("classifyTouches", () => {
  it("derives the absence threshold from the digit's own measured gap", () => {
    const digits = firstTouchFavourableBuffer(7, 30);
    const { absenceThreshold, meanGap } = classifyTouches({
      symbol: "R_10",
      contract: "OVER7",
      digits,
      winners: WINNERS,
      entryDigit: 7,
    });
    expect(absenceThreshold).toBe(Math.max(2, Math.round(meanGap)));
    expect(absenceThreshold).toBeGreaterThan(2);
  });

  it("labels the print after a long absence FIRST and the cluster repeats SUBSEQUENT", () => {
    const digits = firstTouchFavourableBuffer(7, 20);
    const { touches } = classifyTouches({
      symbol: "R_10",
      contract: "OVER7",
      digits,
      winners: WINNERS,
      entryDigit: 7,
    });
    const first = touches.filter((t) => t.touchClass === "FIRST");
    const sub = touches.filter((t) => t.touchClass === "SUBSEQUENT");
    expect(first.length).toBeGreaterThan(10);
    expect(sub.length).toBeGreaterThan(10);
    expect(first.every((t) => t.ordinal === 1)).toBe(true);
    expect(sub.every((t) => t.ordinal > 1)).toBe(true);
  });

  it("is causal — the report cannot change when later ticks are hidden", () => {
    const digits = firstTouchFavourableBuffer(7, 20);
    const cut = 200;
    const full = classifyTouches({
      symbol: "R_10",
      contract: "OVER7",
      digits,
      winners: WINNERS,
      entryDigit: 7,
      asOf: cut,
    });
    const truncated = classifyTouches({
      symbol: "R_10",
      contract: "OVER7",
      digits: digits.slice(0, cut),
      winners: WINNERS,
      entryDigit: 7,
    });
    expect(full.touches.map((t) => t.index)).toEqual(truncated.touches.map((t) => t.index));
  });
});

describe("computeEntryTrigger", () => {
  const build = (cycles: number, asOf?: number) =>
    computeEntryTrigger({
      symbol: "R_10",
      contract: "OVER7",
      contractLabel: "Over 7",
      digits: firstTouchFavourableBuffer(7, cycles),
      winners: WINNERS,
      entryDigit: 7,
      asOf,
    });

  it("discovers that the first touch is the one worth trading", () => {
    const r = build(40);
    expect(r.verdict).toBe("FIRST TOUCH FAVOURED");
    expect(r.preferredTouch).toBe("FIRST");
    expect(r.separationPp).toBeGreaterThan(50);
    expect(r.separationSignificant).toBe(true);
    expect(r.first.immediateWinRate).toBeGreaterThan(r.subsequent.immediateWinRate);
  });

  it("refuses to publish a preference on a small sample", () => {
    const r = build(4);
    expect(r.verdict).toBe("INSUFFICIENT TRIGGER HISTORY");
    expect(r.preferredTouch).toBeNull();
    expect(r.rankingDelta).toBe(0);
    expect(r.instruction).toContain("not yet measurable");
  });

  it("reports NO MEASURED DIFFERENCE on a buffer with no touch-class structure", () => {
    // Deterministic pseudo-random stream: touch class carries no information.
    const digits: number[] = [];
    let seed = 12345;
    for (let i = 0; i < 4000; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      digits.push(Math.floor((seed / 2147483648) * 10));
    }
    const r = computeEntryTrigger({
      symbol: "R_25",
      contract: "OVER7",
      digits,
      winners: WINNERS,
      entryDigit: 7,
    });
    expect(r.verdict).toBe("NO MEASURED DIFFERENCE");
    expect(r.preferredTouch).toBeNull();
    expect(r.rankingDelta).toBe(0);
  });

  it("keeps its ranking influence bounded", () => {
    const r = build(60);
    expect(Math.abs(r.rankingDelta)).toBeLessThanOrEqual(MAX_ENTRY_TRIGGER_DELTA);
  });

  it("tells the operator to skip a print that falls in the wrong cohort", () => {
    // End the buffer immediately after a FIRST touch, so the NEXT print of the
    // digit is a clustered SUBSEQUENT touch while FIRST is the favoured cohort.
    const digits = firstTouchFavourableBuffer(7, 40);
    const lastFirst = digits.lastIndexOf(7, digits.length - 5);
    const r = computeEntryTrigger({
      symbol: "R_10",
      contract: "OVER7",
      digits,
      winners: WINNERS,
      entryDigit: 7,
      asOf: lastFirst + 2,
    });
    expect(r.preferredTouch).toBe("FIRST");
    expect(r.nextTouchIsFirst).toBe(false);
    expect(r.nextTouchAligned).toBe(false);
    expect(r.instruction).toContain("DO NOT TRIGGER");
  });

  it("arms the trigger when the digit has been absent long enough", () => {
    const digits = firstTouchFavourableBuffer(7, 40);
    // Ten filler ticks past the last cluster: the next print is a FIRST touch.
    const r = computeEntryTrigger({
      symbol: "R_10",
      contract: "OVER7",
      digits: [...digits, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
      winners: WINNERS,
      entryDigit: 7,
    });
    expect(r.nextTouchIsFirst).toBe(true);
    expect(r.nextTouchAligned).toBe(true);
    expect(r.instruction).toContain("TRIGGER ON IT");
    expect(r.rankingDelta).toBeGreaterThan(0);
  });

  it("never presents the entry digit as the resolution digit", () => {
    const r = build(40);
    expect(r.winners).toEqual(WINNERS);
    expect(r.winners).not.toContain(r.entryDigit);
    expect(r.theoretical).toBeCloseTo(0.2, 5);
  });

  it("produces an honest headline for every verdict", () => {
    expect(entryTriggerHeadline(null)).toContain("NOT APPLICABLE");
    expect(entryTriggerHeadline(build(4))).toContain("INSUFFICIENT HISTORY");
    expect(entryTriggerHeadline(build(40))).toContain("FIRST TOUCH");
  });
});
