// Precision Parity AI — Sentinel Canonical Signal Banner & Opportunity Presentation.
// Presents the harmonized Even/Odd opportunity matching Sentinel's layout and exact entry digit format:
// "Market 10 (1s), contract type ODD, entry: wait for digit 3 to appear then run ODD."

import { useState } from "react";
import {
  Sparkles,
  Zap,
  Target,
  Copy,
  Check,
  Layers,
  ShieldCheck,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParitySignal, MarketParityReport } from "@/lib/precision-parity/types";
import { computeSpecificParityEntryDigit } from "@/lib/precision-parity/engines/specific-entry-digit";

interface Props {
  report: MarketParityReport;
  signal?: ParitySignal | null;
  digits: number[];
  onLockMarket?: () => void;
}

function MetricRow({
  label,
  value,
  highlightColor,
}: {
  label: string;
  value: string | number;
  highlightColor?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-sm font-bold tracking-tight",
          highlightColor ? "" : "text-foreground",
        )}
        style={highlightColor ? { color: highlightColor } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

export function ParitySentinelOpportunityCard({ report, signal, digits }: Props) {
  const [copied, setCopied] = useState(false);

  // Target contract determination
  const isEven = signal?.contract === "DIGITEVEN" || report.verdict.recommendation === "BUY_EVEN";
  const targetContract = isEven ? "DIGITEVEN" : "DIGITODD";
  const contractLabel = isEven ? "DIGIT EVEN" : "DIGIT ODD";

  // Compute specific entry digit using Sentinel's causal matrix method
  const entryDecision =
    signal?.specificEntryDigit ??
    computeSpecificParityEntryDigit(digits, targetContract, report.market, report.name);

  const preferredDigit = entryDecision.entryDigit;
  const preferredScore = entryDecision.preferred;
  const lastDigit = digits.length > 0 ? digits[digits.length - 1] : 0;
  const isDigitShowingNow = lastDigit === preferredDigit;

  // Single canonical formula user requested:
  // "Market 10 1s, contract type ODD, entry: wait for digit 3 to appear then run ODD."
  const canonicalDirective = `${report.name}, Contract: ${contractLabel}, Entry: Wait for digit ${preferredDigit} to appear then run ${contractLabel}.`;

  const copyPayload = () => {
    navigator.clipboard.writeText(canonicalDirective);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confidenceScore = report.verdict.confidence ?? 75;

  return (
    <section
      id="sentinel-parity-canonical-card"
      className="rounded-2xl border border-border/70 glass overflow-hidden shadow-2xl relative transition-all duration-300"
    >
      {/* ── 1. Sentinel Top Alert Header Bar ── */}
      <div className="bg-gradient-to-r from-secondary/80 via-secondary/40 to-transparent border-b border-border/50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm",
              isEven
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40",
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>BEST PARITY OPPORTUNITY</span>
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            {report.market} · {report.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold border",
              isDigitShowingNow
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30",
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {isDigitShowingNow
                ? "DIGIT IS SHOWING NOW — ENTER"
                : `WAITING FOR DIGIT ${preferredDigit}`}
            </span>
          </div>

          <button
            onClick={copyPayload}
            className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border/60 hover:bg-secondary/60 text-xs font-mono text-muted-foreground hover:text-foreground transition-all"
            title="Copy Exact Execution Command"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy Directive"}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Primary Sentinel Presentation ── */}
      <div className="p-6 space-y-6">
        {/* Main Headline Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Harmonized Sentinel Parity Intelligence
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <span>{report.name}</span>
              <span className="text-muted-foreground text-xl">·</span>
              <span className={isEven ? "text-emerald-400" : "text-indigo-400"}>
                {contractLabel}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Synthesized across 1,000-tick Markov transitions, digit-level arrival frequencies, and
              microstructure stability.
            </p>
          </div>

          {/* Target Digit Hero Ring */}
          <div className="flex items-center gap-4 bg-background/60 p-4 rounded-xl border border-border/60 self-start md:self-auto">
            <div className="text-center space-y-0.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Target Trigger Digit
              </div>
              <div
                className={cn(
                  "font-mono text-3xl font-extrabold tabular-nums",
                  isEven ? "text-emerald-400" : "text-indigo-400",
                )}
              >
                {preferredDigit}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Last Digit: <strong className="text-foreground">{lastDigit}</strong>
              </div>
            </div>

            <div className="h-10 w-px bg-border/60" />

            <div className="text-center space-y-0.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Confidence
              </div>
              <div className="font-mono text-3xl font-extrabold text-foreground tabular-nums">
                {confidenceScore}%
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Duration: <strong>1 Tick</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Exact Sentinel-Style Execution Instruction Box ── */}
        <div
          className={cn(
            "rounded-xl border p-4.5 transition-all shadow-inner space-y-2",
            isEven
              ? "bg-emerald-950/20 border-emerald-500/40"
              : "bg-indigo-950/20 border-indigo-500/40",
          )}
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <Target
                className={cn("w-3.5 h-3.5", isEven ? "text-emerald-400" : "text-indigo-400")}
              />
              Actionable Sentinel Execution Instruction
            </span>
            <span className="text-muted-foreground font-mono">
              Status:{" "}
              <strong
                className={cn(
                  "font-mono font-bold",
                  isDigitShowingNow ? "text-emerald-400" : "text-amber-400",
                )}
              >
                {isDigitShowingNow ? "TRIGGER ACTIVE" : "ARMED"}
              </strong>
            </span>
          </div>

          <div
            className={cn(
              "font-display text-base sm:text-lg font-bold tracking-wide",
              isEven ? "text-emerald-300" : "text-indigo-300",
            )}
          >
            {entryDecision.instructionHeadline}
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed flex items-center gap-2 pt-1 border-t border-white/5">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>
              {isDigitShowingNow
                ? `Digit ${preferredDigit} is currently printed. Run ${contractLabel} for 1 tick immediately.`
                : `Watch the digit stream on ${report.name}. When digit ${preferredDigit} prints, immediately execute ${contractLabel} for 1 tick.`}
            </span>
          </div>
        </div>

        {/* ── 4. Sentinel Structural Evidence Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          <MetricRow label="Market" value={report.name} />
          <MetricRow label="Contract Type" value={contractLabel} />
          <MetricRow
            label="Entry Digit"
            value={`Wait for ${preferredDigit}`}
            highlightColor={isEven ? "var(--bull, #10b981)" : "#818cf8"}
          />
          <MetricRow label="P(Win | Digit)" value={`${(preferredScore.pWin * 100).toFixed(1)}%`} />
          <MetricRow label="Sample Size" value={`N = ${preferredScore.n}`} />
          <MetricRow label="Avg Wait Gap" value={`~${preferredScore.expectedWaitTicks} ticks`} />
        </div>

        {/* ── 5. Digit-by-Digit Entry Transition Matrix ── */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <span>Entry Digit Transition Ranking (0 to 9)</span>
            <span>Target Parity: {contractLabel}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {entryDecision.allScores.map((score) => {
              const isBest = score.digit === preferredDigit;
              const isCurrent = score.digit === lastDigit;

              return (
                <div
                  key={score.digit}
                  className={cn(
                    "p-2.5 rounded-xl border text-center transition-all flex flex-col justify-between space-y-1.5",
                    isBest
                      ? "bg-emerald-500/15 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30"
                      : isCurrent
                        ? "bg-secondary/60 border-amber-500/40"
                        : "bg-secondary/20 border-border/40 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "font-mono text-base font-extrabold",
                        isBest
                          ? "text-emerald-400"
                          : isCurrent
                            ? "text-amber-400"
                            : "text-foreground",
                      )}
                    >
                      {score.digit}
                    </span>
                    {isBest && (
                      <span className="text-[9px] font-mono font-bold bg-emerald-500 text-slate-950 px-1 rounded">
                        TOP
                      </span>
                    )}
                    {!isBest && isCurrent && (
                      <span className="text-[9px] font-mono font-bold bg-amber-500/30 text-amber-300 px-1 rounded">
                        NOW
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] font-mono font-semibold text-foreground">
                      {(score.pWin * 100).toFixed(0)}% win
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground">N={score.n}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 6. 4-Step Analytical Criteria Checklist ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/40">
          <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>1. Market Stream</span>
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-foreground">{report.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              Feed active ({digits.length} ticks)
            </p>
          </div>

          <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>2. Specific Trigger</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xs font-semibold text-foreground">Wait for Digit {preferredDigit}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              P(Win | {preferredDigit}) = {(preferredScore.pWin * 100).toFixed(1)}%
            </p>
          </div>

          <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>3. Target Contract</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xs font-semibold text-foreground">{contractLabel}</p>
            <p className="text-[11px] text-muted-foreground font-mono">Duration: 1 Tick</p>
          </div>

          <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>4. Execution Rule</span>
              <Clock className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-foreground">Immediate 1-Tick Run</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              Enter upon digit {preferredDigit} print
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
