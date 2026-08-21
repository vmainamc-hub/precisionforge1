// Precision Edge V7 — Chief Analyst.
//
// Philosophy (updated):
//   The psychology-of-numbers engine is the structural ground truth.
//   When it rejects a hypothesis, the Chief Analyst enforces that veto —
//   no amount of statistical edge can override a structurally misaligned
//   bar configuration. Psychology rejection → no signal, no exceptions.
//
//   For non-psychology factors (edge, momentum, migration, history, etc.)
//   the Chief remains a weighing engine rather than a gate engine. These
//   factors shape confidence and can push to WATCH but not CONFLICT.
//
// Hard vetoes (→ no READY signal):
//   1. Psychology REJECT — bar parity, zone, or digit 9/0 rule violation.
//   2. Severe manipulation spike (≥45%).
//   3. Fully collapsed psychology (≤2/7 mindset) with negative evidence net.
//   4. Overwhelming counter-evidence (evidenceNet < -0.4).

import type {
  ContractVerdict,
  DigitStatistics,
  Gate,
  MarketReasoning,
  VerdictState,
} from "./types";
import { psychologyReview, readPsychology } from "./psychology-of-numbers";

// ── EVIDENCE WEIGHTS ─────────────────────────────────────────────────────
const EVIDENCE_WEIGHTS: Record<string, number> = {
  Edge: 5,
  Migration: 4,
  "Structural digits": 4,
  "Digit compatibility": 5,
  "Market health": 3,
  "Trader alignment": 4,
  "Loser suppression": 4,
  Momentum: 3,
  Persistence: 3,
  "Historical agreement": 2,
  Fluctuation: 3,
  Manipulation: 3,
  "Scanner mindset": 4,
};
const MAX_EVIDENCE = Object.values(EVIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);

type EvidenceLean = "strongly-supports" | "supports" | "neutral" | "against" | "strongly-against";

function leanFromGate(g: Gate): EvidenceLean {
  if (g.name === "Scanner mindset") {
    const m = g.detail.match(/(\d)\s*\/\s*7/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 7) return "strongly-supports";
      if (n === 6) return "supports";
      if (n === 5) return "neutral";
      if (n === 4) return "against";
      return "strongly-against";
    }
  }
  if (g.name === "Historical agreement") {
    const m = g.detail.match(/(\d+)%/);
    if (m) {
      const p = parseInt(m[1], 10) / 100;
      if (p >= 0.7) return "strongly-supports";
      if (p >= 0.55) return "supports";
      if (p >= 0.45) return "neutral";
      if (p >= 0.35) return "against";
      return "strongly-against";
    }
  }
  if (g.name === "Fluctuation") {
    const m = g.detail.match(/(\d+)%/);
    if (m) {
      const f = parseInt(m[1], 10) / 100;
      if (f <= 0.2) return "strongly-supports";
      if (f <= 0.4) return "supports";
      if (f <= 0.6) return "neutral";
      if (f <= 0.75) return "against";
      return "strongly-against";
    }
  }
  return g.ok ? "supports" : "against";
}

function leanScore(l: EvidenceLean): number {
  return {
    "strongly-supports": 1,
    supports: 0.5,
    neutral: 0,
    against: -0.5,
    "strongly-against": -1,
  }[l];
}
function leanWord(l: EvidenceLean): string {
  return {
    "strongly-supports": "strongly supports",
    supports: "supports",
    neutral: "is neutral on",
    against: "is slightly against",
    "strongly-against": "argues against",
  }[l];
}

const CONTRADICT_MARK = /^\s*[✕✗×]\s+/;
function stripContradictions(reasons: string[]): string[] {
  return reasons.filter((r) => !CONTRADICT_MARK.test(r));
}

export interface AnalystReview {
  publishable: boolean;
  /**
   * Absolute veto. When true NOTHING — not pressure conviction, not evidence,
   * not a promotion rule — may publish this verdict.
   */
  hardVeto?: boolean;
  newState?: VerdictState;
  rejectionReason?: string;
  narrative: string;
  evidenceNet: number;
  cleanedReasons: string[];
  cleanedSupports: string[];
  cleanedConflicts: string[];
  confidenceAdjust: number;
}

/** Digits that LOSE this contract. */
function losingDigitsFor(v: ContractVerdict): Set<number> {
  const out = new Set<number>();
  for (let d = 0; d < 10; d++) {
    const win = v.side === "OVER" ? d > v.barrier : d < v.barrier;
    if (!win) out.add(d);
  }
  return out;
}

/**
 * OPERATOR LAW (non-negotiable):
 *   The Red bar (coldest digit) and the 2nd Red / Light-Red bar (2nd coldest)
 *   may NEVER sit on the losing side of a published signal — not one of them,
 *   not both. Cold losing digits mean the losing side is under-sampled: the
 *   observed win-rate is inflated and the bot bleeds when those digits
 *   normalise.
 *
 *   Inversely, when BOTH red bars sit in the WINNING zone — especially at the
 *   extreme end away from the barrier — and the Digit Pressure heatmap shows
 *   them RECOVERING (scarcity unwinding, pressure climbing back), that is a
 *   genuine positive: probability is rotating into digits that pay us.
 */
function redBarLaw(v: ContractVerdict, stats: DigitStatistics) {
  const bars = readPsychology(stats);
  const losers = losingDigitsFor(v);
  const red = bars.red;
  const lightRed = bars.lightRed;
  const offenders = [
    { name: "Red bar", d: red },
    { name: "2nd Red bar", d: lightRed },
  ].filter((b) => losers.has(b.d));

  if (offenders.length > 0) {
    return {
      veto: true as const,
      red,
      lightRed,
      reason:
        `Chief blocked — ${offenders.map((o) => `${o.name} d${o.d}`).join(" and ")} ` +
        `${offenders.length > 1 ? "are" : "is"} on the LOSING side of ${v.label}. ` +
        `Operator law: cold digits on the losing side mean losses are under-sampled — ` +
        `${offenders.map((o) => `d${o.d}`).join("/")} will normalise and take the trade out.`,
      bonus: 0,
      support: null as string | null,
    };
  }

  // Both red bars are winners — measure how extreme and whether they recover.
  const extremeness = (d: number) =>
    v.side === "OVER"
      ? (d - v.barrier) / Math.max(1, 9 - v.barrier)
      : (v.barrier - d) / Math.max(1, v.barrier);
  const extremeScore = (extremeness(red) + extremeness(lightRed)) / 2; // 0..1
  const recovering = [red, lightRed].filter((d) => {
    const p = stats.profiles[d];
    return p && (p.pressure > 0.002 || p.trend === "rising");
  });

  let bonus = 3; // baseline: both cold bars pay us
  if (extremeScore >= 0.66) bonus += 3;
  bonus += recovering.length * 3;
  bonus = Math.min(12, bonus);

  const where =
    extremeScore >= 0.66 ? "at the extreme end of the winning zone" : "inside the winning zone";
  const support =
    recovering.length === 2
      ? `Red-bar law ✓ — Red d${red} and 2nd Red d${lightRed} sit ${where} and the pressure heatmap shows BOTH recovering — scarcity is unwinding straight into ${v.label}.`
      : recovering.length === 1
        ? `Red-bar law ✓ — Red d${red} / 2nd Red d${lightRed} sit ${where}; d${recovering[0]} is recovering on the pressure heatmap.`
        : `Red-bar law ✓ — Red d${red} and 2nd Red d${lightRed} both sit ${where} (still flat on the pressure heatmap).`;

  return { veto: false as const, red, lightRed, reason: undefined, bonus, support };
}

function reviewVerdict(v: ContractVerdict, stats: DigitStatistics): AnalystReview {
  const gates = v.gates ?? [];
  const dir = v.side;

  // ── RED BAR / 2nd RED BAR LAW — ABSOLUTE ─────────────────────────────
  const redLaw = redBarLaw(v, stats);
  if (redLaw.veto) {
    return {
      publishable: false,
      hardVeto: true,
      newState: "REJECTED" as VerdictState,
      rejectionReason: redLaw.reason,
      narrative: `Chief Analyst · ${redLaw.reason}`,
      evidenceNet: -1,
      cleanedReasons: [],
      cleanedSupports: [],
      cleanedConflicts: [],
      confidenceAdjust: -40,
    };
  }

  // ── PSYCHOLOGY VETO ─────────────────────────────────────────────────
  const psyReview = psychologyReview(v, stats);

  if (psyReview.outcome === "reject") {
    return {
      publishable: false,
      hardVeto: true,
      newState: "WATCH" as VerdictState,
      rejectionReason: `Chief blocked — structural psychology: ${psyReview.reason ?? psyReview.narrative}`,
      narrative: `Chief Analyst · ${psyReview.narrative}`.trim(),
      evidenceNet: -1,
      cleanedReasons: [],
      cleanedSupports: [],
      cleanedConflicts: [],
      confidenceAdjust: -30,
    };
  }

  // Scanner Mindset — informative n/7 read used only for narrative & weight.
  const mindsetGate = gates.find((g) => g.name === "Scanner mindset");
  let mindsetScore: number | null = null;
  if (mindsetGate) {
    const m = mindsetGate.detail.match(/(\d)\s*\/\s*7/);
    if (m) mindsetScore = parseInt(m[1], 10);
  }
  const mindsetNarrative =
    mindsetScore === null
      ? ""
      : mindsetScore >= 6
        ? `Scanner Mindset ${mindsetScore}/7 — structurally aligned.`
        : mindsetScore >= 4
          ? `Scanner Mindset ${mindsetScore}/7 — partial alignment; evidence must carry the thesis.`
          : mindsetScore >= 3
            ? `Scanner Mindset ${mindsetScore}/7 — fragmented; hypothesis needs strong evidence to survive.`
            : `Scanner Mindset ${mindsetScore}/7 — psychological structure very weak.`;

  // Weighted evidence.
  const evidenceLines: string[] = [];
  let evidenceSum = 0;
  for (const g of gates) {
    const w = EVIDENCE_WEIGHTS[g.name];
    if (!w) continue;
    const lean = leanFromGate(g);
    evidenceSum += leanScore(lean) * w;
    if (lean !== "neutral") evidenceLines.push(`${g.name} ${leanWord(lean)} ${dir}`);
  }
  const evidenceNet = evidenceSum / MAX_EVIDENCE; // -1..+1

  const supports = v.supports ?? [];
  const conflicts = v.conflicts ?? [];

  const overall =
    evidenceNet >= 0.35
      ? `Overall evidence strongly favours ${dir}`
      : evidenceNet >= 0.1
        ? `Overall evidence favours ${dir}`
        : evidenceNet > -0.1
          ? `Overall evidence is mixed`
          : evidenceNet > -0.3
            ? `Overall evidence leans against ${dir}`
            : `Overall evidence contradicts ${dir}`;
  const evidenceSummary = evidenceLines.length
    ? `${evidenceLines.slice(0, 6).join(" · ")}. ${overall}.`
    : `${overall}.`;

  // Psychology WATCH — downgrade confidence but still allow signal if evidence is strong.
  const psyConfidenceAdjust = psyReview.outcome === "watch" ? -5 : psyReview.confidenceAdjust;
  const narrative =
    `Chief Analyst · ${redLaw.support ?? ""} ${psyReview.narrative} ${mindsetNarrative} ${evidenceSummary}`.trim();

  // ── V7 PUBLISH POLICY ──────────────────────────────────────────────
  let publishable = true;
  let newState: VerdictState | undefined;
  let rejectionReason: string | undefined;

  const manipGate = gates.find((g) => g.name === "Manipulation");
  const manipSevere =
    !!manipGate &&
    /(\d+)%/.test(manipGate.detail) &&
    parseInt(manipGate.detail.match(/(\d+)%/)![1], 10) >= 45;

  if (manipSevere) {
    publishable = false;
    newState = "CONFLICT";
    rejectionReason = `Chief withheld — critical manipulation spike detected.`;
  } else if (mindsetScore !== null && mindsetScore <= 2 && evidenceNet < 0.1) {
    publishable = false;
    newState = "BUILDING";
    rejectionReason = `Chief observing — psychological structure has collapsed (${mindsetScore}/7) and evidence has not yet formed a hypothesis.`;
  } else if (evidenceNet < -0.4) {
    publishable = false;
    newState = "WATCH";
    rejectionReason = `Chief watching — weighted evidence net ${(evidenceNet * 100).toFixed(0)}% opposes ${dir}. Reconsider once evidence rotates.`;
  }

  // Confidence adjustment.
  const mindsetConfidence =
    mindsetScore === null
      ? 0
      : mindsetScore >= 7
        ? 10
        : mindsetScore === 6
          ? 6
          : mindsetScore === 5
            ? 2
            : mindsetScore === 4
              ? 0
              : mindsetScore === 3
                ? -4
                : -8;
  const evidenceAdjust =
    evidenceNet >= 0 ? Math.min(10, evidenceNet * 14) : Math.max(-16, evidenceNet * 20);
  const confidenceAdjust = mindsetConfidence + evidenceAdjust + psyConfidenceAdjust + redLaw.bonus;

  const cleanedReasons = stripContradictions(v.reasons ?? []);
  const cleanedSupports = redLaw.support ? [redLaw.support, ...supports] : supports.slice();
  const cleanedConflicts = publishable ? conflicts.slice(0, 2) : conflicts.slice(0, 3);

  return {
    publishable,
    hardVeto: false,
    newState,
    rejectionReason,
    narrative,
    evidenceNet,
    cleanedReasons,
    cleanedSupports,
    cleanedConflicts,
    confidenceAdjust,
  };
}

/**
 * Chief Analyst pass. Psychology is a hard structural veto.
 * All other factors are weighted evidence. The Chief synthesises
 * them into a final state.
 */
export function applyAnalyst(r: MarketReasoning): MarketReasoning {
  const hyp = r.hypotheses?.dominant;
  for (const v of r.verdicts) {
    const review = reviewVerdict(v, r.stats);

    v.confidence = Math.max(0, Math.min(100, v.confidence + review.confidenceAdjust));
    v.reasons = review.cleanedReasons;
    v.supports = review.cleanedSupports;
    v.conflicts = review.cleanedConflicts;

    if (v.state === "READY" && !review.publishable) {
      // ── V4 PRESSURE OVERRIDE ──────────────────────────────────────────
      // The Digit Pressure / Scarcity engine is the new ground truth. When
      // it reports a fully qualified, high-conviction divergence — one side
      // building faster while the other exhausts — the Chief may express
      // doubt but may NOT withhold the signal. Missing that opportunity is
      // the failure mode we are engineering against.
      const p = v.pressure;
      const pressureOverride =
        !review.hardVeto && !!p && p.qualified && p.conviction >= 66 && review.evidenceNet > -0.35;
      if (pressureOverride) {
        v.rejection = null;
        v.supports = [`Published on pressure override — ${p!.headline}`, ...(v.supports ?? [])];
      } else {
        v.state = review.newState ?? "WATCH";
        v.rejection = review.rejectionReason ?? v.rejection;
      }
    }

    // Promote strong evidence out of WATCH/BUILDING into READY.
    if (
      (v.state === "WATCH" || v.state === "BUILDING") &&
      review.publishable &&
      v.confidence >= 68 &&
      review.evidenceNet >= 0.2
    ) {
      v.state = "READY";
      v.rejection = null;
    }

    // V4 — pressure-led promotion. A qualified scarcity unwind with real
    // conviction is publishable on its own evidence, even if the legacy
    // evidence ledger is merely neutral.
    if (
      (v.state === "WATCH" || v.state === "BUILDING") &&
      !review.hardVeto &&
      v.pressure?.qualified &&
      v.pressure.conviction >= 64 &&
      review.evidenceNet > -0.25
    ) {
      v.state = "READY";
      v.rejection = null;
    }

    // Final backstop: a hard veto can never end the pass in a publishable
    // state, whatever any downstream rule did above.
    if (review.hardVeto && (v.state === "READY" || v.state === "TRANSITION")) {
      v.state = review.newState ?? "REJECTED";
      v.rejection = review.rejectionReason ?? v.rejection;
    }

    if (v.state === "READY") {
      const parts: string[] = [];
      if (hyp) {
        parts.push(
          `Dominant hypothesis · ${hyp.label} (${(hyp.strength * 100).toFixed(0)}%). ${hyp.narrative}`,
        );
        if (v.hypothesisAlignmentLabel) parts.push(v.hypothesisAlignmentLabel);
      }
      parts.push(review.narrative);
      if (v.quality && v.quality.tier !== "NONE") {
        parts.push(`${v.quality.symbol} ${v.quality.label} — ${v.quality.detail}`);
      }
      if (v.persistence) parts.push(v.persistence.narrative);
      if (v.recovery) parts.push(v.recovery.narrative);
      v.reasons = [...parts, ...v.reasons];
    }
  }

  for (const v of r.verdicts) {
    const align = v.hypothesisAlignment ?? 0;
    if (v.state === "READY" && v.confidence >= 82 && align >= 0.5) {
      v.quality = {
        tier: "PREMIUM",
        symbol: "⭐",
        label: "Premium Setup",
        detail: "Chief Analyst reports decisive evidence with strong hypothesis alignment.",
      };
    } else if (v.state === "READY") {
      v.quality = {
        tier: "STANDARD",
        symbol: "✅",
        label: "Standard Setup",
        detail: "Chief Analyst reports balance of evidence supports entry.",
      };
    } else if ((v.state === "WATCH" || v.state === "BUILDING") && align > 0.05) {
      v.quality = {
        tier: "DEVELOPING",
        symbol: "👀",
        label: "Developing Setup",
        detail: "Evidence is rotating — the Chief is watching for a coherent story.",
      };
    } else {
      v.quality = { tier: "NONE", symbol: "", label: "", detail: "" };
    }
  }

  const ready = r.verdicts
    .filter((v) => v.state === "READY")
    .sort((a, b) => b.consistency - a.consistency);
  r.best = ready[0] ?? null;

  if (r.best) {
    r.best.alternativesRejected = r.verdicts
      .filter((v) => v.id !== r.best!.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        reason:
          v.rejection ??
          (v.state === "READY"
            ? `also viable but ${(r.best!.consistency - v.consistency).toFixed(1)} less consistent`
            : `state ${v.state} — ${v.gateFailed ?? "evidence not yet coherent"}`),
      }));
  }
  return r;
}
