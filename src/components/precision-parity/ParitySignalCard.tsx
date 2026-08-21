// Precision Parity AI — Canonical FinalSignal Card Component
// The single reusable signal card across all Parity views and scanners.

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  Target,
  Copy,
  Check,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinalSignal } from "@/lib/precision-parity/final-signal";

interface Props {
  signal: FinalSignal;
  onExecute?: () => void;
  showVotesCollapsible?: boolean;
  className?: string;
  id?: string;
}

export function ParitySignalCard({
  signal,
  onExecute,
  showVotesCollapsible = true,
  className,
  id = "canonical-parity-signal-card",
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const exp = new Date(signal.validity.expiresAt).getTime();
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  });

  useEffect(() => {
    const updateCountdown = () => {
      const exp = new Date(signal.validity.expiresAt).getTime();
      const left = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setSecondsRemaining(left);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [signal.validity.expiresAt]);

  const isBuyEven = signal.action === "BUY_EVEN";
  const isBuyOdd = signal.action === "BUY_ODD";
  const isTrade = isBuyEven || isBuyOdd;
  const isNoTrade = signal.action === "NO_TRADE";

  const handleCopy = () => {
    const text = `[PRECISION PARITY SIGNAL]
Market: ${signal.market.displayName} (${signal.market.symbol})
Action: ${signal.action}
Confidence: ${signal.confidence}% (Edge: +${signal.edgePercentagePoints}%)
Directive: ${signal.entryFormula}
Focus: Digit ${signal.focusDigitOrPattern?.digit ?? "N/A"}
Valid: ${secondsRemaining}s remaining`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={id}
      className={cn(
        "rounded-2xl border transition-all relative overflow-hidden backdrop-blur-md",
        isBuyEven
          ? "border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-secondary/40 to-slate-950/80 shadow-lg shadow-cyan-500/5"
          : isBuyOdd
            ? "border-indigo-500/40 bg-gradient-to-br from-indigo-950/30 via-secondary/40 to-slate-950/80 shadow-lg shadow-indigo-500/5"
            : "border-border/60 bg-secondary/30",
        className,
      )}
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md font-mono",
              isBuyEven
                ? "bg-cyan-500 text-slate-950 shadow-cyan-500/20"
                : isBuyOdd
                  ? "bg-indigo-500 text-white shadow-indigo-500/20"
                  : "bg-secondary text-muted-foreground border border-border/60",
            )}
          >
            {isBuyEven ? "EVN" : isBuyOdd ? "ODD" : "FLT"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-foreground">
                {signal.market.displayName}
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/60 border border-border/40">
                {signal.market.symbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {isTrade ? "Actionable 1-Tick Setup" : "Stand Aside / Filtered"}
            </p>
          </div>
        </div>

        {/* Action & Validity Status Badges */}
        <div className="flex items-center gap-2">
          {isTrade ? (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{signal.action.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-secondary/60 border border-border/60 text-foreground">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span
                  className={
                    secondsRemaining <= 10
                      ? "text-rose-400 font-bold animate-pulse"
                      : "text-cyan-300 font-medium"
                  }
                >
                  {secondsRemaining > 0 ? `${secondsRemaining}s` : "EXPIRED"}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-secondary text-muted-foreground border border-border/60">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>STAND ASIDE</span>
            </div>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            title="Copy Signal Directive"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Core Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-0.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Honest Confidence
            </span>
            <div className="font-mono text-base font-bold text-foreground">
              {signal.confidence}%
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-0.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Stat Edge (vs 51.3%)
            </span>
            <div className="font-mono text-base font-bold text-emerald-400">
              +{signal.edgePercentagePoints}%
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-0.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Focus Trigger Digit
            </span>
            <div className="font-mono text-base font-bold text-cyan-300">
              {signal.focusDigitOrPattern?.digit !== undefined
                ? `Digit ${signal.focusDigitOrPattern.digit}`
                : "Pattern"}
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-0.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              Setup Window
            </span>
            <div className="font-mono text-base font-bold text-indigo-300">
              {signal.validity.minutes} Min ({secondsRemaining}s)
            </div>
          </div>
        </div>

        {/* Primary Entry Formula Callout */}
        <div
          className={cn(
            "rounded-xl p-3.5 border font-mono text-xs leading-relaxed",
            isTrade
              ? isBuyEven
                ? "bg-cyan-950/20 border-cyan-500/30 text-cyan-200"
                : "bg-indigo-950/20 border-indigo-500/30 text-indigo-200"
              : "bg-secondary/40 border-border/60 text-muted-foreground",
          )}
        >
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 shrink-0 mt-0.5 text-foreground/80" />
            <div>
              <span className="font-bold uppercase tracking-wider text-[10px] block text-foreground/70 mb-0.5">
                {isTrade ? "Deterministic Execution Directive" : "Veto & Stand-Aside Rationale"}
              </span>
              <p className="text-foreground/90">{signal.entryFormula}</p>
            </div>
          </div>
        </div>

        {/* Vetoes list if filtered */}
        {isNoTrade && signal.vetoes.length > 0 && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Active System Vetoes ({signal.vetoes.length})</span>
            </div>
            <ul className="space-y-1 text-xs font-mono text-rose-300/80 pl-4 list-disc">
              {signal.vetoes.map((v, i) => (
                <li key={i}>
                  <strong>{v.engine}:</strong> {v.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Top Reasoning List */}
        {signal.reasoning.length > 0 && (
          <div className="space-y-1.5 text-xs font-mono">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Confluence Rationale:
            </span>
            <ul className="space-y-1 pl-4 list-disc text-foreground/80">
              {signal.reasoning.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible Layer-1 Feature Engine Votes */}
        {showVotesCollapsible && signal.engineVotes.length > 0 && (
          <div className="border-t border-border/40 pt-3">
            <button
              onClick={() => setShowVotes((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs font-mono text-muted-foreground hover:text-foreground transition-all py-1"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Specialist Engine Votes ({signal.engineVotes.length} Engines)</span>
              </div>
              {showVotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showVotes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-2">
                {signal.engineVotes.map((vote, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-border/40 bg-secondary/20 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground/90 truncate">
                        {vote.engine}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                          vote.side === "EVEN"
                            ? "bg-cyan-500/20 text-cyan-300"
                            : vote.side === "ODD"
                              ? "bg-indigo-500/20 text-indigo-300"
                              : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {vote.side} ({(vote.strength * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{vote.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
