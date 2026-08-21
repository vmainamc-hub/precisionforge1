// APEX SENTINEL — BOT-READY STRUCTURED OUTPUT.
//
// Sentinel is the intelligence layer, not the execution platform. This module
// serialises one ranked opportunity into a stable, machine-consumable object
// that an external XML/DBot bot can implement. It performs NO execution.
//
// The entry condition exported here is the SAME condition the simulator used
// to open its paper contracts — signal, simulation and bot instruction can
// never diverge.
import type { ClearanceReport } from "./clearance";
import type { EvidenceAssessment } from "./evidence-status";
import type { SimPerformance } from "./simulator";
import type { RankedOpportunity } from "./types";
import { apexSimulator } from "./simulator";
import { entryLab } from "./entry-conditions";

export interface BotStatBlock {
  n: number;
  wins: number;
  losses: number;
  win_rate: number;
  expectancy: number;
  net_pnl: number;
  max_drawdown: number;
  longest_losing_streak: number;
  longest_winning_streak: number;
  current_streak: number;
  lower_bound: number;
  upper_bound: number;
  tier: string;
}

export interface SentinelBotSignal {
  schema: "sentinel.signal.v1";
  generated_at: number;
  market: string;
  market_name: string;
  contract: string;
  contract_type: "DIGITUNDER" | "DIGITOVER";
  barrier: number;
  direction: "UNDER" | "OVER";
  duration_ticks: number;
  entry_condition: string;
  entry_condition_id: string;
  entry_parameters: {
    rule: string | null;
    family: string | null;
    description: string;
    trigger_now: boolean;
    current_trigger: string;
    state: string | null;
  };
  signal_timestamp: number;
  regime: string;
  confidence: number;
  uncertainty: number;
  danger_level: number;
  clearance: ClearanceReport["state"];
  clearance_risk: number;
  instability: { score: number; label: string };
  recent_statistics: BotStatBlock & { window_ms: number };
  lifetime_statistics: BotStatBlock;
  entry_condition_statistics: {
    label: string;
    n: number;
    win_rate: number;
    expectancy: number;
    state: string;
  } | null;
  reason_codes: string[];
  reason_text: string[];
  caution_text: string[];
  engine_votes: { engine: string; label: string; weight: number }[];
  evidence_status: EvidenceAssessment["status"];
  executable: boolean;
  disclaimer: string;
}

function statBlock(p: SimPerformance | null): BotStatBlock {
  return {
    n: p?.n ?? 0,
    wins: p?.wins ?? 0,
    losses: p?.losses ?? 0,
    win_rate: Number(((p?.winRate ?? 0) * 100).toFixed(2)),
    expectancy: Number((p?.expectancy ?? 0).toFixed(4)),
    net_pnl: Number((p?.netPnl ?? 0).toFixed(3)),
    max_drawdown: Number((p?.maxDrawdown ?? 0).toFixed(3)),
    longest_losing_streak: p?.longestLosingStreak ?? 0,
    longest_winning_streak: p?.longestWinningStreak ?? 0,
    current_streak: p?.currentStreak ?? 0,
    lower_bound: Number(((p?.lower ?? 0) * 100).toFixed(2)),
    upper_bound: Number(((p?.upper ?? 0) * 100).toFixed(2)),
    tier: p?.tier ?? "NONE",
  };
}

/**
 * Structured reason panel. Every line is backed by a measured value on this
 * market — no narrative is invented and nothing is imported from elsewhere.
 */
export function reasonPanel(op: RankedOpportunity): {
  why: string[];
  caution: string[];
  codes: string[];
} {
  const c = op.contract;
  const intel = op.intel;
  const why: string[] = [];
  const caution: string[] = [];
  const codes: string[] = [];

  for (const s of c.supports.slice(0, 5)) {
    why.push(`${s.label} — ${s.detail}${s.n ? ` (N=${s.n})` : ""}`);
    codes.push(`SUPPORT_${s.engine.replace(/\s+/g, "_").toUpperCase()}`);
  }
  if (intel.regime) {
    why.push(
      `Regime ${intel.regime.label} at ${intel.regime.confidence.toFixed(0)}% confidence — ${intel.regime.detail}`,
    );
    codes.push(`REGIME_${intel.regime.label}`);
  }
  if (op.entry?.best) {
    why.push(
      `Entry condition "${op.entry.best.label}" is ${op.entry.best.state} on this market/contract — expectancy ${op.entry.best.expectancy.toFixed(3)} over N=${op.entry.best.n}.`,
    );
    codes.push(`ENTRY_${op.entry.best.rule}`);
  }
  if (op.simulator?.n) {
    why.push(
      `This market's own contract-resolved record: ${(op.simulator.winRate * 100).toFixed(1)}% over N=${op.simulator.n} (${op.simulator.tier}).`,
    );
  }

  for (const r of op.clearance.reasons.filter((x) => x.severity !== "INFO").slice(0, 5)) {
    caution.push(r.text);
    codes.push(r.code);
  }
  caution.push(op.evidence.note);
  codes.push(...op.evidence.codes);
  for (const f of c.conflicts.slice(0, 3)) caution.push(`${f.label} — ${f.detail}`);

  return { why, caution, codes: [...new Set(codes)] };
}

/** Serialise one ranked opportunity into the bot-consumable contract. */
export function buildBotSignal(op: RankedOpportunity): SentinelBotSignal {
  const c = op.contract;
  const cfg = apexSimulator.getConfig();
  const recent = apexSimulator.recentPerformance(op.symbol, c.id, c.theoretical);
  const lifetime = op.simulator ?? apexSimulator.performance(op.symbol, c.id, c.theoretical);
  const entry = op.entry ?? entryLab.recommend(op.symbol, c.id, c.theoretical);
  const rules = entryLab.rules();
  const rule = entry.best ? (rules.find((r) => r.id === entry.best!.rule) ?? null) : null;
  const panel = reasonPanel(op);

  return {
    schema: "sentinel.signal.v1",
    generated_at: Date.now(),
    market: op.symbol,
    market_name: op.name,
    contract: c.label,
    contract_type: c.side === "UNDER" ? "DIGITUNDER" : "DIGITOVER",
    barrier: c.barrier,
    direction: c.side,
    duration_ticks: cfg.durationTicks,
    entry_condition: entry.best?.label ?? "IMMEDIATE (no validated condition yet)",
    entry_condition_id: entry.best?.rule ?? "IMMEDIATE",
    entry_parameters: {
      rule: entry.best?.rule ?? null,
      family: rule?.family ?? null,
      description: rule?.description ?? "Enter as soon as the contract qualifies.",
      trigger_now: entry.activeNow,
      current_trigger: entry.currentTrigger,
      state: entry.best?.state ?? null,
    },
    signal_timestamp: intelTimestamp(op),
    regime: op.intel.regime?.label ?? "UNKNOWN",
    confidence: op.evidence.confidence,
    uncertainty: op.evidence.uncertainty,
    danger_level: Math.round(c.danger),
    clearance: op.clearance.state,
    clearance_risk: op.clearance.risk,
    instability: { score: op.clearance.instability.score, label: op.clearance.instability.label },
    recent_statistics: { ...statBlock(recent), window_ms: cfg.recentWindowMs },
    lifetime_statistics: statBlock(lifetime),
    entry_condition_statistics: entry.best
      ? {
          label: entry.best.label,
          n: entry.best.n,
          win_rate: Number((entry.best.winRate * 100).toFixed(2)),
          expectancy: Number(entry.best.expectancy.toFixed(4)),
          state: entry.best.state,
        }
      : null,
    reason_codes: panel.codes,
    reason_text: panel.why,
    caution_text: panel.caution,
    engine_votes: [
      ...c.supports.map((e) => ({
        engine: e.engine,
        label: e.label,
        weight: Number(e.weight.toFixed(2)),
      })),
      ...c.conflicts.map((e) => ({
        engine: e.engine,
        label: e.label,
        weight: -Number(Math.abs(e.weight).toFixed(2)),
      })),
    ],
    evidence_status: op.evidence.status,
    executable: op.clearance.executable && op.evidence.status !== "UNDERPERFORMING",
    disclaimer:
      "Intelligence and paper-simulation output only. Sentinel performs no execution; the external bot owns all trading logic and risk.",
  };
}

function intelTimestamp(op: RankedOpportunity): number {
  return op.intel.lastTickAt || op.intel.updatedAt || Date.now();
}

export function botSignalJson(op: RankedOpportunity): string {
  return JSON.stringify(buildBotSignal(op), null, 2);
}
