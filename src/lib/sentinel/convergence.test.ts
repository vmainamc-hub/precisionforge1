import { describe, expect, it } from "vitest";
import { computeConvergence } from "./convergence";

describe("model convergence", () => {
  it("reports high convergence when the dimensions agree", () => {
    const r = computeConvergence({
      distributionChange: "STABLE",
      psychologyVerdict: "SUPPORT",
      priceActionAgrees: true,
      entryValidated: true,
      stability: 80,
      survivalAligned: true,
    });
    expect(r.state).toBe("HIGH CONVERGENCE");
    expect(r.rankingDelta).toBe(2);
  });

  it("reports low convergence when dimensions conflict, without blocking", () => {
    const r = computeConvergence({
      distributionChange: "INVALIDATED",
      psychologyVerdict: "CONFLICT",
      priceActionAgrees: false,
      entryValidated: false,
      stability: 20,
      survivalAligned: false,
    });
    expect(r.state).toBe("LOW");
    expect(r.rankingDelta).toBe(-2);
  });

  it("keeps unmeasured dimensions neutral", () => {
    const r = computeConvergence({
      distributionChange: "INSUFFICIENT",
      psychologyVerdict: "NEUTRAL",
      priceActionAgrees: null,
      entryValidated: false,
      stability: null,
      survivalAligned: null,
    });
    expect(r.against).toBe(0);
    expect(r.rankingDelta).toBe(0);
  });
});
