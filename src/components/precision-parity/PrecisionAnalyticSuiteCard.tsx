// Precision Parity & Digit Intelligence Suite Card
// High-density institutional monitoring panel rendering EV Gate, Conformal Bounds, Bootstrap Significance, 4-State HMM, Particle ESS, CUSUM Drift, and 42-Contract Monte Carlo Simulation.

import React from "react";
import type { MarketParityReport } from "@/lib/precision-parity/types";
import {
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  BarChart2,
  TrendingUp,
  Cpu,
  Layers,
  Crosshair,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  report: MarketParityReport;
}

export function PrecisionAnalyticSuiteCard({ report }: Props) {
  const v = report.verdict;
  const evGate = report.evGate || v.evGate;
  const significance = report.significance || v.significance;
  const particles = report.particles || v.particles;
  const hmm = report.hmm || v.hmm;
  const drift = report.drift || v.drift;
  const conformal = report.conformal || v.conformal;
  const digitPlan = report.digitPlan || v.digitPlan;
  const decorrelation = report.decorrelation || v.decorrelation;
  const validation = report.validation || v.validation;

  return (
    <div
      id="precision-analytic-suite-card"
      className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                12-Engine Precision Intelligence Matrix
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Harmonized
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Block bootstrap, 4-state HMM, SMC particle filtering, CUSUM drift & conformal EV
              gating
            </p>
          </div>
        </div>

        {evGate && (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-1.5",
                evGate.status === "READY"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30",
              )}
            >
              <Gauge className="w-3.5 h-3.5" />
              EV GATE: {evGate.status} (+{(evGate.evLow * 100).toFixed(2)}% EV Low)
            </div>
          </div>
        )}
      </div>

      {/* Grid of Specialized Engine Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. EV Gate & Quarter-Kelly */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> EV & Kelly Gate
            </span>
            <span className="font-mono text-[11px] text-slate-300">
              Stake: {evGate ? (evGate.recommendedStakePct * 100).toFixed(2) : "0.00"}%
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {evGate ? `+${(evGate.evLow * 100).toFixed(2)}%` : "0.00%"}
            <span className="text-xs font-normal text-slate-400 ml-1.5">EV Low</span>
          </div>
          <div className="text-[11px] text-slate-400 leading-tight">
            {conformal ? (
              <span>
                90% Conformal: [{(conformal.intervalLow * 100).toFixed(1)}% -{" "}
                {(conformal.intervalHigh * 100).toFixed(1)}%]
              </span>
            ) : (
              "Calculating conformal interval..."
            )}
          </div>
        </div>

        {/* 2. Bootstrap Significance & FDR */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <BarChart2 className="w-4 h-4 text-cyan-400" /> Bootstrap Significance
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                significance?.significant
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300",
              )}
            >
              {significance?.significant ? "SIGNIFICANT" : "NULL ACCEPTED"}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            q = {significance ? significance.qValue.toFixed(4) : "0.5000"}
          </div>
          <div className="text-[11px] text-slate-400 leading-tight">
            Bootstrap 95% Bound:{" "}
            <span className="font-mono text-slate-200">
              {significance ? `${(significance.bootstrapLower * 100).toFixed(1)}%` : "50.0%"}
            </span>{" "}
            (vs 51.28% BEP)
          </div>
        </div>

        {/* 3. SMC Particle Filter & HMM State */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <Activity className="w-4 h-4 text-purple-400" /> Particle & HMM
            </span>
            <span className="font-mono text-[11px] text-purple-300">
              ESS: {particles ? `${((particles.effectiveParticles / 2000) * 100).toFixed(0)}%` : "100%"}
            </span>
          </div>
          <div className="text-base font-bold font-mono text-white truncate">
            {hmm ? hmm.currentState.replace("_", " ") : "STATIONARY"}
          </div>
          <div className="text-[11px] text-slate-400 leading-tight">
            Dwell Expectancy:{" "}
            <span className="font-mono text-slate-200">
              {hmm ? `${hmm.expectedDwellTicks} ticks` : "3 ticks"}
            </span>{" "}
            (p={particles ? `${(particles.posteriorMeanEven * 100).toFixed(1)}%` : "50%"})
          </div>
        </div>

        {/* 4. Structural Break & Drift */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <AlertTriangle
                className={cn(
                  "w-4 h-4",
                  drift?.breakDetected ? "text-amber-400" : "text-slate-400",
                )}
              />{" "}
              Drift & CUSUM
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono",
                drift?.severity === "MAJOR"
                  ? "bg-red-500/20 text-red-300"
                  : drift?.severity === "MINOR"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-emerald-500/20 text-emerald-300",
              )}
            >
              {drift?.severity ?? "NONE"}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {drift?.breakDetected ? "SHIFT DETECTED" : "STABLE REGIME"}
          </div>
          <div className="text-[11px] text-slate-400 leading-tight truncate">
            Decorrelation:{" "}
            {decorrelation ? `${decorrelation.effectiveVotes.toFixed(1)} effective votes` : "0.0"}
          </div>
        </div>
      </div>

      {/* Digit Entry Arbiter & Tactical Trigger */}
      {digitPlan && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Precision Digit Tactical Arbiter Plan
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">
                GRADE {digitPlan.grade}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-300">
              Action: <span className="font-bold text-white">{digitPlan.entryMode}</span> | Target:{" "}
              <span className="font-bold text-cyan-300">
                {digitPlan.contract} {digitPlan.barrier !== null ? digitPlan.barrier : ""}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                Trigger Rule
              </div>
              <div className="font-semibold text-slate-200 mt-0.5">
                {digitPlan.trigger.description}
              </div>
            </div>
            <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                Execution Dwell & Sizing
              </div>
              <div className="font-semibold text-slate-200 mt-0.5">
                {digitPlan.recommendedRuns} runs max · {(digitPlan.stakeFraction * 100).toFixed(2)}%
                stake (Quarter-Kelly)
              </div>
            </div>
            <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                Expiry Protocol
              </div>
              <div className="font-semibold text-slate-200 mt-0.5">
                {digitPlan.expirySeconds}s ({digitPlan.expiryTicks} ticks) · Strict CUSUM Abort
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
