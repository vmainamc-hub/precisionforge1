// Entry-condition discovery — correctness guarantees required by the Sentinel
// specification: market isolation, exact contract settlement, no look-ahead,
// and sample-size-aware rule selection.
import { describe, expect, it } from "vitest";
import { EntryLab, ENTRY_RULE_BY_ID, type EntryContext } from "./entry-conditions";
import type { ContractEval, MarketIntel } from "./types";

const UNDER7_WINNERS = [0, 1, 2, 3, 4, 5, 6];

function contract(overrides: Partial<ContractEval> = {}): ContractEval {
  return {
    id: "UNDER7",
    label: "Under 7",
    side: "UNDER",
    barrier: 7,
    winners: UNDER7_WINNERS,
    theoretical: 0.7,
    empirical: 0.72,
    recent: 0.74,
    micro: 0.75,
    n: 1000,
    edge: 0.02,
    edgeLB: 0.01,
    pressureAsymmetry: 0.2,
    transitionSupport: 0.1,
    compositeEdge: 12,
    stability: 70,
    freshness: 80,
    quality: 70,
    danger: 20,
    confidence: 65,
    opportunity: 75,
    phase: "FRESH",
    supports: [],
    conflicts: [],
    contradiction: 10,
    ageTicks: 20,
    threat: null,
    critical: null,
    stats: null,
    rate: null,
    ensemble: null,
    forward: null,
    analogue: null,
    fakeEdge: null,
    regimeCompatible: true,
    regimeNote: "",
    threatPenalty: 0,
    alerts: [],
    ...overrides,
  };
}

function intel(symbol: string, lastDigit: number, name = symbol): MarketIntel {
  return {
    symbol,
    name,
    dataState: "OK",
    ticks: 1000,
    lastTickAt: Date.now(),
    ageMs: 100,
    stats: {
      n: 1000,
      freq: new Array(10).fill(100),
      pct: new Array(10).fill(0.1),
      midPct: new Array(10).fill(0.1),
      recentPct: new Array(10).fill(0.1),
      microPct: new Array(10).fill(0.1),
      z: new Array(10).fill(0),
      lastDigit,
      dominant: 1,
      suppressed: 9,
    },
    pressure: {
      pressure: new Array(10).fill(0),
      impulse: new Array(10).fill(0),
      lifecycle: new Array(10).fill("neutral"),
      exhaustion: new Array(10).fill(0),
      zoneAShare: 0.5,
      zoneBShare: 0.5,
      migration: 0,
    },
    transition: null,
    sequence: null,
    entropy: null,
    anomaly: null,
    volatility: null,
    trend: null,
    regime: { label: "BALANCED", confidence: 60, detail: "" },
    personality: null,
    buildup: null,
    quality: null,
    danger: 20,
    contracts: [contract()],
    best: contract(),
    updatedAt: Date.now(),
    digitIntel: null,
    bars: null,
    criticalReport: null,
    battle: null,
    deepTicks: 1000,
    psychology: null,
    specialDigits: null,
    fluctuation: null,
  };
}

const ctx = (over: Partial<EntryContext> = {}): EntryContext => ({
  digits: [1, 2, 3, 4],
  winners: UNDER7_WINNERS,
  losers: [7, 8, 9],
  winningPressure: 3,
  losingPressure: -1,
  asymmetry: 4,
  losingThreat: 20,
  mostIncreasing: 3,
  redOnLosingSide: false,
  regime: "BALANCED",
  opportunity: 75,
  danger: 20,
  freshness: 80,
  stability: 70,
  quality: 70,
  edge: 12,
  lastDigit: 4,
  ...over,
});

describe("entry rule triggers", () => {
  it("only fires the consecutive-winners rule on a genuine run", () => {
    const rule = ENTRY_RULE_BY_ID.CONSEC_WINNERS_4;
    expect(rule.test(ctx({ digits: [1, 2, 3, 4] })).ok).toBe(true);
    expect(rule.test(ctx({ digits: [1, 9, 3, 4] })).ok).toBe(false);
  });

  it("blocks entry when a suppressed digit sits on the losing side", () => {
    const rule = ENTRY_RULE_BY_ID.RED_SAFETY;
    expect(rule.test(ctx({ redOnLosingSide: true })).ok).toBe(false);
    expect(rule.test(ctx({ losingThreat: 80 })).ok).toBe(false);
    expect(rule.test(ctx()).ok).toBe(true);
  });

  it("requires real pressure asymmetry, not just a winning digit", () => {
    expect(ENTRY_RULE_BY_ID.PRESSURE_PLUS_DIGIT.test(ctx({ asymmetry: 0.2 })).ok).toBe(false);
    expect(ENTRY_RULE_BY_ID.PRESSURE_PLUS_DIGIT.test(ctx({ lastDigit: 9 })).ok).toBe(false);
  });
});

describe("contract settlement", () => {
  it("resolves on the actual expiry digit under the real Under 7 rule", () => {
    const lab = new EntryLab();
    lab.consider(intel("R_10", 3), [1, 2, 3]);
    // an intermediate winning digit must not settle a 1-tick contract early…
    lab.onTick("R_10", 9, Date.now()); // expiry digit 9 → LOSS for Under 7
    const stats = lab.statsFor("R_10", "UNDER7", 0.7).find((s) => s.rule === "IMMEDIATE")!;
    expect(stats.n).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe(0);
  });

  it("never resolves an entry with the digit that opened it (no look-ahead)", () => {
    const lab = new EntryLab();
    lab.consider(intel("R_25", 5), [1, 2, 5]);
    const before = lab.statsFor("R_25", "UNDER7", 0.7).find((s) => s.rule === "IMMEDIATE")!;
    expect(before.n).toBe(0); // still open — no future tick has arrived
    lab.onTick("R_25", 2, Date.now());
    const after = lab.statsFor("R_25", "UNDER7", 0.7).find((s) => s.rule === "IMMEDIATE")!;
    expect(after.n).toBe(1);
    expect(after.wins).toBe(1);
  });
});

describe("market isolation", () => {
  it("never lets one market inherit another market's entry record", () => {
    const lab = new EntryLab();
    for (let i = 0; i < 5; i++) {
      lab.consider(intel("R_50", 1), [1, 1, 1]);
      lab.onTick("R_50", 1, Date.now()); // wins on Under 7
    }
    const strong = lab.statsFor("R_50", "UNDER7", 0.7).find((s) => s.rule === "IMMEDIATE")!;
    const other = lab.statsFor("R_75", "UNDER7", 0.7).find((s) => s.rule === "IMMEDIATE")!;
    expect(strong.n).toBe(5);
    expect(other.n).toBe(0);
    expect(other.state).toBe("UNTESTED");
    expect(lab.recommend("R_75", "UNDER7", 0.7).best).toBeNull();
  });
});

describe("rule selection", () => {
  it("does not promote a tiny high-win-rate sample over a large stable one", () => {
    const lab = new EntryLab();
    const now = Date.now();
    // Large, positive-expectancy sample on the IMMEDIATE rule.
    for (let i = 0; i < 300; i++) {
      lab.consider(intel("R_100", 1), [1, 1, 1]);
      lab.onTick("R_100", i % 4 === 0 ? 8 : 1, now + i); // 75% win rate
    }
    const stats = lab.statsFor("R_100", "UNDER7", 0.7);
    const immediate = stats.find((s) => s.rule === "IMMEDIATE")!;
    const thin = stats.find((s) => s.n > 0 && s.n < 25);
    expect(immediate.n).toBeGreaterThan(200);
    expect(["VALIDATED", "STRONG", "PROMISING"]).toContain(immediate.state);
    if (thin) expect(immediate.score).toBeGreaterThan(thin.score);
    // Thin samples carry no authority at all.
    const rec = lab.recommend("R_100", "UNDER7", 0.7);
    expect(rec.best?.n ?? 0).toBeGreaterThanOrEqual(60);
  });

  it("refuses to recommend an entry condition with no sample", () => {
    const lab = new EntryLab();
    const rec = lab.recommend("R_10", "UNDER7", 0.7);
    expect(rec.best).toBeNull();
    expect(rec.rankingDelta).toBe(0);
    expect(rec.activeNow).toBe(false);
  });
});

describe("stale / unusable data", () => {
  it("records nothing while a feed is stale or thin", () => {
    const lab = new EntryLab();
    const stale = { ...intel("R_10", 3), dataState: "STALE" as const };
    lab.consider(stale, [1, 2, 3]);
    expect(lab.totals().tested).toBe(0);
  });
});
