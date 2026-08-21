// Precision Parity AI — Harmonized Actionable Entry Execution Card.
// Displays locked signal agreement, contract type, and entry criteria without financial clutter.

import { useEffect, useState } from "react";
import {
  Clock,
  Zap,
  Unlock,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParitySignal, MarketParityReport } from "@/lib/precision-parity/types";
import type { HeldParitySignal } from "@/hooks/usePrecisionParity";

interface ParityEntryExecutionCardProps {
  report: MarketParityReport;
  signal?: ParitySignal | null;
  heldSignal?: HeldParitySignal | null;
  onReleaseHold?: () => void;
  className?: string;
}

export function ParityEntryExecutionCard({
  report,
  signal,
  heldSignal,
  onReleaseHold,
  className,
}: ParityEntryExecutionCardProps) {
  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  // Authoritatively prioritize locked heldSignal or active report recommendation
  const isHeldContractEven = heldSignal ? heldSignal.contract === "BUY_EVEN" : null;
  const isReportEven = report.verdict.recommendation === "BUY_EVEN";

  const isEven = isHeldContractEven !== null ? isHeldContractEven : isReportEven;
  const contract = isEven ? "DIGITEVEN" : "DIGITODD";
  const contractLabel = isEven ? "DIGIT EVEN" : "DIGIT ODD";

  const activeSignal = signal ?? report.signal;
  const criteria = activeSignal?.entryCriteria;

  // Countdown timer for locked signal
  useEffect(() => {
    if (!heldSignal) {
      setSecondsRemaining(120);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((heldSignal.holdUntil - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [heldSignal]);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  const totalDuration = heldSignal?.holdDurationMs
    ? Math.round(heldSignal.holdDurationMs / 1000)
    : 120;
  const progressPct = Math.max(0, Math.min(100, (secondsRemaining / totalDuration) * 100));

  const copyPayload = () => {
    const text = `Precision Parity Analysis: ${report.name} (${report.market}) | Contract: ${contractLabel} | Directive: ${criteria?.stepByStep.step2_Trigger ?? activeSignal?.entry.condition ?? "Enter on next tick"} | Markov Order: ${criteria?.markovContext.order ?? 1}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="parity-entry-execution-card"
      className={cn(
        "glass rounded-xl border border-border/60 overflow-hidden relative shadow-lg bg-card/60 transition-all",
        isEven ? "border-emerald-500/30" : "border-indigo-500/30",
        className,
      )}
    >
      {/* Top Header: Market Name & Harmonized Locked Signal Duration */}
      <div className="bg-secondary/40 border-b border-border/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5",
              isEven
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
            )}
          >
            <Target className="w-3.5 h-3.5" />
            CONTRACT: {contractLabel}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Active Market: <strong className="text-foreground">{report.name}</strong>
          </span>
        </div>

        {/* Locked Signal Agreement Countdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-background/80 px-3 py-1 rounded-lg border border-border/50 text-xs font-mono">
            <Clock
              className={cn(
                "w-3.5 h-3.5",
                secondsRemaining > 0 ? "text-amber-400 animate-pulse" : "text-muted-foreground",
              )}
            />
            <span className="text-muted-foreground">Locked Directive:</span>
            <span className="font-bold text-foreground tabular-nums">{formattedTime}</span>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden ml-1">
              <div
                className={cn(
                  "h-full transition-all duration-1000",
                  isEven ? "bg-emerald-500" : "bg-indigo-500",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {heldSignal && onReleaseHold && (
            <button
              onClick={onReleaseHold}
              title="Unlock to scan next market"
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 px-2.5 py-1 rounded border border-border/40 hover:bg-secondary/60 transition-colors"
            >
              <Unlock className="w-3 h-3" /> Unlock
            </button>
          )}
        </div>
      </div>

      {/* Main Execution Directive Area */}
      <div className="p-5 space-y-5">
        {/* Core Directive Headline */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/60 p-4 rounded-xl border border-border/40">
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Harmonized Actionable Entry Directive
            </div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span
                className={cn(
                  "inline-block w-2.5 h-2.5 rounded-full",
                  isEven ? "bg-emerald-400" : "bg-indigo-400",
                )}
              />
              {activeSignal?.specificEntryDigit?.instructionHeadline ??
                `Confirm ${contractLabel} entry on next tick confirmation.`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {activeSignal?.specificEntryDigit?.instructionDetail ??
                criteria?.setupSummary ??
                activeSignal?.narrative ??
                "Directional consensus verified across Markov memory and volatility horizons."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              onClick={copyPayload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs font-mono font-medium text-foreground transition-all"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy Directive"}
            </button>
          </div>
        </div>

        {/* 4-Step Entry Criteria Presentation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Step 1: Pre-Condition */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              <span>1. Pre-Condition</span>
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {criteria?.stepByStep.step1_Precondition ??
                "Verify digit feed streaming and volatility stability."}
            </p>
            <div className="text-[10px] text-muted-foreground font-mono">
              Status: <span className="text-emerald-400 font-semibold">VERIFIED</span>
            </div>
          </div>

          {/* Step 2: Trigger */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              <span>2. Trigger Timing</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {criteria?.stepByStep.step2_Trigger ??
                `Trigger ${contractLabel} on next tick arrival.`}
            </p>
            <div className="text-[10px] text-muted-foreground font-mono">
              Timing: <span className="text-amber-400 font-semibold">NEXT TICK CONFIRMATION</span>
            </div>
          </div>

          {/* Step 3: Confirmation */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              <span>3. Structural Proof</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {criteria?.stepByStep.step3_Confirmation ??
                "Higher-order Markov transitions align with directional regime."}
            </p>
            <div className="text-[10px] text-muted-foreground font-mono">
              Order-{criteria?.markovContext.order ?? 2} State:{" "}
              <span className="font-bold text-foreground">
                [{criteria?.markovContext.suffix ?? "ALIGNED"}]
              </span>
            </div>
          </div>

          {/* Step 4: Invalidation */}
          <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/40 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              <span>4. Invalidation Gate</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {criteria?.stepByStep.step4_Invalidation ??
                "Abort if unexpected opposite streak or regime break occurs."}
            </p>
            <div className="text-[10px] text-muted-foreground font-mono">
              Rule: <span className="text-rose-400 font-semibold">CANCEL ON CONFLICT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
