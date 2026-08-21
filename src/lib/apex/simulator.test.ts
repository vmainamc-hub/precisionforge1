// Contract semantics + causal-integrity tests for the Sentinel simulator.
import { describe, expect, it, beforeEach } from "vitest";
import { CONTRACT_SPECS, winnersFor } from "./contracts";
import { apexSimulator, simulatorAdjustment } from "./simulator";
import type { ContractEval, MarketIntel } from "./types";

function evalStub(id: keyof typeof CONTRACT_SPECS): ContractEval {
  const spec = CONTRACT_SPECS[id];
  const winners = winnersFor(spec);
  return {
    id: spec.id,
    label: spec.label,
    side: spec.side,
    barrier: spec.barrier,
    winners,
    theoretical: winners.length / 10,
    empirical: 0.75,
    recent: 0.75,
    micro: 0.75,
    n: 1000,
    edge: 0.05,
    edgeLB: 0.02,
    pressureAsymmetry: 0.2,
    transitionSupport: 0.1,
    compositeEdge: 20,
    stability: 80,
    freshness: 80,
    quality: 80,
    danger: 20,
    confidence: 80,
    opportunity: 85,
    phase: "FRESH",
    supports: [],
    conflicts: [],
    contradiction: 10,
    ageTicks: 3,
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
  };
}

function intelStub(symbol: string, lastDigit: number, contracts: ContractEval[]): MarketIntel {
  return {
    symbol,
    name: symbol,
    dataState: "OK",
    ticks: 1000,
    lastTickAt: Date.now(),
    ageMs: 100,
    stats: {
      n: 1000,
      freq: [],
      pct: [],
      midPct: [],
      recentPct: [],
      microPct: [],
      z: [],
      lastDigit,
      dominant: 0,
      suppressed: 9,
    },
    pressure: null,
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
    contracts,
    best: contracts[0] ?? null,
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

describe("contract semantics", () => {
  it("Under 7 wins on expiry 0-6 and loses on 7-9", () => {
    const w = winnersFor(CONTRACT_SPECS.UNDER7);
    expect(w).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const d of [7, 8, 9]) expect(w.includes(d)).toBe(false);
  });

  it("Over 2 wins on expiry 3-9 and loses on 0-2", () => {
    const w = winnersFor(CONTRACT_SPECS.OVER2);
    expect(w).toEqual([3, 4, 5, 6, 7, 8, 9]);
    for (const d of [0, 1, 2]) expect(w.includes(d)).toBe(false);
  });

  it("treats 7→0 and 0→7 as different events for Under 7", () => {
    const w = new Set(winnersFor(CONTRACT_SPECS.UNDER7));
    expect(w.has(0)).toBe(true); // entry 7, expiry 0 = WIN
    expect(w.has(7)).toBe(false); // entry 0, expiry 7 = LOSS
  });
});

describe("simulator chronology and accounting", () => {
  beforeEach(() => {
    apexSimulator.reset();
    apexSimulator.setConfig({ durationTicks: 1, cooldownTicks: 0, minScore: 60, maxDanger: 70 });
  });

  it("resolves on the expiry digit only, never on the entry digit", () => {
    const c = evalStub("UNDER7");
    apexSimulator.consider(intelStub("R_10", 9, [c]), () => "SUPPORT");
    let open = apexSimulator.getOpen();
    expect(open).toHaveLength(1);
    expect(open[0].entryDigit).toBe(9); // losing entry digit must not resolve the trade
    expect(open[0].result).toBe("OPEN");

    apexSimulator.onTick("R_10", 3, Date.now()); // expiry digit 3 → WIN
    open = apexSimulator.getOpen();
    expect(open).toHaveLength(0);
    const ledger = apexSimulator.getLedger();
    expect(ledger[0].expiryDigit).toBe(3);
    expect(ledger[0].result).toBe("WIN");
    expect(ledger[0].pnl).toBeGreaterThan(0);
  });

  it("marks a loss when the expiry digit is on the losing side", () => {
    apexSimulator.consider(intelStub("R_25", 1, [evalStub("OVER2")]), () => "SUPPORT");
    apexSimulator.onTick("R_25", 1, Date.now()); // Over 2, expiry 1 → LOSS
    const t = apexSimulator.getLedger()[0];
    expect(t.result).toBe("LOSS");
    expect(t.pnl).toBe(-t.stake);
  });

  it("never opens a second position on a market while one is locked", () => {
    const intel = intelStub("R_50", 2, [evalStub("UNDER7")]);
    apexSimulator.consider(intel, () => "SUPPORT");
    apexSimulator.consider(intel, () => "SUPPORT");
    expect(apexSimulator.getOpen()).toHaveLength(1);
  });

  it("refuses entries when danger or score gates fail", () => {
    const bad = { ...evalStub("UNDER7"), opportunity: 20 };
    apexSimulator.consider(intelStub("R_75", 4, [bad]), () => "SUPPORT");
    expect(apexSimulator.getOpen()).toHaveLength(0);
  });

  it("applies no ranking weight while the sample is thin", () => {
    const adj = simulatorAdjustment("R_100", "UNDER7", 0.7);
    expect(adj.delta).toBe(0);
    expect(adj.perf.n).toBe(0);
  });
});
