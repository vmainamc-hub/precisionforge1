import { describe, expect, it } from "vitest";
import { runSequentialTest, sequentialTestFromEdge } from "./sequential-test";

function outcomes(wins: number, losses: number): boolean[] {
  const arr: boolean[] = [];
  for (let i = 0; i < wins; i++) arr.push(true);
  for (let i = 0; i < losses; i++) arr.push(false);
  // Interleave so the sequence isn't artificially "all wins then all losses".
  return arr.sort(() => Math.random() - 0.5);
}

describe("SEQUENTIAL_TEST (SPRT)", () => {
  it("stays CONTINUE with too little data", () => {
    const r = runSequentialTest([true, false, true], { p0: 0.5, p1: 0.65 });
    expect(r.verdict).toBe("CONTINUE");
    expect(r.inconclusiveAtCap).toBe(false);
  });

  it("declares PROVEN when observed rate strongly favours p1", () => {
    // p0 theoretical 40%, p1 = 60%; feed a long run of ~65% wins.
    const seq: boolean[] = [];
    for (let i = 0; i < 200; i++) seq.push(i % 3 !== 0); // ~66.7% wins
    const r = runSequentialTest(seq, { p0: 0.4, p1: 0.6 });
    expect(r.verdict).toBe("PROVEN");
    expect(r.n).toBeLessThan(200);
  });

  it("declares DISPROVEN when observed rate matches the null", () => {
    const seq: boolean[] = [];
    for (let i = 0; i < 300; i++) seq.push(i % 10 < 4); // ~40% wins, matches p0
    const r = runSequentialTest(seq, { p0: 0.4, p1: 0.6 });
    expect(r.verdict).toBe("DISPROVEN");
  });

  it("respects maxN and reports inconclusive rather than forcing a verdict", () => {
    const seq: boolean[] = [];
    for (let i = 0; i < 40; i++) seq.push(i % 2 === 0); // 50%, dead center between 0.4/0.6
    const r = runSequentialTest(seq, { p0: 0.4, p1: 0.6, maxN: 40 });
    expect(r.verdict).toBe("CONTINUE");
    expect(r.inconclusiveAtCap).toBe(true);
    expect(r.n).toBe(40);
  });

  it("never mutates or reorders the input array", () => {
    const seq = outcomes(10, 10);
    const copy = [...seq];
    runSequentialTest(seq, { p0: 0.5, p1: 0.6 });
    expect(seq).toEqual(copy);
  });

  it("sequentialTestFromEdge builds p1 from theoretical + minEdgePp", () => {
    const seq: boolean[] = [];
    for (let i = 0; i < 100; i++) seq.push(i % 5 !== 0); // 80% wins
    const r = sequentialTestFromEdge(seq, 0.5, 10);
    expect(r.p0).toBeCloseTo(0.5, 5);
    expect(r.p1).toBeCloseTo(0.6, 5);
    expect(r.verdict).toBe("PROVEN");
  });

  it("boundaries widen as alpha/beta tighten (fewer false positives allowed)", () => {
    const loose = runSequentialTest([], { p0: 0.5, p1: 0.6, alpha: 0.1, beta: 0.1 });
    const strict = runSequentialTest([], { p0: 0.5, p1: 0.6, alpha: 0.01, beta: 0.01 });
    expect(strict.upperBound).toBeGreaterThan(loose.upperBound);
    expect(strict.lowerBound).toBeLessThan(loose.lowerBound);
  });
});
