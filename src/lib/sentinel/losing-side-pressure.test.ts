import { describe, expect, it } from "vitest";
import type { ThreatReport } from "@/lib/apex/threat";
import {
  applyLosingSidePressure,
  LOSING_SIDE_MAX_MODIFIER,
  LOSING_SIDE_MIN_MODIFIER,
  losingSidePressure,
} from "./losing-side-pressure";

function report(partial: Partial<ThreatReport>): ThreatReport {
  return {
    winners: [5, 6, 7, 8, 9],
    losers: [0, 1, 2, 3, 4],
    winning: { pressure: 0, velocity: 0, acceleration: 0, share: 0.5, baseline: 0.5 },
    losing: { pressure: 0, velocity: 0, acceleration: 0, share: 0.5, baseline: 0.5 },
    asymmetry: 0,
    threats: [],
    maxThreat: 0,
    groupThreat: 0,
    state: "LOW",
    recurrence: "NONE",
    risingLosers: [],
    alerts: [],
    ...partial,
  } as ThreatReport;
}

const threatDigit = (digit: number, score: number) =>
  ({
    digit,
    score,
    state: "HIGH",
    recurrence: "ACTIVE",
    recentCount: 6,
    consecutive: 2,
    clusterDensity: 0.4,
    recurrenceInterval: 4,
    frequencyAcceleration: 0.02,
    pressureAcceleration: 0.01,
    percentile: 90,
    drivers: [],
  }) as ThreatReport["threats"][number];

describe("LOSING_SIDE_PRESSURE", () => {
  it("is neutral without telemetry", () => {
    const p = losingSidePressure(null);
    expect(p.modifier).toBe(1);
    expect(p.state).toBe("CALM");
  });

  it("stays inside its hard bounds under extreme input", () => {
    const hostile = losingSidePressure(
      report({
        threats: [0, 1, 2, 3, 4].map((d) => threatDigit(d, 100)),
        risingLosers: [0, 1, 2, 3, 4],
        groupThreat: 100,
        asymmetry: -1,
        recurrence: "SEVERE",
      }),
    );
    expect(hostile.modifier).toBeGreaterThanOrEqual(LOSING_SIDE_MIN_MODIFIER);
    expect(hostile.modifier).toBeLessThanOrEqual(LOSING_SIDE_MAX_MODIFIER);
    expect(hostile.state).toBe("HOSTILE");

    const calm = losingSidePressure(report({ threats: [threatDigit(0, 0)] }));
    expect(calm.modifier).toBeLessThanOrEqual(LOSING_SIDE_MAX_MODIFIER);
    expect(calm.state).toBe("CALM");
  });

  it("scales monotonically with losing-side hostility", () => {
    const mild = losingSidePressure(report({ threats: [threatDigit(0, 40)], groupThreat: 40 }));
    const severe = losingSidePressure(
      report({
        threats: [threatDigit(0, 90), threatDigit(1, 80)],
        risingLosers: [0, 1],
        groupThreat: 85,
      }),
    );
    expect(severe.index).toBeGreaterThan(mild.index);
    expect(severe.modifier).toBeLessThan(mild.modifier);
  });

  it("dampens an opportunity and records the cost", () => {
    const p = losingSidePressure(
      report({ threats: [threatDigit(0, 90)], risingLosers: [0], groupThreat: 80 }),
    );
    const out = applyLosingSidePressure(80, p);
    expect(out.opportunity).toBeLessThan(80);
    expect(out.pressure.penaltyPoints).toBeGreaterThan(0);
    // Bounded: never able to erase more than ~28% of the score.
    expect(out.opportunity).toBeGreaterThanOrEqual(80 * LOSING_SIDE_MIN_MODIFIER);
  });
});
