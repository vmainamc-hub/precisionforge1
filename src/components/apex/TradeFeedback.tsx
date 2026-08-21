// APEX SENTINEL — TRADE INTENT & OUTCOME FEEDBACK.
//
// A signal shown is NOT a trade taken. Nothing here is created automatically:
// the operator must explicitly mark a signal as traded before Sentinel ever
// asks for an outcome. Ignored signals are never asked about.
import { useState, useSyncExternalStore } from "react";
import type { RankedOpportunity } from "@/lib/apex/types";
import { Button } from "@/components/ui/button";
import {
  SignalObservationEditor,
  TradeDebriefComposer,
  TradeFeedbackNoteEditor,
} from "@/components/apex/OperatorFeedback";
import { OperatorLearningInline } from "@/components/apex/OperatorLearningSummary";
import {
  digitLearning,
  feedbackVersion,
  learningFor,
  listTrades,
  markTraded,
  pendingFor,
  resolveTrade,
  subscribeTradeFeedback,
  type TradeRecord,
} from "@/lib/sentinel/trade-feedback";
import {
  guidanceRevision,
  immediateGuidanceLookup,
  subscribeGuidance,
} from "@/lib/sentinel/immediate-guidance";

export function useTradeFeedbackVersion() {
  return useSyncExternalStore(subscribeTradeFeedback, feedbackVersion, () => 0);
}

export function useGuidanceRevision() {
  return useSyncExternalStore(subscribeGuidance, guidanceRevision, () => 0);
}

/**
 * CHANNEL 1 chip — shows that the operator's own note / trade outcome is influencing this
 * market × contract right now, and that the influence expires by itself.
 */
export function GuidanceChip({ item }: { item: RankedOpportunity }) {
  useGuidanceRevision();
  const effect = immediateGuidanceLookup().forCandidate(item.symbol, item.contract.id);
  if (!effect.active) return null;
  const soonest = Math.min(...effect.directives.map((d) => d.expiresAt));
  const mins = Math.max(1, Math.round((soonest - Date.now()) / 60000));
  const isPositive = effect.points > 0;
  const isNegative = effect.points < 0;

  return (
    <div
      title={effect.detail}
      className="inline-flex flex-wrap items-center gap-2 rounded-full border px-2.5 py-1 transition-all"
      style={{
        borderColor: isPositive ? "var(--bull)" : isNegative ? "var(--warn)" : "var(--border)",
        backgroundColor: "rgba(var(--card-rgb, 24, 24, 27), 0.7)",
      }}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold"
        style={{ color: isPositive ? "var(--bull)" : "var(--warn)" }}
      >
        ● Guidance active
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {effect.directives.length} directive{effect.directives.length > 1 ? "s" : ""} ·{" "}
        {effect.points >= 0 ? "+" : ""}
        {effect.points.toFixed(1)} pts · expires in {mins}m
      </span>
    </div>
  );
}

/** Banner showing actionable steering advice generated from operator reports. */
export function ActiveGuidanceBanner({ item }: { item: RankedOpportunity }) {
  useGuidanceRevision();
  const effect = immediateGuidanceLookup().forCandidate(item.symbol, item.contract.id);
  if (!effect.active) return null;

  return (
    <div className="rounded-lg border border-[var(--warn)]/60 bg-[var(--warn)]/5 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--warn)] font-semibold flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--warn)] animate-ping" />
          Feedback Guidance Steering This Signal
        </span>
        <span className="font-mono text-[10px] font-bold text-foreground">
          Ranking: {effect.points > 0 ? "+" : ""}
          {effect.points.toFixed(1)} pts
        </span>
      </div>

      <div className="space-y-1">
        {effect.adviceList.map((advice, idx) => (
          <p key={idx} className="text-xs text-foreground/90 leading-relaxed font-medium">
            • {advice}
          </p>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground pt-0.5">
        From your recent trade outcomes and debrief reports. This temporarily guides ranking and
        entry point selection.
      </p>
    </div>
  );
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function PendingCard({
  trade,
  onResolved,
}: {
  trade: TradeRecord;
  onResolved?: (tradeId: string) => void;
}) {
  const s = trade.snapshot;
  const [resolvingOutcome, setResolvingOutcome] = useState<"WIN" | "LOSS" | null>(null);

  const handleResolve = (outcome: "WIN" | "LOSS" | "CANCELLED") => {
    resolveTrade(trade.id, outcome);
    if (outcome === "WIN" || outcome === "LOSS") {
      setResolvingOutcome(outcome);
      if (onResolved) onResolved(trade.id);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--warn)]/60 bg-background/60 p-3 space-y-2.5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--warn)] font-semibold">
          Trade recorded · Step 1: select outcome
        </p>
        <p className="mt-1 font-mono text-xs font-medium text-foreground">
          {s.symbol} · {s.contractLabel} · entry digit {s.entryDigit ?? "WAIT"} · recorded at{" "}
          {fmtTime(trade.ts)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-8 px-4 text-xs font-bold bg-[var(--bull)] hover:bg-[var(--bull)]/90 text-white"
          onClick={() => handleResolve("WIN")}
        >
          WIN
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 px-4 text-xs font-bold"
          onClick={() => handleResolve("LOSS")}
        >
          LOSS
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => handleResolve("CANCELLED")}
        >
          Skipped / Cancelled
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Selecting WIN or LOSS immediately guides upcoming signals. Next, you can write a short trade
        report for deep steering.
      </p>
    </div>
  );
}

/** LEARNED SUPPORT — confirmed user-trade history only. Never fabricated. */
export function LearnedSupport({ item }: { item: RankedOpportunity }) {
  useTradeFeedbackVersion();
  const l = learningFor(item.symbol, item.contract.id);
  const d = item.entryPoint.preferred?.digit ?? null;
  const dl = digitLearning(item.symbol, item.contract.id, d);

  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Learned support · confirmed user trades
      </p>
      {l.trades === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          No sufficient user-trade history yet. The entry recommendation rests entirely on current
          market evidence.
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-[11px]">
          <li>
            {item.symbol} · {item.contract.label}: {l.trades} confirmed trades ·{" "}
            {(l.winRate * 100).toFixed(1)}% win rate
          </li>
          <li>
            {dl
              ? `Entry digit ${dl.digit}: ${dl.trades} trades · ${(dl.winRate * 100).toFixed(1)}% (${dl.tier})`
              : d !== null
                ? `Entry digit ${d} has no confirmed user-trade history in this market/contract yet.`
                : "No validated entry digit to compare against learned history."}
          </li>
          <li className="text-muted-foreground">
            Learning confidence: {l.tier} · market and contract isolated
          </li>
        </ul>
      )}
      {l.tier === "INSUFFICIENT SAMPLE" ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Feedback is remembered; there is not yet enough related evidence for strong statistical
          inference.
        </p>
      ) : null}
    </div>
  );
}

export default function TradeFeedback({ item }: { item: RankedOpportunity }) {
  useTradeFeedbackVersion();
  useGuidanceRevision();
  const [activeDebriefId, setActiveDebriefId] = useState<string | null>(null);

  const pending = pendingFor(item);
  const trades = listTrades().filter(
    (t) =>
      t.snapshot.symbol === item.symbol &&
      t.snapshot.contract === item.contract.id &&
      t.outcome !== "PENDING",
  );
  const resolved = trades[0] ?? null;

  return (
    <div className="mt-3 space-y-2.5">
      <GuidanceChip item={item} />
      <ActiveGuidanceBanner item={item} />

      {pending ? (
        <PendingCard trade={pending} onResolved={(id) => setActiveDebriefId(id)} />
      ) : activeDebriefId && resolved && resolved.id === activeDebriefId ? (
        <TradeDebriefComposer trade={resolved} onFinish={() => setActiveDebriefId(null)} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              className="h-8 text-[11px] font-semibold"
              onClick={() => markTraded(item)}
            >
              Mark as traded
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Sentinel only learns from trades you confirm. Ignoring this signal records nothing.
            </p>
          </div>
          {resolved ? (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                Last confirmed trade · {resolved.outcome}
              </p>
              <TradeFeedbackNoteEditor tradeId={resolved.id} />
            </div>
          ) : null}
          <SignalObservationEditor item={item} />
        </>
      )}
      <LearnedSupport item={item} />
      <OperatorLearningInline />
    </div>
  );
}
