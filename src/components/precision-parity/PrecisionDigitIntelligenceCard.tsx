// Precision Digit Intelligence Card
// Visualizes the 10x10 Transition Tensor, Digit Hazard Curve, 42-Contract Monte Carlo Universe, and Threshold Sweep.

import React, { useState } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeTransitionTensor,
  computeDigitHazards,
  runDigitSimulationLoop,
  sweepThresholds,
} from "@/lib/precision-digit";

interface Props {
  digits: number[];
  marketName: string;
}

export function PrecisionDigitIntelligenceCard({ digits = [], marketName }: Props) {
  const safeDigits = digits ?? [];
  const [activeSubTab, setActiveSubTab] = useState<"tensor" | "hazard" | "sim42" | "sweep">(
    "sim42",
  );

  // Run analytical engines on current digit stream
  const tensor = React.useMemo(() => computeTransitionTensor(safeDigits), [safeDigits]);
  const hazard = React.useMemo(() => computeDigitHazards(safeDigits), [safeDigits]);
  const sim = React.useMemo(
    () => runDigitSimulationLoop(safeDigits, marketName),
    [safeDigits, marketName],
  );
  const sweep = React.useMemo(() => sweepThresholds(safeDigits), [safeDigits]);

  const lastDigit = safeDigits.length > 0 ? safeDigits[safeDigits.length - 1] : 0;

  return (
    <div
      id="precision-digit-intelligence-card"
      className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-5 space-y-4 shadow-xl"
    >
      {/* Header with engine subtabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Precision Digit Mathematical Core
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                {marketName} · {digits.length} Ticks
              </span>
            </div>
            <p className="text-xs text-slate-400">
              3D Transition Tensor, Digit Arrival Hazards & 42-Contract Monte Carlo Simulation
            </p>
          </div>
        </div>

        {/* Subtab selection pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab("sim42")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeSubTab === "sim42"
                ? "bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            42-Contract Universe
          </button>
          <button
            onClick={() => setActiveSubTab("tensor")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeSubTab === "tensor"
                ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            Transition Tensor
          </button>
          <button
            onClick={() => setActiveSubTab("hazard")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeSubTab === "hazard"
                ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            Digit Hazards
          </button>
          <button
            onClick={() => setActiveSubTab("sweep")}
            className={cn(
              "px-3 py-1 rounded-lg transition-all",
              activeSubTab === "sweep"
                ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            Over/Under Sweep
          </button>
        </div>
      </div>

      {/* SUBTAB 1: 42-Contract Monte Carlo Universe */}
      {activeSubTab === "sim42" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Simulated across all 42 barrier combinations (5,000 paths each):</span>
            <span className="font-mono text-emerald-400 font-semibold">
              Top EV: +{(sim.topCandidate.evLow * 100).toFixed(2)}% ({sim.topCandidate.contract}{" "}
              {sim.topCandidate.barrier !== null ? sim.topCandidate.barrier : ""})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(sim?.candidates ?? []).slice(0, 6).map((c, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-xl border transition-all",
                  c.evLow > 0
                    ? "bg-emerald-950/20 border-emerald-500/30"
                    : "bg-white/[0.02] border-white/5",
                )}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white">
                    {c.contract} {c.barrier !== null ? `Barrier ${c.barrier}` : ""}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold",
                      c.evLow > 0
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-800 text-slate-400",
                    )}
                  >
                    EV Low: {c.evLow > 0 ? "+" : ""}
                    {(c.evLow * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-2 text-[11px] font-mono text-slate-400">
                  <div>
                    <span className="text-[9px] block text-slate-500">Win Rate</span>
                    <span className="text-slate-200 font-bold">
                      {(c.simWinRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-500">Max DD</span>
                    <span className="text-slate-200 font-bold">
                      {(c.maxDrawdown * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] block text-slate-500">Worst Streak</span>
                    <span className="text-amber-300 font-bold">{c.worstStreak} loss</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 font-mono bg-black/30 p-2.5 rounded-xl border border-white/5">
            {sim.narrative}
          </div>
        </div>
      )}

      {/* SUBTAB 2: 3D Transition Tensor */}
      {activeSubTab === "tensor" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Dirichlet(0.5) Smoothed Transition Probabilities P(next = d):</span>
            <span className="font-mono text-cyan-400">Active Digit: {lastDigit}</span>
          </div>

          <div className="grid grid-cols-10 gap-1 overflow-x-auto text-center font-mono text-xs">
            {Array.from({ length: 10 }).map((_, d) => (
              <div key={d} className="space-y-1">
                <div className="text-[10px] text-slate-400 font-bold">{d}</div>
                <div
                  className={cn(
                    "p-2 rounded-lg border text-[11px] font-bold",
                    tensor.probs[d] > 0.12
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                      : "bg-white/[0.03] text-slate-300 border-white/5",
                  )}
                >
                  {(tensor.probs[d] * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300">
            <span className="text-cyan-400 font-bold">Top Transition Vectors:</span>{" "}
            {(tensor?.dominantTransitions ?? []).slice(0, 3).map((t, i) => (
              <span key={i} className="mr-3 font-mono">
                {t.from} → {t.to} ({(t.prob * 100).toFixed(1)}%, q={t.qValue.toFixed(3)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: Digit Arrival Hazards */}
      {activeSubTab === "hazard" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Inter-arrival Gaps vs Geometric Theoretical Null ($p = 0.1$):</span>
            <span className="font-mono text-emerald-400">
              Most Overdue: Digit {hazard.mostOverdue.digit} (Gap: {hazard.mostOverdue.currentGap}{" "}
              ticks)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
            {hazard.hazards.map((h) => (
              <div
                key={h.digit}
                className={cn(
                  "p-2.5 rounded-xl border space-y-1",
                  h.isNonGeometric
                    ? "bg-emerald-950/30 border-emerald-500/40"
                    : "bg-white/[0.02] border-white/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Digit {h.digit}</span>
                  <span className="text-[10px] text-slate-400">Gap: {h.currentGap}</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Median Gap: <span className="text-white font-bold">{h.medianGap}</span>
                </div>
                <div className="text-[10px] text-slate-400">Percentile: {h.gapPercentile}%</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 font-mono bg-black/30 p-2.5 rounded-xl border border-white/5">
            {hazard.narrative}
          </div>
        </div>
      )}

      {/* SUBTAB 4: Over/Under Barrier Sweep */}
      {activeSubTab === "sweep" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ranked Barrier Over/Under Contracts (Wilson 90% Conservative EV):</span>
            <span className="font-mono text-amber-400">
              Top: {sweep.bestContract.contract} Barrier {sweep.bestContract.barrier} (EV Low: +
              {(sweep.bestContract.evLow * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            {(sweep?.rankedContracts ?? []).slice(0, 8).map((pt, i) => (
              <div
                key={i}
                className={cn(
                  "p-2.5 rounded-lg border text-center",
                  pt.evLow > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-sm"
                    : "bg-white/[0.02] text-slate-300 border-white/5",
                )}
              >
                <div className="text-[10px] text-slate-400">
                  {pt.contract} {pt.barrier} (Payout {pt.derivPayout}x)
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  EV Low: {pt.evLow > 0 ? "+" : ""}
                  {(pt.evLow * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">
                  Win Rate: {(pt.probPoint * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
