import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_CONFIG,
  EMPTY_ALERT_STATE,
  EPISODE_GRACE_MS,
  qualify,
  reduceAlerts,
  type AlertConfig,
  type AlertState,
} from "./opportunity-alert";
import type { RankedOpportunity } from "../apex/types";

const cfg: AlertConfig = { ...DEFAULT_ALERT_CONFIG, cooldownMs: 1000 };

interface Opts {
  symbol?: string;
  contract?: string;
  score?: number;
  digit?: number | null;
  confidence?: number;
  entryStatus?: string;
  changeState?: string;
  agreement?: string;
  state?: string;
  blocked?: boolean;
  clearance?: string;
  persistence?: number;
  stability?: number;
  relative?: string;
}

function mk(o: Opts = {}): RankedOpportunity {
  const digit = o.digit === undefined ? 6 : o.digit;
  return {
    symbol: o.symbol ?? "R_10",
    name: "Volatility 10",
    score: o.score ?? 74,
    agreement: o.agreement ?? "NEUTRAL",
    blocked: o.blocked ?? false,
    contract: {
      id: o.contract ?? "OVER_2",
      label: "OVER 2",
      danger: 31,
      stability: o.stability ?? 82,
      edge: 0.07,
    },
    relative: { label: o.relative ?? "STRONG" },
    persistence: { persistence: o.persistence ?? 86 },
    entryPoint: {
      status: o.entryStatus ?? "ENTER NOW",
      preferred: digit === null ? null : { digit },
      confidence: o.confidence ?? 81,
      entryMargin: 12,
      changeState: o.changeState ?? "HELD",
      window: { label: "Next 2 minutes", basis: "observed occurrences" },
    },
    entryClearance: { verdict: o.clearance ?? "CLEARED" },
    signal: {
      state: o.state ?? "VALID",
      label: `${o.state ?? "VALID"} — ENTER`,
      waitForEntry: false,
    },
  } as unknown as RankedOpportunity;
}

function run(state: AlertState, ranked: RankedOpportunity[], now: number, c = cfg) {
  return reduceAlerts(state, ranked, c, now);
}

describe("high-quality opportunity alert layer", () => {
  it("1. score 69 does not alert", () => {
    const r = run(EMPTY_ALERT_STATE, [mk({ score: 69 })], 1000);
    expect(r.fired).toHaveLength(0);
    expect(qualify(mk({ score: 69 }), cfg).ok).toBe(false);
  });

  it("2. score 70 with qualified entry and no hard invalidation alerts", () => {
    const r = run(EMPTY_ALERT_STATE, [mk({ score: 70 })], 1000);
    expect(r.fired).toHaveLength(1);
    expect(r.fired[0].kind).toBe("NEW");
    expect(r.fired[0].snapshot.entryDigit).toBe(6);
    expect(r.fired[0].snapshot.windowLabel).toBe("Next 2 minutes");
  });

  it("3 & 4. same opportunity drifting 72-76 alerts once", () => {
    let s = EMPTY_ALERT_STATE;
    let fires = 0;
    let t = 1000;
    for (const score of [75, 74, 72, 76, 73, 75]) {
      const r = run(s, [mk({ score })], (t += 5000));
      s = r.state;
      fires += r.fired.length;
    }
    expect(fires).toBe(1);
    expect(s.episode?.alerts).toBe(1);
  });

  it("5 & 6. episode closes when it stops qualifying and re-arms later", () => {
    let r = run(EMPTY_ALERT_STATE, [mk()], 1000);
    expect(r.fired).toHaveLength(1);
    r = run(r.state, [], 1000 + EPISODE_GRACE_MS + 1);
    expect(r.state.episode?.status).not.toBe("ACTIVE");
    const later = run(r.state, [mk()], 1000 + EPISODE_GRACE_MS + 60_000);
    expect(later.fired).toHaveLength(1);
    expect(later.fired[0].kind).toBe("RE-ARM");
  });

  it("7. an insignificant entry-digit reshuffle does not alert again", () => {
    const first = run(EMPTY_ALERT_STATE, [mk({ digit: 6 })], 1000);
    const next = run(first.state, [mk({ digit: 3, changeState: "HELD", score: 75 })], 60_000);
    expect(next.fired).toHaveLength(0);
  });

  it("8. a materially different actionable entry alerts again", () => {
    const first = run(EMPTY_ALERT_STATE, [mk({ digit: 6 })], 1000);
    const next = run(
      first.state,
      [mk({ digit: 3, changeState: "MATERIAL CHANGE", score: 75 })],
      60_000,
    );
    expect(next.fired).toHaveLength(1);
    expect(next.fired[0].kind).toBe("MATERIAL CHANGE");
  });

  it("9. no qualified entry digit produces no actionable alert", () => {
    expect(
      run(EMPTY_ALERT_STATE, [mk({ digit: null, entryStatus: "UNVALIDATED" })], 1000).fired,
    ).toHaveLength(0);
  });

  it("10. hard invalidation blocks the alert", () => {
    expect(run(EMPTY_ALERT_STATE, [mk({ entryStatus: "INVALIDATED" })], 1000).fired).toHaveLength(
      0,
    );
    expect(run(EMPTY_ALERT_STATE, [mk({ clearance: "BLOCKED" })], 1000).fired).toHaveLength(0);
    expect(run(EMPTY_ALERT_STATE, [mk({ agreement: "STRONG CONFLICT" })], 1000).fired).toHaveLength(
      0,
    );
    expect(
      run(EMPTY_ALERT_STATE, [mk({ blocked: true, state: "BLOCKED" })], 1000).fired,
    ).toHaveLength(0);
  });

  it("11 & 12. NEUTRAL, CONFLICT-free MODERATE and SUPPORT agreement all alert", () => {
    for (const agreement of ["NEUTRAL", "SUPPORT", "CONFLICT"]) {
      expect(run(EMPTY_ALERT_STATE, [mk({ agreement })], 1000).fired).toHaveLength(1);
    }
  });

  it("13 & 14. disabling monitoring silences the layer", () => {
    const r = run(EMPTY_ALERT_STATE, [mk()], 1000, { ...cfg, enabled: false });
    expect(r.fired).toHaveLength(0);
  });

  it("16. several qualifying markets produce one alert on the strongest", () => {
    const r = run(
      EMPTY_ALERT_STATE,
      [mk({ symbol: "R_10", score: 74 }), mk({ symbol: "R_25", score: 81 })],
      1000,
    );
    expect(r.fired).toHaveLength(1);
    expect(r.fired[0].snapshot.symbol).toBe("R_25");
  });

  it("a materially superior market may take over the alert", () => {
    const first = run(EMPTY_ALERT_STATE, [mk({ symbol: "R_10", score: 74 })], 1000);
    const next = run(
      first.state,
      [mk({ symbol: "R_10", score: 60 }), mk({ symbol: "R_50", score: 85 })],
      60_000,
    );
    expect(next.fired).toHaveLength(1);
    expect(next.fired[0].kind).toBe("SUPERIOR MARKET");
    expect(next.state.episode?.snapshot.symbol).toBe("R_50");
  });

  it("records history with the operator-facing fields", () => {
    const r = run(EMPTY_ALERT_STATE, [mk()], 1000);
    const h = r.state.history[0];
    expect(h.snapshot.persistence).toBe(86);
    expect(h.snapshot.stability).toBe(82);
    expect(h.snapshot.relativeEdge).toBe("STRONG");
    expect(h.snapshot.danger).toBe(31);
    expect(h.snapshot.reasons.length).toBeGreaterThan(3);
    expect(h.snapshot.cautions.length).toBeGreaterThan(0);
  });
});
