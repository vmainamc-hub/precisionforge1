// SENTINEL — STAGE 2a: DANGER COMPOSITION.
//
// Danger stops being a single number. It becomes a labelled composition of
// named, measured components, each with its own severity, so the operator can
// see *why* a setup is dangerous — not just how dangerous it is.
import type { ContractEval, MarketIntel } from "@/lib/apex/types";
import type { SimPerformance } from "@/lib/apex/simulator";

export type DangerSeverity = "MILD" | "MODERATE" | "HIGH" | "SEVERE" | "AUTO_BLOCK";

export interface DangerComponent {
  /** Stable machine code. */
  code: string;
  label: string;
  severity: DangerSeverity;
  /** Points contributed to the composed danger total (0..100 scale). */
  points: number;
  /** The measured value that produced this component. */
  value: number | null;
  detail: string;
}

export interface DangerComposition {
  /** 0..100 composed from the labelled components below — never a raw blend. */
  total: number;
  level: "LOW" | "MILD" | "MODERATE" | "HIGH" | "SEVERE";
  components: DangerComponent[];
  /** Components that force a BLOCK in Stage 3 regardless of any score. */
  autoBlock: DangerComponent[];
  /** HIGH / SEVERE components. */
  severe: DangerComponent[];
  summary: string;
}

export const SENSITIVE_DIGITS = [0, 1, 8, 9];

const SEVERITY_POINTS: Record<DangerSeverity, number> = {
  MILD: 8,
  MODERATE: 16,
  HIGH: 26,
  SEVERE: 38,
  AUTO_BLOCK: 100,
};

export interface DangerInputs {
  intel: MarketIntel;
  contract: ContractEval;
  /** Contract-resolved lifetime record for THIS market + contract. */
  lifetime: SimPerformance | null;
  /** Rolling-window record for THIS market + contract. */
  recent: SimPerformance | null;
}

/** Stage 2a — the labelled danger composition. */
export function composeDanger(input: DangerInputs): DangerComposition {
  const { intel, contract: c, lifetime, recent } = input;
  const components: DangerComponent[] = [];

  const add = (
    code: string,
    label: string,
    severity: DangerSeverity,
    detail: string,
    value: number | null = null,
    scale = 1,
  ) =>
    components.push({
      code,
      label,
      severity,
      points: Math.round(SEVERITY_POINTS[severity] * scale),
      value,
      detail,
    });

  // ── Chaotic regime — auto-block ───────────────────────────────────────
  if (intel.regime?.label === "CHAOTIC") {
    add(
      "CHAOTIC_REGIME",
      "Chaotic regime",
      "AUTO_BLOCK",
      `Regime CHAOTIC at confidence ${intel.regime.confidence.toFixed(0)} — no entry is authorised in this regime.`,
      intel.regime.confidence,
    );
  }

  // ── Fluctuation ───────────────────────────────────────────────────────
  const fl = intel.fluctuation;
  if (fl) {
    if (fl.state === "CHAOTIC") {
      add("FLUCTUATION_CHAOTIC", "Chaotic fluctuation", "SEVERE", fl.summary, fl.score);
    } else if (fl.score >= 55) {
      add("FLUCTUATION_HIGH", "Unsettled evidence", "HIGH", fl.summary, fl.score);
    } else if (fl.score >= 30) {
      add("FLUCTUATION_MILD", "Mild fluctuation", "MILD", fl.summary, fl.score);
    }
  }

  // ── Losing-digit lifecycle: any bar showing activity on the losing side ─
  // Every losing digit carries its own pressure-engine "bar" state — green
  // (dominant: over fair share and STILL climbing), amber (exhausting),
  // red (suppressed: under fair share and still fading), or the accent
  // colour (recovering: under fair share but climbing back). Per the
  // operator's convention: anything other than a flat/fair bar on the
  // losing side works against the signal and is worth flagging — red bars
  // especially — and two digits are structurally worst-case regardless of
  // which specific contract is in play: digit 0 can never win ANY OVER
  // contract, digit 9 can never win ANY UNDER contract. A green (dominant
  // or emerging — i.e. "increasing") bar on either of those is the single
  // most dangerous losing-digit signal there is, so it gets its own,
  // higher-severity component instead of being folded into the generic ones.
  const p = intel.pressure;
  const losers = c.winners.length
    ? Array.from({ length: 10 }, (_, d) => d).filter((d) => !c.winners.includes(d))
    : [];
  const criticalExtreme = c.side === "OVER" ? 0 : c.side === "UNDER" ? 9 : null;
  if (p) {
    for (const d of losers) {
      const life = p.lifecycle[d] ?? "neutral";
      const press = p.pressure[d] ?? 0;
      const impulse = p.impulse[d] ?? 0;
      const exhaustion = p.exhaustion[d] ?? 0;

      // ── The structurally worst-case digit, green and increasing ───────
      if (d === criticalExtreme && (life === "dominant" || life === "emerging")) {
        add(
          `CRITICAL_EXTREME_DIGIT_${d}`,
          `Critical digit ${d} rising — always loses ${c.side}`,
          life === "dominant" ? "SEVERE" : "HIGH",
          `Digit ${d} can never win any ${c.side} contract, and its bar is green (${life}) — ` +
            `share moving ${press >= 0 ? "+" : ""}${(press * 100).toFixed(1)}pp, ` +
            `impulse ${impulse >= 0 ? "+" : ""}${(impulse * 100).toFixed(1)}pp.`,
          press,
        );
        continue;
      }

      // ── Every other losing digit: any non-flat bar is worth flagging ──
      if (life === "exhausting" || (exhaustion >= 0.6 && press <= 0)) {
        add(
          `LOSING_DIGIT_EXHAUSTED_${d}`,
          `Exhausted losing digit ${d}`,
          "MILD",
          `Losing digit ${d} is exhausting (exhaustion ${(exhaustion * 100).toFixed(0)}%, pressure ${press.toFixed(1)}pp) — lower severity, but it can reactivate.`,
          exhaustion,
        );
      }
      if (
        life === "recovering" ||
        life === "emerging" ||
        life === "dominant" ||
        (press > 1.2 && impulse > 1.0)
      ) {
        add(
          `LOSING_DIGIT_REACTIVATING_${d}`,
          `Reactivating losing digit ${d}`,
          "HIGH",
          `Losing digit ${d} is regaining pressure (${life}, pressure +${press.toFixed(1)}pp, impulse +${impulse.toFixed(1)}pp).`,
          press,
        );
      }
      if (life === "suppressed") {
        add(
          `LOSING_DIGIT_SUPPRESSED_${d}`,
          `Suppressed losing digit ${d} (red bar)`,
          "MILD",
          `Losing digit ${d}'s bar is red — under fair share and still fading (share ` +
            `${press >= 0 ? "+" : ""}${(press * 100).toFixed(1)}pp vs baseline). Not building right ` +
            `now, but flagged because any bar on the losing side that isn't flat is worth watching — ` +
            `a heavily suppressed digit is a candidate to snap back.`,
          press,
        );
      }
    }
  }

  // ── Sensitive digits 0 / 1 / 8 / 9 on the losing side ─────────────────
  const special = c.specialRisk ?? intel.specialDigits ?? null;
  const sensitiveLosers = losers.filter((d) => SENSITIVE_DIGITS.includes(d));
  if (special && sensitiveLosers.length) {
    if (special.exposureRisk >= 70) {
      add(
        "SENSITIVE_DIGIT_PRESSURE",
        `Sensitive digit pressure (${sensitiveLosers.join("/")})`,
        "SEVERE",
        special.summary,
        special.exposureRisk,
      );
    } else if (special.exposureRisk >= 48) {
      add(
        "SENSITIVE_DIGIT_PRESSURE",
        `Sensitive digit pressure (${sensitiveLosers.join("/")})`,
        "HIGH",
        special.summary,
        special.exposureRisk,
      );
    } else if (special.exposureRisk >= 30) {
      add(
        "SENSITIVE_DIGIT_WATCH",
        `Sensitive digit watch (${sensitiveLosers.join("/")})`,
        "MILD",
        special.summary,
        special.exposureRisk,
      );
    }
  }

  // ── Conflicting gaining / losing digit groups ─────────────────────────
  const threat = c.threat;
  if (threat) {
    const conflicting = threat.risingLosers.length >= 2 && threat.asymmetry < 0.05;
    if (conflicting) {
      add(
        "GROUP_CONFLICT",
        "Conflicting digit groups",
        "HIGH",
        `${threat.risingLosers.length} losing digits (${threat.risingLosers.join(", ")}) are gaining while the winning side is not advancing (asymmetry ${(threat.asymmetry * 100).toFixed(0)}%).`,
        threat.groupThreat,
      );
    } else if (threat.state === "CRITICAL") {
      add(
        "LOSING_GROUP_CRITICAL",
        "Losing side critical",
        "SEVERE",
        threat.alerts[0] ?? `Group threat ${threat.groupThreat.toFixed(0)}.`,
        threat.groupThreat,
      );
    } else if (threat.state === "HIGH") {
      add(
        "LOSING_GROUP_HIGH",
        "Losing side pressure",
        "HIGH",
        threat.alerts[0] ?? `Group threat ${threat.groupThreat.toFixed(0)}.`,
        threat.groupThreat,
      );
    }
  }

  // ── LOSING_SIDE_PRESSURE aggregate: high AND rising, as one named signal ─
  // The per-digit reactivating/exhausted checks above catch individual
  // digits; this catches the aggregate the sentinel/losing-side-pressure
  // module already computes across the whole losing side — including its
  // hard SUPPRESS verdict (HOSTILE + 2 or more losing digits rising at once).
  const lsp = c.losingSidePressure ?? null;
  if (lsp) {
    if (lsp.verdict === "SUPPRESS") {
      add(
        "LOSING_SIDE_SUPPRESS",
        "Losing-side pressure — SUPPRESS",
        "SEVERE",
        lsp.reason,
        lsp.index,
      );
    } else if (lsp.verdict === "CAUTION") {
      add(
        "LOSING_SIDE_CAUTION",
        `Losing-side pressure — ${lsp.state.toLowerCase()}`,
        lsp.state === "HOSTILE" ? "HIGH" : "MODERATE",
        lsp.reason,
        lsp.index,
      );
    } else if (lsp.state === "BUILDING") {
      add("LOSING_SIDE_BUILDING", "Losing-side pressure building", "MILD", lsp.reason, lsp.index);
    }
  }

  // ── Counter-trend bar structure ───────────────────────────────────────
  // A rising green (up-tick) run works against an UNDER contract; a rising
  // red (down-tick) run works against an OVER contract — same green/red ↔
  // side convention already used as supporting evidence in apex/contracts.ts.
  // Only counted once the run is long enough to mean something (3+ bars).
  const bars = intel.bars;
  if (bars && bars.current && bars.n >= 30 && bars.consecutive >= 3) {
    const against =
      (c.side === "UNDER" && bars.current.color === "GREEN") ||
      (c.side === "OVER" && bars.current.color === "RED");
    if (against) {
      const longRun = bars.consecutive >= bars.longSequenceThreshold || bars.longGreenSequence;
      const severity: DangerSeverity = longRun
        ? "SEVERE"
        : bars.consecutive >= 8 || bars.directionalPersistence >= 0.62
          ? "HIGH"
          : bars.consecutive >= 5 || bars.directionalPersistence >= 0.55
            ? "MODERATE"
            : "MILD";
      add(
        "COUNTER_TREND_BARS",
        `${bars.current.color === "GREEN" ? "Rising green bars" : "Rising red bars"} against ${c.side}`,
        severity,
        `${bars.consecutive} consecutive ${bars.current.color} bar(s) (directional persistence ` +
          `${(bars.directionalPersistence * 100).toFixed(0)}%) running against a ${c.side} contract.` +
          (longRun ? " Long-sequence threshold reached." : ""),
        bars.consecutive,
      );
    }
  }

  // ── Critical / sensitive digit conflicts ──────────────────────────────
  if (c.critical && c.critical.conflicts.length >= 2) {
    add(
      "CRITICAL_CONFLICT",
      "Critical digit conflict",
      "SEVERE",
      c.critical.detail,
      c.critical.conflicts.length,
    );
  } else if (c.critical && c.critical.conflicts.length === 1) {
    add("CRITICAL_CONFLICT_SINGLE", "Sensitive-digit conflict", "MODERATE", c.critical.detail, 1);
  }

  // ── Repeated historical contract failures on THIS market + contract ───
  if (lifetime && lifetime.n >= 40 && lifetime.expectancy < -0.05) {
    add(
      "HISTORICAL_FAILURE",
      "Repeated historical failure",
      "AUTO_BLOCK",
      `This market + contract has failed repeatedly: expectancy ${lifetime.expectancy.toFixed(3)} over N=${lifetime.n} contract-resolved trades.`,
      lifetime.expectancy,
    );
  } else if (lifetime && lifetime.n >= 25 && lifetime.expectancy < 0) {
    add(
      "HISTORICAL_UNDERPERFORMANCE",
      "Historical underperformance",
      "SEVERE",
      `Negative record on this market + contract: expectancy ${lifetime.expectancy.toFixed(3)} over N=${lifetime.n}.`,
      lifetime.expectancy,
    );
  }
  if (recent && recent.n >= 8 && recent.longestLosingStreak >= 5) {
    add(
      "RECENT_LOSS_STREAK",
      "Recent loss streak",
      "MODERATE",
      `Rolling window shows a ${recent.longestLosingStreak}-loss streak over N=${recent.n}.`,
      recent.longestLosingStreak,
    );
  }

  // ── Losing-digit exposure bursts ──────────────────────────────────────
  const exposure = c.exposure ?? null;
  if (exposure && exposure.bursting.length) {
    add(
      "LOSING_DIGIT_BURST",
      `Losing digit burst (${exposure.bursting.join(", ")})`,
      exposure.state === "SEVERE" ? "SEVERE" : "HIGH",
      exposure.summary,
      exposure.losingDigitExposure,
    );
  }

  // ── Data integrity feeds danger too ───────────────────────────────────
  if (intel.dataState === "UNAVAILABLE" || intel.dataState === "STALE") {
    add(
      "DATA_UNUSABLE",
      "Feed unusable",
      "AUTO_BLOCK",
      intel.dataState === "STALE"
        ? `Feed silent for ${(intel.ageMs / 1000).toFixed(1)}s.`
        : "No tick data buffered for this market.",
      intel.ticks,
    );
  }

  const autoBlock = components.filter((x) => x.severity === "AUTO_BLOCK");
  const severe = components.filter((x) => x.severity === "SEVERE" || x.severity === "HIGH");

  // The total is composed from the labelled parts, with diminishing weight on
  // repeats of the same family so a single noisy family cannot dominate.
  const seen = new Map<string, number>();
  let total = 0;
  for (const comp of [...components].sort((a, b) => b.points - a.points)) {
    const family = comp.code.replace(/_\d+$/, "");
    const count = seen.get(family) ?? 0;
    seen.set(family, count + 1);
    total += comp.points * Math.pow(0.55, count);
  }
  total = Math.round(Math.max(0, Math.min(100, total)));
  if (autoBlock.length) total = 100;

  const level: DangerComposition["level"] =
    total >= 70
      ? "SEVERE"
      : total >= 48
        ? "HIGH"
        : total >= 28
          ? "MODERATE"
          : total >= 12
            ? "MILD"
            : "LOW";

  const summary = components.length
    ? `${level.toLowerCase()} — ${components
        .slice()
        .sort((a, b) => b.points - a.points)
        .slice(0, 2)
        .map((x) => x.label.toLowerCase())
        .join(", ")}`
    : "low — no danger component measured on this market/contract";

  return { total, level, components, autoBlock, severe, summary };
}
