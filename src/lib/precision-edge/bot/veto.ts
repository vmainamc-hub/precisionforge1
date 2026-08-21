// VETO STACK — hard blocks. A veto is not a weight: if any veto is armed the
// system cannot say BOT_ON, no matter how good the fused score looks.
import type { BotSignalConfig } from "./config";
import type { EquilibriumReading } from "./equilibrium";
import type { SimResult } from "./simulator";
import { martingaleSurvival } from "./simulator";
import type { BurstForecast } from "./burst";
import type { QualityMetrics } from "./quality";
import { BOT_SPEC, type BotBarrier } from "./spec";
import { describeEdgeBalance } from "./edges";

export type VetoSeverity = "BLOCK" | "WARN";

export interface Veto {
  id: string;
  severity: VetoSeverity;
  title: string;
  detail: string;
}

export interface VetoInput {
  cfg: BotSignalConfig;
  equilibrium: EquilibriumReading;
  canonicalSim: SimResult | null;
  burst: BurstForecast;
  countLoss: number;
  /** Empirical win rate per bot barrier over the canonical window. */
  barrierEmpirical: Record<BotBarrier, number>;
  /** Calibration reliability, 0-1. */
  calibration: number;
  ticks: number;
  /** Operator-facing quality metrics (edge, manipulation, fluctuation…). */
  quality: QualityMetrics;
}

/** Ordered strongest-first. Consumers show them in this order. */
export function buildVetoStack(input: VetoInput): Veto[] {
  const { cfg, equilibrium: eq, canonicalSim, burst, countLoss } = input;
  const v: Veto[] = [];
  const on = (id: string) => cfg.vetoes[id] !== false;

  if (on("insufficientTicks") && input.ticks < cfg.canonicalWindow) {
    v.push({
      id: "insufficientTicks",
      severity: "BLOCK",
      title: "Not enough history",
      detail: `${input.ticks}/${cfg.canonicalWindow} ticks collected. The Equilibrium Doctrine is measured over ${cfg.canonicalWindow} ticks.`,
    });
  }

  if (on("equilibriumBroken") && (eq.band === "BROKEN" || eq.score < cfg.minEquilibriumScore)) {
    v.push({
      id: "equilibriumBroken",
      severity: "BLOCK",
      title: "Equilibrium broken",
      detail: `Over 4 sits at ${eq.over4Pct.toFixed(2)}% (E=${eq.error.toFixed(2)}pp, band ${eq.band}). The bot needs Over 4 / Under 5 at 50/50.`,
    });
  }

  if (on("equilibriumOffCentre") && eq.error > cfg.maxEquilibriumError) {
    v.push({
      id: "equilibriumOffCentre",
      severity: "BLOCK",
      title: "Outside the 50% ± tolerance band",
      detail: `Over 4 = ${eq.over4Pct.toFixed(2)}% / Under 5 = ${eq.under5Pct.toFixed(2)}% over ${cfg.canonicalWindow} ticks (E=${eq.error.toFixed(2)}pp). The bot only trades within 50% ± ${cfg.maxEquilibriumError.toFixed(2)}%.`,
    });
  }

  if (on("equilibriumDrift") && Math.abs(eq.driftVelocity) > cfg.maxDriftVelocity) {
    v.push({
      id: "equilibriumDrift",
      severity: eq.band === "PERFECT" || eq.band === "PRIME" ? "WARN" : "BLOCK",
      title: "Equilibrium drifting",
      detail: `Kalman drift ${eq.driftVelocity >= 0 ? "+" : ""}${eq.driftVelocity.toFixed(2)}pp/100t towards ${eq.driftSide}. Balance is walking away from 50/50.`,
    });
  }

  if (on("barrierBelowTheory")) {
    const offenders = (Object.keys(BOT_SPEC.theory) as unknown as BotBarrier[])
      .map((k) => Number(k) as BotBarrier)
      .filter((b) => {
        const emp = input.barrierEmpirical[b];
        return emp !== undefined && emp < BOT_SPEC.theory[b] - 0.04;
      });
    if (offenders.length) {
      v.push({
        id: "barrierBelowTheory",
        severity: offenders.length >= 3 ? "BLOCK" : "WARN",
        title: "Bot barriers underperforming",
        detail: offenders
          .map(
            (b) =>
              `barrier ${b}: ${(input.barrierEmpirical[b] * 100).toFixed(1)}% vs theory ${(BOT_SPEC.theory[b] * 100).toFixed(0)}%`,
          )
          .join(" · "),
      });
    }
  }

  if (on("martingaleUnsurvivable") && canonicalSim) {
    const s = martingaleSurvival(canonicalSim, countLoss, cfg.martingaleDepth);
    if (!s.survivable) {
      v.push({
        id: "martingaleUnsurvivable",
        severity: "BLOCK",
        title: "Martingale ladder unsurvivable",
        detail: `Longest simulated loss streak is ${canonicalSim.longestLossStreak}; from CountLoss ${countLoss} that needs ${s.requiredStake.toFixed(1)}× base stake and exceeds your ${cfg.martingaleDepth}-step ladder.`,
      });
    }
  }

  // Operator control: "Min persistence (winning streak)". A setup whose best
  // simulated win run is shorter than the operator's floor is not persistent
  // enough to trade, no matter how good the fused score is.
  if (on("persistenceTooShort") && canonicalSim && cfg.minPersistenceTicks > 0) {
    if (canonicalSim.longestWinStreak < cfg.minPersistenceTicks) {
      v.push({
        id: "persistenceTooShort",
        severity: "BLOCK",
        title: "Persistence below floor",
        detail: `Best simulated winning run over ${canonicalSim.window} ticks is ${canonicalSim.longestWinStreak}, your floor is ${cfg.minPersistenceTicks}.`,
      });
    }
  }

  if (on("lateStageBurst") && burst.lateStage) {
    v.push({
      id: "lateStageBurst",
      severity: "WARN",
      title: "Late-stage burst",
      detail: `${burst.side} burst is ${(burst.maturity * 100).toFixed(0)}% extended — the bot would be entering into likely mean reversion.`,
    });
  }

  if (on("hiddenAccumulation") && eq.stability < 50 && eq.band !== "PERFECT") {
    v.push({
      id: "hiddenAccumulation",
      severity: "WARN",
      title: "Hidden accumulation",
      detail: `Only ${eq.stability.toFixed(0)}% of measured windows are inside the prime band — short and long horizons disagree.`,
    });
  }

  if (on("calibrationUnreliable") && input.calibration < cfg.minCalibrationReliability) {
    v.push({
      id: "calibrationUnreliable",
      severity: "WARN",
      title: "Confidence not yet reliable",
      detail: `Calibration reliability ${(input.calibration * 100).toFixed(0)}% — treat the score as provisional.`,
    });
  }

  // ── Operator quality gates: Manipulation · Edge · Fluctuation ────────────
  const q = input.quality;

  if (on("manipulationTooHigh") && q.manipulation >= cfg.maxManipulation) {
    v.push({
      id: "manipulationTooHigh",
      severity: "BLOCK",
      title: "Manipulation above cap",
      detail: `Distribution anomaly ${q.manipulation}% is at or above your ${cfg.maxManipulation}% cap — the digit stream is not behaving randomly.`,
    });
  }

  if (on("edgeBelowFloor") && canonicalSim && canonicalSim.trades > 0) {
    if (q.edgePct < cfg.minEdgePct) {
      v.push({
        id: "edgeBelowFloor",
        severity: "BLOCK",
        title: "Edge below floor",
        detail: `Realised edge ${q.edgePct.toFixed(2)}% per trade over ${canonicalSim.window} ticks, your floor is ${cfg.minEdgePct.toFixed(1)}%.`,
      });
    }
  }

  if (on("fluctuationTooHigh") && q.fluctuation > cfg.fluctuationTolerance) {
    v.push({
      id: "fluctuationTooHigh",
      severity: "BLOCK",
      title: "Fluctuation above tolerance",
      detail: `Measurement windows disagree by ${q.fluctuationSpreadPp.toFixed(2)}pp (fluctuation ${q.fluctuation.toFixed(2)} vs tolerance ${cfg.fluctuationTolerance.toFixed(2)}).`,
    });
  }

  // PRIMARY LAW 2 — BALANCED EDGES. The 0/1 edge and the 8/9 edge must sit on
  // top of each other. A skewed pair feeds the martingale ladder a one-sided
  // tape even when the Over-4 / Under-5 split looks perfectly centred.
  const eb = q.edgeBalance;
  if (on("edgesUnbalanced") && eb.samples >= 100) {
    if (eb.imbalancePp > cfg.maxEdgeImbalance || eb.score < cfg.minEdgeBalanceScore) {
      v.push({
        id: "edgesUnbalanced",
        severity: "BLOCK",
        title: "Edges unbalanced",
        detail: `${describeEdgeBalance(eb)} — the ${eb.heavySide === "LOW" ? "0/1" : "8/9"} edge is heavier than your ±${cfg.maxEdgeImbalance.toFixed(1)}pp tolerance.`,
      });
    } else if (eb.massErrorPp > cfg.maxEdgeImbalance * 2) {
      v.push({
        id: "edgesUnbalanced",
        severity: "WARN",
        title: "Edge mass off fair",
        detail: `Edges hold ${eb.totalPct.toFixed(2)}% of the window against a fair 40% — balanced against each other, but ${eb.totalPct > 40 ? "over" : "under"}-represented overall.`,
      });
    }
  }

  const rank = (x: Veto) => (x.severity === "BLOCK" ? 0 : 1);
  return v.sort((a, b) => rank(a) - rank(b));
}

export function hasBlock(vetoes: Veto[]): boolean {
  return vetoes.some((v) => v.severity === "BLOCK");
}
