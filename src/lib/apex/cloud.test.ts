import { describe, expect, it, beforeEach } from "vitest";
import { apexSimulator, type SimTrade } from "./simulator";
import {
  fingerprint,
  observeCalibration,
  calibrationTable,
  exportMemory,
  importMemory,
} from "./memory";
import type { MarketIntel, ContractEval } from "./types";

function trade(symbol: string, id: string, won: boolean, openedAt: number): SimTrade {
  return {
    id,
    openedAt,
    resolvedAt: openedAt + 5,
    symbol,
    market: symbol,
    contract: "UNDER_5" as SimTrade["contract"],
    contractLabel: "Under 5",
    side: "UNDER",
    barrier: 5,
    winners: [0, 1, 2, 3, 4],
    entryDigit: 1,
    entryQuote: 100,
    durationTicks: 1,
    ticksElapsed: 1,
    expiryAt: openedAt + 5,
    expiryDigit: won ? 1 : 9,
    result: won ? "WIN" : "LOSS",
    stake: 1,
    payout: 0.9,
    pnl: won ? 0.9 : -1,
    entryCondition: "test",
    entryRule: null,
    invalidationReason: null,
    state: {
      opportunity: 0,
      confidence: 0,
      edge: 0,
      quality: 0,
      stability: 0,
      freshness: 0,
      danger: 0,
      dangerClearance: true,
      regime: "TREND",
      threatState: "NONE",
      losingThreat: 0,
      sensitiveConflict: false,
      criticalDetail: "",
      barState: "",
      mostIncreasing: null,
      forwardState: "",
      agreement: "",
      modelState: "",
      reason: "test",
      simBefore: { n: 0, winRate: 0 },
      simRecentBefore: { n: 0, winRate: 0 },
    },
  };
}

describe("durable persistence keeps markets absolutely isolated", () => {
  beforeEach(() => apexSimulator.reset());

  it("serialises one ledger per market and never blends them", () => {
    apexSimulator.importBooks({
      R_75: [trade("R_75", "a1", true, 1), trade("R_75", "a2", false, 2)],
      R_100: [trade("R_100", "b1", true, 3)],
    });
    const out = apexSimulator.exportBooks();
    expect(out["R_75"]?.map((t) => t.id)).toEqual(["a1", "a2"]);
    expect(out["R_100"]?.map((t) => t.id)).toEqual(["b1"]);
    expect(out["R_75"]?.every((t) => t.symbol === "R_75")).toBe(true);
  });

  it("discards a foreign market's trade smuggled into another market's row", () => {
    const added = apexSimulator.importBooks({ R_100: [trade("R_75", "x1", true, 1)] });
    expect(added).toBe(0);
    expect(apexSimulator.exportMarket("R_100")).toHaveLength(0);
    expect(apexSimulator.exportMarket("R_75")).toHaveLength(0);
  });

  it("is idempotent: restoring the same evidence twice cannot inflate a record", () => {
    const rows = { R_50: [trade("R_50", "c1", true, 1)] };
    apexSimulator.importBooks(rows);
    apexSimulator.importBooks(rows);
    expect(apexSimulator.exportMarket("R_50")).toHaveLength(1);
  });
});

describe("market memory is market-scoped", () => {
  const intel = (symbol: string) =>
    ({
      symbol,
      regime: { label: "TREND" },
      volatility: null,
      entropy: null,
    }) as unknown as MarketIntel;
  const contract = {
    id: "UNDER_5",
    compositeEdge: 10,
    pressureAsymmetry: 0.1,
  } as unknown as ContractEval;

  it("fingerprints the same state differently on different markets", () => {
    expect(fingerprint(intel("R_75"), contract)).not.toBe(fingerprint(intel("R_100"), contract));
  });

  it("keeps calibration per market", () => {
    observeCalibration("R_75", 85, true);
    observeCalibration("R_100", 85, false);
    const v75 = calibrationTable("R_75").find((d) => d.decile === 8);
    const v100 = calibrationTable("R_100").find((d) => d.decile === 8);
    expect(v75?.rate).toBe(1);
    expect(v100?.rate).toBe(0);
  });

  it("round-trips through a durable snapshot without double counting", () => {
    const snap = exportMemory();
    importMemory(snap);
    importMemory(snap);
    const after = exportMemory();
    expect(after.calibration).toEqual(snap.calibration);
  });
});
