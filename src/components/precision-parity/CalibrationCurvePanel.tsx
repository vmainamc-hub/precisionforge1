// Precision Parity AI — Calibration Curve & Reliability Visualizer.
// Plots claimed confidence buckets (50-55, 55-60, ...) against realized hit rates and displays the Brier score.

import { useEffect, useState } from "react";
import {
  ParityCalibrationTracker,
  type CalibrationReport,
} from "@/lib/precision-parity/engines/calibration-engine";
import { Target, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CalibrationCurvePanel() {
  const [report, setReport] = useState<CalibrationReport>(() =>
    ParityCalibrationTracker.get().getReport(),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setReport(ParityCalibrationTracker.get().getReport());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="parity-calibration-curve-panel"
      className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Reliability & Calibration Curve</h3>
            <p className="text-[11px] text-slate-400">
              Claimed confidence vs empirical win-rate (Isotonic PAVA shrinkage)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono">
            Brier Score:{" "}
            <span className="font-bold text-white">{report.brierScore.toFixed(3)}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono">
            Sample: <span className="font-bold text-white">{report.totalRecorded}</span> trades
          </div>
        </div>
      </div>

      {/* Visual Bins Bar Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {report.bins.map((bin) => {
          const isAdequate = bin.totalPredictions >= 5;
          const diff = bin.realizedHitRate - bin.midpoint;
          const isWellCalibrated = Math.abs(diff) <= 4;

          return (
            <div
              key={bin.binId}
              className={cn(
                "p-3 rounded-xl border flex flex-col justify-between transition-all",
                isAdequate
                  ? isWellCalibrated
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-amber-500/5 border-amber-500/30"
                  : "bg-slate-950/40 border-white/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  {bin.binId}% Conf
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400 font-mono">
                  N={bin.totalPredictions}
                </span>
              </div>

              <div className="my-2">
                <div className="text-sm font-bold text-white font-mono flex items-baseline justify-between">
                  <span>{bin.realizedHitRate.toFixed(1)}%</span>
                  <span className="text-[10px] text-slate-400 font-normal">Realized</span>
                </div>

                {/* Progress bar comparison */}
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5 relative">
                  {/* Claimed baseline marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 z-10"
                    style={{ left: `${Math.min(100, Math.max(0, (bin.midpoint - 40) * 1.6))}%` }}
                    title={`Claimed target: ${bin.midpoint}%`}
                  />
                  {/* Realized bar */}
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      bin.realizedHitRate >= bin.midpoint ? "bg-emerald-400" : "bg-amber-400",
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, (bin.realizedHitRate - 40) * 1.6))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-[9px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                <span>PAVA Calib:</span>
                <span className="font-mono font-medium text-slate-300">
                  {bin.empiricalShrinkage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>Realized win-rate matches claimed expectations within ±4.0% tolerance</span>
        </div>
        <span className="text-slate-500 font-mono">
          Theoretical Brier 0.00 = perfect calibration
        </span>
      </div>
    </div>
  );
}
