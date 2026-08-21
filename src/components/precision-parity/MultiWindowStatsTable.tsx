// Precision Parity AI — Multi-Window Wilson Statistics Table.
// Shows Even/Odd frequencies across 20, 50, 120, and 500 tick windows with Wilson 95% intervals and payout hurdle clearance.

import type { ParityStatsEngineResult } from "@/lib/precision-parity/engines/stats-engine";
import { Layers, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  stats: ParityStatsEngineResult;
}

export function MultiWindowStatsTable({ stats }: Props) {
  const windows = Object.values(stats.windows);

  return (
    <div
      id="parity-multi-window-stats-table"
      className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Multi-Window Parity & Wilson Bounds
            </h3>
            <p className="text-[11px] text-slate-400">
              Wilson 95% lower bounds evaluated against Deriv ~51.3% payout breakeven
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Dominant:</span>
          <span
            className={cn(
              "px-2.5 py-0.5 rounded font-bold font-mono",
              stats.dominantSide === "EVEN"
                ? "bg-emerald-500/20 text-emerald-300"
                : stats.dominantSide === "ODD"
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-slate-800 text-slate-400",
            )}
          >
            {stats.dominantSide}
          </span>
        </div>
      </div>

      {/* Responsive Table / Cards */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase font-bold text-slate-400">
              <th className="py-2.5 px-3">Horizon</th>
              <th className="py-2.5 px-3">Sample (N)</th>
              <th className="py-2.5 px-3">Even %</th>
              <th className="py-2.5 px-3">Odd %</th>
              <th className="py-2.5 px-3">Wilson 95% CI (Even)</th>
              <th className="py-2.5 px-3">Shannon Entropy</th>
              <th className="py-2.5 px-3 text-right">Payout Hurdle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {windows.map((w) => {
              const evenLowerPct = w.evenWilson.lower * 100;
              const evenUpperPct = w.evenWilson.upper * 100;
              const isPrimary = w.windowSize === stats.primaryWindow;

              return (
                <tr
                  key={w.windowSize}
                  className={cn(
                    "hover:bg-white/5 transition-colors",
                    isPrimary && "bg-white/[0.03]",
                  )}
                >
                  <td className="py-2.5 px-3 font-semibold text-white">
                    <span className="flex items-center gap-1.5">
                      W-{w.windowSize}
                      {isPrimary && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-sans">
                          PRIMARY
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">N={w.sampleSize}</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">
                    {(w.evenRate * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-indigo-400 font-bold">
                    {(w.oddRate * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    [{evenLowerPct.toFixed(1)}% – {evenUpperPct.toFixed(1)}%]
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        w.entropy < 0.94
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400",
                      )}
                    >
                      {w.entropy.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {w.clearsPayout ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-sans font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> CLEARS (+{w.edgePp.toFixed(1)}pp)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-sans">
                        <XCircle className="w-3 h-3 text-slate-500" /> Below hurdle
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
