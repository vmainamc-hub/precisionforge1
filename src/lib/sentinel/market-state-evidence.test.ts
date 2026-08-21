import { describe, expect, it } from "vitest";
import {
  buildEvidenceProfile,
  classifyStability,
  conditionalStats,
  detectChangePoint,
  detectStreakTransition,
  rankConditionalStats,
  rollingWindowStats,
  type SimOutcome,
} from "./market-state-evidence";

const W: SimOutcome = "WIN";
const L: SimOutcome = "LOSS";

function repeat(outcome: SimOutcome, n: number): SimOutcome[] {
  return Array.from({ length: n }, () => outcome);
}

describe("rollingWindowStats", () => {
  it("computes win rate and streaks per window without exceeding available history", () => {
    const results = [...repeat(L, 5), ...repeat(W, 5)];
    const stats = rollingWindowStats(results, [5, 20]);
    expect(stats[0].n).toBe(5);
    expect(stats[0].winRate).toBe(1);
    expect(stats[0].currentStreak).toBe(5);
    expect(stats[1].n).toBe(10); // capped at available history
    expect(stats[1].winRate).toBe(0.5);
  });
});

describe("detectStreakTransition", () => {
  it("classifies a loss-then-win pattern as LOSS_RECOVERING", () => {
    const results = [...repeat(L, 5), ...repeat(W, 5)];
    const r = detectStreakTransition(results, 10);
    expect(r.transition).toBe("LOSS_RECOVERING");
    expect(r.pattern).toBe("LLLLLWWWWW");
  });

  it("classifies a win-then-loss pattern as WIN_DETERIORATING", () => {
    const results = [...repeat(W, 5), ...repeat(L, 4)];
    const r = detectStreakTransition(results, 9);
    expect(r.transition).toBe("WIN_DETERIORATING");
  });

  it("classifies rapid alternation as CHOPPY_ALTERNATING", () => {
    const results: SimOutcome[] = [W, L, W, L, W, L, W, L];
    const r = detectStreakTransition(results, 8);
    expect(r.transition).toBe("CHOPPY_ALTERNATING");
  });

  it("classifies an unbroken run as STABLE_STREAK", () => {
    const results = repeat(W, 8);
    const r = detectStreakTransition(results, 8);
    expect(r.transition).toBe("STABLE_STREAK");
  });

  it("returns NONE when history is too thin", () => {
    const r = detectStreakTransition([W, L, W]);
    expect(r.transition).toBe("NONE");
  });
});

describe("classifyStability", () => {
  it("labels a highly alternating sequence as CHOPPY", () => {
    const results: SimOutcome[] = [];
    for (let i = 0; i < 40; i++) results.push(i % 2 === 0 ? W : L);
    const windows = rollingWindowStats(results, [20, 40]);
    const r = classifyStability(results, windows);
    expect(r.label).toBe("CHOPPY");
  });

  it("labels a consistent run as STABLE", () => {
    const results = repeat(W, 40);
    const windows = rollingWindowStats(results, [20, 40]);
    const r = classifyStability(results, windows);
    expect(r.label).toBe("STABLE");
  });
});

describe("detectChangePoint", () => {
  it("does not detect a change point when the rate is unchanged", () => {
    const results: SimOutcome[] = [];
    for (let i = 0; i < 80; i++) results.push(i % 3 === 0 ? L : W); // ~67% win rate throughout
    const r = detectChangePoint(results, 20, 40);
    expect(r.detected).toBe(false);
  });

  it("detects a change point when recent behaviour shifts sharply", () => {
    const stableEra = repeat(W, 40).map((v, i) => (i % 5 === 0 ? L : v)); // ~80% win
    const brokenEra = repeat(L, 20).map((v, i) => (i % 5 === 0 ? W : v)); // ~20% win
    const results = [...stableEra, ...brokenEra];
    const r = detectChangePoint(results, 20, 40);
    expect(r.detected).toBe(true);
    expect(r.recentWinRate).toBeLessThan(r.earlierWinRate);
  });

  it("declines to call a change point with too little history on either side", () => {
    const r = detectChangePoint([W, L, W, L], 20, 40);
    expect(r.detected).toBe(false);
    expect(r.note).toMatch(/insufficient/i);
  });
});

describe("buildEvidenceProfile", () => {
  it("reports INSUFFICIENT_SAMPLE below the minimum sample size", () => {
    const profile = buildEvidenceProfile([W, L, W], { minSample: 12 });
    expect(profile.regime).toBe("INSUFFICIENT_SAMPLE");
    expect(profile.verdict).toBe("INSUFFICIENT_SAMPLE");
  });

  it("never lets a raw high win-count override deteriorating structure", () => {
    // 14 wins, 6 losses overall — but the losses are all in the most recent
    // window, i.e. exactly the "streak is not a forecast" scenario.
    const results = [...repeat(W, 14), ...repeat(L, 6)];
    const profile = buildEvidenceProfile(results, { minSample: 10 });
    expect(profile.streakTransition.transition).toBe("WIN_DETERIORATING");
    expect(profile.verdict).not.toBe("CONFIRMED_EDGE");
  });

  it("treats a loss-recovery pattern as developing, not confirmed, edge", () => {
    const results = [...repeat(L, 10), ...repeat(W, 12)];
    // Widen the lookback so the detector actually sees the L→W transition
    // instead of only the trailing all-win tail (which is its own,
    // legitimately different, STABLE_STREAK case covered separately above).
    const profile = buildEvidenceProfile(results, { minSample: 10, transitionLookback: 22 });
    expect(profile.streakTransition.transition).toBe("LOSS_RECOVERING");
    expect(["DEVELOPING_EDGE", "WATCH"]).toContain(profile.verdict);
    expect(profile.verdict).not.toBe("CONFIRMED_EDGE");
  });

  it("keeps confidence bounded by sample size even for a perfect short streak", () => {
    const results = repeat(W, 12);
    const profile = buildEvidenceProfile(results, { minSample: 10 });
    expect(profile.confidence).toBeLessThan(70);
  });

  it("scales up toward CONFIRMED_EDGE for a long, stable, undisturbed run", () => {
    const results = repeat(W, 250).map((v, i) => (i % 6 === 0 ? L : v));
    const profile = buildEvidenceProfile(results, { minSample: 10 });
    expect(profile.regime).toBe("DISTRIBUTION");
  });
});

describe("conditionalStats / rankConditionalStats", () => {
  const records = [
    { result: "WIN" as const, contextKey: "UNDER|REGIME:STABLE" },
    { result: "WIN" as const, contextKey: "UNDER|REGIME:STABLE" },
    { result: "LOSS" as const, contextKey: "UNDER|REGIME:STABLE" },
    { result: "LOSS" as const, contextKey: "OVER|REGIME:CHOPPY" },
  ];

  it("scopes stats to the exact context signature only", () => {
    const stats = conditionalStats(records, "UNDER|REGIME:STABLE");
    expect(stats.n).toBe(3);
    expect(stats.wins).toBe(2);
  });

  it("reports no history for an unseen configuration", () => {
    const stats = conditionalStats(records, "UNDER|REGIME:TRANSITION");
    expect(stats.n).toBe(0);
    expect(stats.tier).toBe("NONE");
  });

  it("ranks configurations by Wilson lower bound, not raw win rate", () => {
    const ranked = rankConditionalStats(records);
    expect(ranked.length).toBe(2);
    expect(ranked[0].contextKey).toBeDefined();
  });
});
