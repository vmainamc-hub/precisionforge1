// Pure analysis-focused entry criteria presentation without trading stake formulas or clutter
import { cn } from "@/lib/utils";
import type { ParityEntryCriteria } from "@/lib/precision-parity/engines/entry-criteria-engine";
import { CheckCircle2, XCircle, AlertCircle, Layers, Zap, ShieldCheck, Target } from "lucide-react";

interface Props {
  criteria?: ParityEntryCriteria | null;
  targetContract: "DIGITEVEN" | "DIGITODD";
  verdict: "TRADE" | "WAIT" | "NO_TRADE";
  symbol: string;
}

export function ParityAnalysisEntryCriteria({ criteria, targetContract, verdict, symbol }: Props) {
  const isEven = targetContract === "DIGITEVEN";
  const contractLabel = isEven ? "DIGIT EVEN" : "DIGIT ODD";

  const validationChecks = [
    {
      name: "Directional Consensus",
      detail: isEven
        ? "Parity distribution favoring Even digit distribution"
        : "Parity distribution favoring Odd digit distribution",
      passed: verdict !== "NO_TRADE",
    },
    {
      name: "Statistical Edge Gate",
      detail: "Confidence lower-bound clears theoretical threshold",
      passed: verdict === "TRADE",
    },
    {
      name: "Markov Context Alignment",
      detail: criteria
        ? `Order-${criteria.markovContext.order} [${criteria.markovContext.suffix}] structural bias`
        : "Transition matrix aligned",
      passed: Boolean(criteria),
    },
    {
      name: "Streak & Hazard Safety",
      detail: "No active critical exhaustion hazard or adverse veto",
      passed: verdict !== "NO_TRADE",
    },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
            Analysis &amp; Criteria Verification
          </div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mt-0.5">
            <Target className={cn("w-4 h-4", isEven ? "text-emerald-400" : "text-indigo-400")} />
            Target Contract:{" "}
            <span className={isEven ? "text-emerald-400" : "text-indigo-400"}>{contractLabel}</span>
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">Market: {symbol}</span>
          <span
            className={cn(
              "px-2.5 py-1 rounded text-xs font-mono font-bold tracking-wide",
              verdict === "TRADE"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : verdict === "WAIT"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
            )}
          >
            {verdict === "TRADE"
              ? "CRITERIA MET"
              : verdict === "WAIT"
                ? "WAITING FOR TRIGGER"
                : "CRITERIA FAILED"}
          </span>
        </div>
      </div>

      {/* Step by step entry conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-background/50 border border-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase">
            <span>1. Pre-Condition</span>
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-foreground font-medium">
            {criteria?.stepByStep.step1_Precondition ??
              `Streaming digit distribution active on ${symbol}.`}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-background/50 border border-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase">
            <span>2. Entry Trigger</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xs text-foreground font-medium">
            {criteria?.stepByStep.step2_Trigger ?? "Enter on confirmed next tick."}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-background/50 border border-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase">
            <span>3. Confirmation</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xs text-foreground font-medium">
            {criteria?.stepByStep.step3_Confirmation ??
              "Hypothesis confirmed by multi-horizon consensus."}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-background/50 border border-border/40 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase">
            <span>4. Invalidation</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-xs text-foreground font-medium">
            {criteria?.stepByStep.step4_Invalidation ??
              "Invalidate if counter-streak or entropy spike occurs."}
          </p>
        </div>
      </div>

      {/* Validation Checklist */}
      <div className="pt-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Validation Criteria Status
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {validationChecks.map((chk, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-lg bg-background/40 border border-border/30 text-xs"
            >
              <div className="flex items-center gap-2">
                {chk.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-semibold text-foreground">{chk.name}</div>
                  <div className="text-[11px] text-muted-foreground">{chk.detail}</div>
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-mono font-bold px-2 py-0.5 rounded",
                  chk.passed
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400",
                )}
              >
                {chk.passed ? "PASS" : "FAIL"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
