// Live Market Ticker & Real-Time Digit Stream Strip
// Provides real-time market selection, tick price, glowing digit indicator, 20-digit rolling tape, and Even/Odd probability metrics.

import React from "react";
import { PARITY_SYMBOLS } from "@/hooks/usePrecisionParity";
import { Activity, Flame, Zap, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tick } from "@/lib/analytics";

interface Props {
  selectedMarket: string;
  onSelectMarket: (market: string) => void;
  ticks: Tick[];
  digits: number[];
  heldMarket?: string | null;
}

export function LiveMarketTickerStrip({
  selectedMarket,
  onSelectMarket,
  ticks,
  digits,
  heldMarket,
}: Props) {
  const currentSymbol = PARITY_SYMBOLS.find((s) => s.symbol === selectedMarket) || {
    symbol: selectedMarket,
    name: selectedMarket,
    group: "Standard",
  };

  const safeTicks = ticks ?? [];
  const safeDigits = digits ?? [];

  const latestTick = safeTicks.length > 0 ? safeTicks[safeTicks.length - 1] : null;
  const latestDigit = safeDigits.length > 0 ? safeDigits[safeDigits.length - 1] : null;
  const isLatestEven = latestDigit !== null ? latestDigit % 2 === 0 : false;

  // Recent 20 digits for the rolling tape
  const recentDigits = safeDigits.slice(-20);

  // Compute 20-digit and 50-digit even ratio
  const last20 = safeDigits.slice(-20);
  const evenCount20 = last20.filter((d) => d % 2 === 0).length;
  const evenPct20 = last20.length > 0 ? (evenCount20 / last20.length) * 100 : 50;

  // Current Streak Calculation
  let currentStreak = 0;
  let streakType: "EVEN" | "ODD" | null = null;
  if (safeDigits.length > 0) {
    const lastParity = safeDigits[safeDigits.length - 1] % 2 === 0 ? "EVEN" : "ODD";
    streakType = lastParity;
    for (let i = safeDigits.length - 1; i >= 0; i--) {
      const p = safeDigits[i] % 2 === 0 ? "EVEN" : "ODD";
      if (p === lastParity) currentStreak++;
      else break;
    }
  }

  // Quick favorite markets
  const popularMarkets = [
    { symbol: "R_100", label: "Vol 100" },
    { symbol: "1HZ10V", label: "Vol 10 (1s)" },
    { symbol: "1HZ25V", label: "Vol 25 (1s)" },
    { symbol: "1HZ50V", label: "Vol 50 (1s)" },
    { symbol: "1HZ75V", label: "Vol 75 (1s)" },
    { symbol: "1HZ100V", label: "Vol 100 (1s)" },
    { symbol: "R_50", label: "Vol 50" },
    { symbol: "JD10", label: "Jump 10" },
  ];

  return (
    <div
      id="live-market-ticker-strip"
      className="rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-md p-4 space-y-3.5 shadow-xl"
    >
      {/* Top row: Market selector and Quick Switch pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="parity-market-select"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> Active Market:
          </label>
          <select
            id="parity-market-select"
            value={selectedMarket}
            onChange={(e) => onSelectMarket(e.target.value)}
            className="rounded-lg border border-white/15 bg-slate-800/90 px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <optgroup label="Standard Volatility Indices">
              {PARITY_SYMBOLS.filter((s) => s.group === "Standard").map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name} ({s.symbol})
                </option>
              ))}
            </optgroup>
            <optgroup label="1-Second (1s) Volatility Indices">
              {PARITY_SYMBOLS.filter((s) => s.group === "1s").map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name} ({s.symbol})
                </option>
              ))}
            </optgroup>
            <optgroup label="Jump Indices">
              {PARITY_SYMBOLS.filter((s) => s.group === "Jump").map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name} ({s.symbol})
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Quick market chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {popularMarkets.map((pm) => {
            const isSelected = selectedMarket === pm.symbol;
            const isHeld = heldMarket === pm.symbol;
            return (
              <button
                key={pm.symbol}
                onClick={() => onSelectMarket(pm.symbol)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono transition-all",
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-sm"
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/5",
                  isHeld && "ring-1 ring-emerald-400",
                )}
              >
                {pm.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Ticker Display Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
        {/* 1. Live Price & Tick Counter */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
              {currentSymbol.name}
            </div>
            <div className="text-lg font-mono font-bold text-white mt-0.5">
              {latestTick ? latestTick.price.toFixed(4) : "Streaming..."}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {ticks.length} Ticks
            </span>
          </div>
        </div>

        {/* 2. Glowing Last Digit Badge */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
              Latest Digit
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {latestDigit !== null
                ? `${isLatestEven ? "EVEN" : "ODD"} Parity`
                : "Awaiting tick..."}
            </div>
          </div>
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold font-mono shadow-lg transition-transform",
              latestDigit !== null
                ? isLatestEven
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/10 scale-105"
                  : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-indigo-500/10 scale-105"
                : "bg-white/5 text-slate-400 border border-white/10",
            )}
          >
            {latestDigit !== null ? latestDigit : "—"}
          </div>
        </div>

        {/* 3. Rolling Even / Odd Ratio Bar */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-400 font-bold">EVEN: {evenPct20.toFixed(0)}%</span>
            <span className="text-slate-400 text-[10px]">L20 Window</span>
            <span className="text-indigo-400 font-bold">ODD: {(100 - evenPct20).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{ width: `${evenPct20}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${100 - evenPct20}%` }}
            />
          </div>
        </div>

        {/* 4. Active Streak & Run Hazard Warning */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
              Active Run Streak
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 flex items-center gap-1.5">
              {streakType ? (
                <>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      streakType === "EVEN"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-indigo-500/20 text-indigo-400",
                    )}
                  >
                    {streakType} × {currentStreak}
                  </span>
                </>
              ) : (
                "Scanning..."
              )}
            </div>
          </div>
          <div className="text-right">
            <span
              className={cn(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded border",
                currentStreak >= 4
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                  : "bg-white/5 text-slate-400 border-white/10",
              )}
            >
              {currentStreak >= 4 ? "EXHAUSTION ZONE" : "NORMAL FLOW"}
            </span>
          </div>
        </div>
      </div>

      {/* Rolling 20-Digit Tape Sequence */}
      <div className="rounded-xl border border-white/5 bg-black/40 p-2.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] uppercase font-mono text-slate-400 whitespace-nowrap pl-1 pr-2 border-r border-white/10 flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-cyan-400" /> Rolling Tape:
        </span>
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-0.5">
          {recentDigits.length > 0 ? (
            recentDigits.map((d, i) => {
              const isEven = d % 2 === 0;
              const isLast = i === recentDigits.length - 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-all shrink-0",
                    isEven
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
                    isLast && "ring-2 ring-cyan-400 scale-110 shadow-lg shadow-cyan-500/20",
                  )}
                  title={`Tick #${ticks.length - (recentDigits.length - 1 - i)}: Digit ${d} (${isEven ? "EVEN" : "ODD"})`}
                >
                  {d}
                </div>
              );
            })
          ) : (
            <span className="text-xs text-slate-500 italic">Streaming live digit tape...</span>
          )}
        </div>
      </div>
    </div>
  );
}
