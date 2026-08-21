// Precision Parity AI — Shadow Paper-Trading & Backtest Ledger.
// Tracks simulated executions, realized profit units, win-rate, and profit factor without risking capital.

import { useEffect, useState } from "react";
import {
  ParityShadowEngine,
  type PaperTradeRecord,
} from "@/lib/precision-parity/engines/shadow-engine";
import { Bot, Play, TrendingUp, ShieldCheck, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShadowBacktestPanel() {
  const [stats, setStats] = useState(() => ParityShadowEngine.get().getPerformanceStats());
  const [trades, setTrades] = useState<PaperTradeRecord[]>(() =>
    ParityShadowEngine.get().getRecentTrades(15),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const engine = ParityShadowEngine.get();
      setStats(engine.getPerformanceStats());
      setTrades(engine.getRecentTrades(15));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      id="parity-shadow-panel"
      className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Shadow Paper-Trading & Out-of-Sample Ledger
            </h3>
            <p className="text-[11px] text-slate-400">
              Live tick-by-tick paper execution and performance analytics
            </p>
          </div>
        </div>

        {/* Live Performance Quick Stats */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono">
            Win Rate: <span className="font-bold text-emerald-400">{stats.winRate}%</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono">
            Net Units:{" "}
            <span
              className={cn(
                "font-bold",
                stats.netProfit >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {stats.netProfit >= 0 ? "+" : ""}
              {stats.netProfit}u
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono">
            Profit Factor: <span className="font-bold text-white">{stats.profitFactor}</span>
          </div>
        </div>
      </div>

      {/* Recent Paper Trades Table */}
      <div className="mt-4 overflow-x-auto">
        {trades.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase font-bold text-slate-400 font-sans">
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Symbol</th>
                <th className="py-2 px-3">Contract</th>
                <th className="py-2 px-3">Outcome</th>
                <th className="py-2 px-3">Entry → Exit</th>
                <th className="py-2 px-3">Claimed Conf</th>
                <th className="py-2 px-3 text-right">Profit Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.map((t) => {
                const isWin = t.outcome === "WIN";
                return (
                  <tr key={t.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-white font-semibold">{t.symbol}</td>
                    <td className="py-2 px-3 text-slate-300">{t.contract}</td>
                    <td className="py-2 px-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold font-sans",
                          isWin
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300",
                        )}
                      >
                        {t.outcome}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      Digit {t.entryDigit} → {t.exitDigit}
                    </td>
                    <td className="py-2 px-3 text-slate-300">{t.claimedConfidence}%</td>
                    <td
                      className={cn(
                        "py-2 px-3 text-right font-bold",
                        isWin ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {isWin ? `+${t.payout.toFixed(2)}` : "-1.00"}u
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 border border-white/5 rounded-xl bg-slate-950/40">
            Awaiting first paper-trade execution. Shadow engine is listening to real-time tick
            ticks.
          </div>
        )}
      </div>
    </div>
  );
}
