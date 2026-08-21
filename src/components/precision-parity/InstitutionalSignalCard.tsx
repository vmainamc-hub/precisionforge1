// Pure analysis-focused signal card without percentage clutter, trading stake tiers, or money math.
// Presenting only verified Contract Type, Actionable Directive, and Entry Criteria.

import { useState } from "react";
import type { ParitySignal } from "@/lib/precision-parity/types";
import { ShieldAlert, Clock, Sparkles, Target, Copy, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  signal: ParitySignal;
}

export function InstitutionalSignalCard({ signal }: Props) {
  const [copied, setCopied] = useState(false);

  const isTrade = signal.verdict === "TRADE";
  const isWait = signal.verdict === "WAIT";
  const isNoTrade = signal.verdict === "NO_TRADE";

  const isEven = signal.contract === "DIGITEVEN";
  const contractLabel = isEven ? "DIGIT EVEN" : "DIGIT ODD";

  const handleCopy = () => {
    const text = `[PRECISION PARITY ANALYSIS]\nSymbol: ${signal.symbol}\nContract: ${contractLabel}\nState: ${signal.verdict}\nTiming: ${signal.entry.timing}\nDirective: ${signal.entry.condition}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="institutional-parity-signal-card"
      className={cn(
        "rounded-2xl border p-5 sm:p-6 transition-all relative overflow-hidden backdrop-blur-md",
        isTrade
          ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-slate-900/90 shadow-lg shadow-emerald-500/5"
          : isWait
            ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900/90"
            : "border-slate-800 bg-slate-900/60",
      )}
    >
      {/* Top Bar: Analysis State, Symbol, Contract Type */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "px-3.5 py-1.5 rounded-xl font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 shadow-sm font-mono",
              isTrade
                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
                : isWait
                  ? "bg-amber-500 text-slate-950 shadow-amber-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700",
            )}
          >
            {isTrade && <Sparkles className="w-3.5 h-3.5 fill-current" />}
            {isWait && <Clock className="w-3.5 h-3.5" />}
            {isNoTrade && <ShieldAlert className="w-3.5 h-3.5" />}
            <span>
              {isTrade ? "ACTIONABLE DIRECTIVE" : isWait ? "STANDBY / MONITORING" : "STAND ASIDE"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tracking-wide">{signal.symbol}</span>
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded font-mono font-bold tracking-wider",
                isEven
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
              )}
            >
              {contractLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timing condition badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium border",
              signal.entry.timing === "NOW"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                : signal.entry.timing === "NEXT_TICK"
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40",
            )}
          >
            <Zap className="w-3 h-3" />
            <span>Trigger: {signal.entry.timing.replace(/_/g, " ")}</span>
          </div>

          <button
            onClick={handleCopy}
            title="Copy Analysis Payload"
            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Actionable English Timing Condition */}
      <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-white/10 flex items-start gap-2.5">
        <Target
          className={cn("w-4 h-4 shrink-0 mt-0.5", isEven ? "text-emerald-400" : "text-indigo-400")}
        />
        <div className="text-xs text-slate-200 leading-relaxed font-sans">
          <span className="font-semibold text-white">Actionable Directive: </span>
          {signal.entry.condition}
        </div>
      </div>

      {/* Clean Analytical Summary Matrix (No Trading Staking/Formulas) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {/* Recommended Contract Type */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Contract Type
          </div>
          <div
            className={cn(
              "text-sm font-bold font-mono mt-0.5",
              isEven ? "text-emerald-400" : "text-indigo-300",
            )}
          >
            {contractLabel}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Duration: 1 Tick</div>
        </div>

        {/* Directional Thesis */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Consensus Bias
          </div>
          <div className="text-sm font-bold text-white font-mono mt-0.5">
            {isEven ? "EVEN DOMINANT" : "ODD DOMINANT"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Markov Order {signal.entryCriteria?.markovContext.order ?? 1}
          </div>
        </div>

        {/* Quality Gate */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Validation Gate
          </div>
          <div
            className={cn(
              "text-sm font-bold font-mono mt-0.5",
              isTrade ? "text-emerald-400" : isWait ? "text-amber-400" : "text-rose-400",
            )}
          >
            {isTrade ? "CLEARED" : isWait ? "PENDING" : "VETOED"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Multi-Window Aligned</div>
        </div>

        {/* Execution Urgency */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Entry Urgency
          </div>
          <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">
            {signal.entry.timing === "NOW" ? "IMMEDIATE" : "NEXT TICK"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Valid: {signal.entry.expiresInTicks} Ticks
          </div>
        </div>
      </div>

      {/* Analytical Narrative */}
      {signal.narrative && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-xs text-slate-300 leading-relaxed italic">{signal.narrative}</p>
        </div>
      )}
    </div>
  );
}
