// Precision Parity AI — Run Lifecycle & Hazard Rate Visualizer.
// Visualizes active streak length, historical run distribution, and the empirical hazard function P(break | length >= k).

import type { ParityRunEngineResult } from "@/lib/precision-parity/engines/run-hazard-engine";
import { Flame, ShieldAlert, Activity, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  runs: ParityRunEngineResult;
}

export function RunHazardVisualizer({ runs }: Props) {
  const isEven = runs.activeSide === "EVEN";
  const hazardPct = runs.pBreakNextTick * 100;
  const lowerBoundPct = runs.hazardConfidenceBounds.lower * 100;
  const upperBoundPct = runs.hazardConfidenceBounds.upper * 100;

  return (
    <div
      id="parity-run-hazard-visualizer"
      className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Run Lifecycle & Hazard Predictor</h3>
            <p className="text-[11px] text-slate-400">
              Streak duration and empirical termination hazard $\lambda(k)$
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold font-mono border",
              isEven
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
            )}
          >
            ACTIVE: {runs.activeSide} (x{runs.activeLength})
          </span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300">
            Status: <span className="font-semibold text-white">{runs.runStatus}</span>
          </span>
        </div>
      </div>

      {/* Streak Progress & Hazard Meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Left: Active Streak Bar */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Active Streak Length
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
              <span>{runs.activeLength} ticks</span>
              <span className="text-xs font-normal text-slate-400">
                (Avg: {isEven ? runs.averageRunLength.even : runs.averageRunLength.odd})
              </span>
            </div>
          </div>

          {/* Visual run dots */}
          <div className="flex items-center gap-1.5 mt-3">
            {Array.from({ length: Math.min(10, Math.max(5, runs.activeLength + 2)) }).map(
              (_, i) => {
                const isActive = i < runs.activeLength;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 h-3 rounded transition-all",
                      isActive
                        ? isEven
                          ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                          : "bg-indigo-400 shadow-sm shadow-indigo-400/50"
                        : "bg-slate-800 border border-slate-700",
                    )}
                  />
                );
              },
            )}
          </div>

          <div className="text-[10px] text-slate-400 mt-2 flex justify-between">
            <span>
              Historical max:{" "}
              {isEven ? runs.longestRunHistorical.even : runs.longestRunHistorical.odd}t
            </span>
            <span>Total runs observed: {runs.totalRunsObserved}</span>
          </div>
        </div>

        {/* Center: Hazard Rate */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Break Hazard P(Terminates Next Tick)
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1 flex items-baseline gap-2">
              <span>{hazardPct.toFixed(1)}%</span>
              <span className="text-xs font-normal text-slate-400">
                [95% CI: {lowerBoundPct.toFixed(0)}%–{upperBoundPct.toFixed(0)}%]
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  hazardPct >= 65
                    ? "bg-red-500"
                    : hazardPct >= 50
                      ? "bg-amber-400"
                      : "bg-emerald-400",
                )}
                style={{ width: `${Math.min(100, hazardPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
              <span>0% (Continue)</span>
              <span>50% (Baseline)</span>
              <span>100% (Certain Break)</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 mt-2">
            Sample depth at length {runs.activeLength}: N={runs.sampleSizeAtThisLength} runs
          </div>
        </div>

        {/* Right: Prescribed Action */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Prescribed Streak Strategy
            </div>
            <div className="text-lg font-bold text-white font-mono mt-1">
              {runs.suggestedAction}
            </div>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed mt-2">
            {runs.suggestedAction === "RIDE_RUN" &&
              `Run is developing (${runs.activeLength} ticks). Ride current ${runs.activeSide} momentum.`}
            {runs.suggestedAction === "WAIT_FOR_BREAK" &&
              `Run is extended (${runs.activeLength} ticks). Do not enter continuation; wait for break confirmation.`}
            {runs.suggestedAction === "FADE_RUN" &&
              `Exhaustion warning: active run is in top 5th percentile. Fade ${runs.activeSide} on break.`}
            {runs.suggestedAction === "NEUTRAL" &&
              "Streak is at fresh base level (1 tick). Awaiting structural alignment."}
          </div>

          <div className="text-[10px] text-slate-500 mt-2">
            Hazard-controlled entry protection active
          </div>
        </div>
      </div>
    </div>
  );
}
