// APEX SENTINEL — WHAT SENTINEL LEARNED.
//
// Everything shown here comes from CONFIRMED USER TRADES only. Live statistical
// inference is not mixed in, and nothing is claimed when the sample is too small.
import { useMemo, useState } from "react";
import { SectionTitle } from "@/components/apex/EvidencePanel";
import { useGuidanceRevision, useTradeFeedbackVersion } from "@/components/apex/TradeFeedback";
import {
  allLearning,
  feedbackHistory,
  listTrades,
  observationCategoryCounts,
  observationsFor,
  todaysLearning,
  type FeedbackCategory,
  type FeedbackHistoryEntry,
  type MarketLearning,
} from "@/lib/sentinel/trade-feedback";
import { reportablePatterns, type OperatorPattern } from "@/lib/sentinel/operator-learning";
import OperatorLearningSummary from "@/components/apex/OperatorLearningSummary";
import { activeDirectives } from "@/lib/sentinel/immediate-guidance";

const card = "rounded-xl border border-border bg-card p-4";

function tierTone(tier: string) {
  return tier === "MORE INFORMATIVE"
    ? "var(--bull)"
    : tier === "EMERGING"
      ? "var(--warn)"
      : "var(--muted-foreground)";
}

function statusTone(status: OperatorPattern["status"]) {
  return status === "VALIDATED"
    ? "var(--bull)"
    : status === "SUPPORTED"
      ? "var(--warn)"
      : status === "DISCOUNTED"
        ? "var(--bear)"
        : "var(--muted-foreground)";
}

/** Shown only where the evidence actually supports it. */
function OperatorValidated({ patterns }: { patterns: OperatorPattern[] }) {
  if (!patterns.length) return null;
  return (
    <>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Operator-validated learning
      </p>
      <ul className="mt-1 space-y-1.5 text-[11px]">
        {patterns.map((p) => (
          <li key={p.key} className="rounded border border-border/60 p-2">
            <p className="font-mono text-[11px]">
              {p.entryDigit !== null ? `Entry digit ${p.entryDigit}` : "Market-wide"}
              {p.category ? ` · ${p.category}` : ""}
            </p>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: statusTone(p.status) }}
            >
              Status: {p.status} · Confidence: {p.feedbackConfidence}/100
            </p>
            <p className="mt-1 text-muted-foreground">
              Observed: {p.observations} · Related confirmed trades: {p.relatedTrades} ({p.wins}W/
              {p.losses}L) · Outcome relationship: {p.outcomeRelationship}
            </p>
            <p className="text-muted-foreground">
              Current influence: {p.influence}
              {Math.abs(p.entryAdjustment) >= 0.5
                ? ` (${p.entryAdjustment > 0 ? "+" : ""}${p.entryAdjustment} entry confidence)`
                : ""}
            </p>
            <p className="mt-1 text-muted-foreground">{p.reason}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function LearningCard({ l }: { l: MarketLearning }) {
  const observations = observationsFor(l.symbol, l.contract);
  const operator = reportablePatterns().filter(
    (p) => p.symbol === l.symbol && p.contract === l.contract,
  );
  return (
    <div className={card}>
      <SectionTitle hint={`${l.trades} confirmed trades · market-isolated`}>
        {l.contractLabel} · {l.symbol}
      </SectionTitle>
      <p className="font-mono text-xs">
        {l.wins}W / {l.losses}L · {(l.winRate * 100).toFixed(1)}% win rate
      </p>
      {l.digits.length ? (
        <ul className="mt-2 space-y-0.5 text-[11px]">
          {l.digits.map((d) => (
            <li key={d.digit}>
              <span className="font-mono">Entry digit {d.digit}</span>: {d.trades} trades ·{" "}
              {(d.winRate * 100).toFixed(1)}%{" "}
              <span className="text-muted-foreground">
                ({d.tier}
                {d.recent ? ` · recent ${d.recent}` : ""})
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No entry digit was recorded on the confirmed trades for this pair.
        </p>
      )}
      <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        {l.notes.map((n) => (
          <li key={n}>• {n}</li>
        ))}
      </ul>
      <p
        className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: tierTone(l.tier) }}
      >
        Confidence: {l.tier} — {l.trades} confirmed trades
      </p>
      {l.tier === "INSUFFICIENT SAMPLE" ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Evidence is remembered, but the sample is not yet large enough for strong statistical
          inference.
        </p>
      ) : null}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Operator observations · not statistically validated
      </p>
      {observations.length ? (
        <ul className="mt-1 space-y-0.5 text-[11px]">
          {observations.slice(0, 5).map((o) => (
            <li key={o.observationId}>
              • &ldquo;{o.text}&rdquo;
              {o.category ? <span className="text-muted-foreground"> ({o.category})</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          No written observations for this market and contract.
        </p>
      )}
      <OperatorValidated patterns={operator} />
    </div>
  );
}

function FeedbackHistory() {
  const [type, setType] = useState<"ALL" | FeedbackHistoryEntry["type"]>("ALL");
  const [symbol, setSymbol] = useState("ALL");
  const [category, setCategory] = useState<"ALL" | FeedbackCategory>("ALL");
  const all = feedbackHistory();
  const symbols = ["ALL", ...new Set(all.map((e) => e.symbol))];
  const categories = ["ALL", ...new Set(all.map((e) => e.category).filter(Boolean))] as (
    "ALL" | FeedbackCategory
  )[];
  const rows = all.filter(
    (e) =>
      (type === "ALL" || e.type === type) &&
      (symbol === "ALL" || e.symbol === symbol) &&
      (category === "ALL" || e.category === category),
  );
  const counts = observationCategoryCounts();

  const chip = (active: boolean) => ({
    borderColor: active ? "var(--neon)" : "var(--border)",
    color: active ? "var(--neon)" : "var(--muted-foreground)",
  });

  return (
    <div className={card}>
      <SectionTitle hint={`${all.length} written notes`}>Feedback history</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {(["ALL", "TRADE FEEDBACK", "SIGNAL OBSERVATION"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
            style={chip(t === type)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {symbols.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
            style={chip(s === symbol)}
          >
            {s}
          </button>
        ))}
      </div>
      {categories.length > 1 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
              style={chip(c === category)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {counts.length ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Observation counts (not trade outcomes):{" "}
          {counts.map((c) => `${c.category} ${c.count}`).join(" · ")}
        </p>
      ) : null}

      {rows.length ? (
        <ul className="mt-2 space-y-1 text-[11px]">
          {rows.slice(0, 40).map((e) => (
            <li key={`${e.type}-${e.id}`}>
              <span className="font-mono text-muted-foreground">
                {new Date(e.ts).toLocaleString()} · {e.symbol} · {e.contractLabel} · {e.type}
                {e.category ? ` · ${e.category}` : ""}
                {e.outcome && e.outcome !== "PENDING" ? ` · ${e.outcome}` : ""}
              </span>
              <br />
              &ldquo;{e.text}&rdquo;
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No written feedback recorded yet. Feedback is always optional.
        </p>
      )}
    </div>
  );
}

/**
 * THE TWO CHANNELS, SHOWN SEPARATELY.
 * Channel 1 (here) is immediate operator guidance: it acts on the next ranking
 * cycle, is bounded and expires. Channel 2 below is validated statistical
 * learning from confirmed WIN/LOSS outcomes. They are never merged.
 */
function ImmediateGuidancePanel() {
  useGuidanceRevision();
  const live = activeDirectives();
  return (
    <div className={card}>
      <SectionTitle hint="acts on live signals · 30m auto-decay">
        Channel 1: Immediate Operator Guidance & Trade Reports
      </SectionTitle>
      {live.length === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          No operator directive is active. When you confirm trade outcomes (WIN / LOSS) or write
          trade reports & observations, Sentinel instantly injects temporary ranking and entry-digit
          directives that guide subsequent signal production.
        </p>
      ) : (
        <ul className="space-y-2 text-[11px]">
          {live.map((d) => {
            const minsLeft = Math.max(1, Math.round((d.expiresAt - Date.now()) / 60000));
            const isPositive = d.rankingAdjustment > 0 || d.entryDigitAdjustment > 0;
            return (
              <li
                key={d.id}
                className="rounded-lg border border-border/80 bg-background/50 p-3 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {d.symbol} · {d.contractLabel}
                    {(d.targetDigit ?? d.entryDigit) !== null
                      ? ` · Entry Digit ${d.targetDigit ?? d.entryDigit}`
                      : ""}
                    {d.category ? ` · ${d.category}` : ""}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase font-bold tracking-[0.14em]"
                    style={{ color: isPositive ? "var(--bull)" : "var(--warn)" }}
                  >
                    {d.label}
                  </span>
                </div>

                {d.guidanceAdvice && (
                  <p className="text-xs text-foreground font-medium bg-card/60 rounded p-2 border border-border/40">
                    ⚡ Steering Rule: {d.guidanceAdvice}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground pt-1">
                  <span className="font-mono">
                    Ranking: {d.rankingAdjustment > 0 ? "+" : ""}
                    {d.rankingAdjustment.toFixed(1)} pts
                    {d.entryDigitAdjustment !== 0
                      ? ` · Digit: ${d.entryDigitAdjustment > 0 ? "+" : ""}${d.entryDigitAdjustment.toFixed(1)} pts`
                      : ""}
                  </span>
                  <span className="font-mono">
                    Active for ~{minsLeft}m (expires{" "}
                    {new Date(d.expiresAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    )
                  </span>
                </div>

                {d.text && (
                  <p className="text-[11px] text-muted-foreground italic pt-0.5">
                    &ldquo;{d.text}&rdquo;
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Operator intent, not statistical proof. Takes effect immediately on all upcoming candidate
        evaluations. Validated learning from confirmed outcomes is shown separately below.
      </p>
    </div>
  );
}

export default function WhatSentinelLearned() {
  useTradeFeedbackVersion();
  const [symbol, setSymbol] = useState("ALL");
  const learning = allLearning();
  const today = todaysLearning();
  const history = listTrades().filter((t) => t.outcome === "WIN" || t.outcome === "LOSS");
  const symbols = useMemo(() => ["ALL", ...new Set(learning.map((l) => l.symbol))], [learning]);
  const shown = symbol === "ALL" ? learning : learning.filter((l) => l.symbol === symbol);

  return (
    <section className="space-y-4">
      <ImmediateGuidancePanel />
      <div className={card}>
        <SectionTitle hint="confirmed trades only">Today&apos;s learning</SectionTitle>
        <p className="font-mono text-xs">
          Trades confirmed: {today.confirmed} · Wins: {today.wins} · Losses: {today.losses}
          {today.cancelled ? ` · Cancelled: ${today.cancelled}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          New entry-digit observations: {today.newDigitObservations} · market/contract patterns
          updated: {today.pairsUpdated}
        </p>
        <p className="mt-2 text-[11px]">
          {today.headline ?? "No observation is strong enough to report from today's sample."}
        </p>
      </div>

      {learning.length === 0 ? (
        <div className={card}>
          <SectionTitle hint="nothing confirmed yet">Confirmed trade learning</SectionTitle>
          <p className="text-xs text-muted-foreground">
            No reliable pattern yet. Confirmed trades: 0 · Learning status: INSUFFICIENT SAMPLE.
            Mark a signal as traded and report its outcome for Sentinel to start learning from your
            actual trading — displayed signals alone teach it nothing.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Insufficient sample means insufficient statistical evidence — any written feedback you
            have already given is still remembered below.
          </p>
        </div>
      ) : (
        <>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Confirmed trade learning · explicit WIN/LOSS outcomes only
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {symbols.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{
                  borderColor: s === symbol ? "var(--neon)" : "var(--border)",
                  color: s === symbol ? "var(--neon)" : "var(--muted-foreground)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((l) => (
              <LearningCard key={`${l.symbol}-${l.contract}`} l={l} />
            ))}
          </div>
          <div className={card}>
            <SectionTitle hint={`${history.length} resolved`}>Learning history</SectionTitle>
            <ul className="space-y-0.5 font-mono text-[11px]">
              {history.slice(0, 25).map((t) => (
                <li key={t.id}>
                  <span style={{ color: t.outcome === "WIN" ? "var(--bull)" : "var(--bear)" }}>
                    {t.outcome}
                  </span>{" "}
                  {new Date(t.ts).toLocaleString()} · {t.snapshot.symbol} ·{" "}
                  {t.snapshot.contractLabel} · entry {t.snapshot.entryDigit ?? "WAIT"} · score{" "}
                  {t.snapshot.score.toFixed(0)} · danger {t.snapshot.danger.toFixed(0)}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <OperatorLearningSummary />
      <FeedbackHistory />
    </section>
  );
}
