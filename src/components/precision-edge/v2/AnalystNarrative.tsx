// Section 31 — Analyst Narrative for Precision Edge.
// Renders the exact spec-mandated blocks:
//   1. Dominant hypothesis
//   2. Why favoured
//   3. Strongest supporting evidence
//   4. Strongest contradictory evidence
//   5. Estimated persistence of edge
//   6. Principal risks
//   7. DBot suitability
// It also surfaces Section 30 Edge Quality composite in plain language.

import type { MarketReasoning } from "@/lib/precision-edge-v2/types";
import { Brain, ShieldAlert, Timer, Target, TrendingUp, AlertTriangle, Bot } from "lucide-react";

interface Props {
  market: MarketReasoning;
}

function pct(x: number, digits = 0) {
  return `${(x * 100).toFixed(digits)}%`;
}

export function AnalystNarrative({ market }: Props) {
  const v = market.best ?? market.headline;
  if (!v) return null;

  const psy = market.psychology;
  const beh = market.behaviour;

  // 1. Dominant hypothesis
  const dominantHypothesis = `The market is favouring ${v.side} ${v.barrier} on ${market.name}.`;

  // 2. Why favoured — a short paragraph explaining the coherent market story
  const whyFavoured = (() => {
    const bits: string[] = [];
    if (v.hypothesisAlignmentLabel)
      bits.push(`Hypothesis alignment: ${v.hypothesisAlignmentLabel}.`);
    bits.push(
      `Empirical win rate ${pct(v.empWinRate, 1)} against a theoretical ${pct(v.theoretical, 1)}, giving a raw edge of ${(v.edge * 100).toFixed(2)}%.`,
    );
    bits.push(
      `Market health ${psy.health.toFixed(0)}/100 (${psy.healthLabel}); manipulation ${psy.manipulation.toFixed(0)}/100; crowding ${psy.crowding.toFixed(0)}/100.`,
    );
    if (beh.summary) bits.push(beh.summary);
    return bits.join(" ");
  })();

  // 3. Strongest supporting evidence
  const supports = (v.supports && v.supports.length > 0 ? v.supports : (v.reasons ?? [])).slice(
    0,
    6,
  );

  // 4. Strongest contradictory evidence
  const conflicts = (v.conflicts ?? []).slice(0, 6);
  if (v.rejection && conflicts.length === 0) conflicts.push(v.rejection);

  // 5. Estimated persistence — from persistenceTicks and V3.5 forecast if present
  const persistence = v.persistence;
  const persistenceLine = persistence
    ? `Estimated to persist ~${persistence.expectedTicks ?? v.persistenceTicks} more ticks (window used: ${v.persistenceTicks}).`
    : `Winning region has held for ${v.persistenceTicks} ticks.`;

  // 6. Principal risks
  const risks: string[] = [];
  if (psy.manipulation >= 55)
    risks.push(
      `Manipulation elevated (${psy.manipulation.toFixed(0)}/100) — distribution shows anomalies.`,
    );
  if (psy.crowding >= 60)
    risks.push(`Crowding risk (${psy.crowding.toFixed(0)}/100) — single-digit concentration.`);
  if (psy.entropyNorm > 0.85)
    risks.push(`Market entropy high — structure is diffuse, edges decay quickly.`);
  if (v.momentum < -0.02)
    risks.push(`Momentum turning against the hypothesis (${(v.momentum * 100).toFixed(1)}%).`);
  if (v.hypothesisAlignment !== undefined && v.hypothesisAlignment < 0)
    risks.push(`Contract runs against dominant market hypothesis.`);
  if (risks.length === 0) risks.push(`No principal risks flagged; monitor for regime change.`);

  // 7. DBot suitability
  const primed = v.dbotPrimed;
  const dbotLine = primed
    ? primed.primed
      ? `Primed for DBot entry — ${primed.losersInWindow} losers then ${primed.confirmations} confirmation(s) in the last ${primed.windowSize} ticks. ${primed.detail}`
      : `Not yet primed for DBot — ${primed.detail}`
    : `DBot priming unavailable.`;

  // Edge Quality composite (Section 30)
  const quality = v.quality;
  const state = v.state;

  return (
    <div className="rounded-xl border border-[var(--bull)]/25 bg-[var(--bull)]/[0.04] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--bull)]">
          <Brain className="w-4 h-4" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">
            Precision Edge · Analyst Narrative (§31)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
          <span className="rounded border border-border/50 bg-secondary/40 px-2 py-0.5 text-muted-foreground">
            State {state}
          </span>
          {quality && (
            <span className="rounded border border-[var(--bull)]/30 bg-[var(--bull)]/10 px-2 py-0.5 text-[var(--bull)]">
              Quality {quality.tier}
            </span>
          )}
          <span className="rounded border border-border/50 bg-secondary/40 px-2 py-0.5 text-muted-foreground tabular">
            Conf {v.confidence.toFixed(0)}
          </span>
        </div>
      </div>

      <Block icon={<Target className="w-3.5 h-3.5" />} title="1. Dominant hypothesis">
        <p>{dominantHypothesis}</p>
      </Block>

      <Block
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        title="2. Why this hypothesis is favoured"
      >
        <p>{whyFavoured}</p>
      </Block>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Block title="3. Strongest supporting evidence">
          <BulletList items={supports} tone="bull" />
        </Block>
        <Block title="4. Strongest contradictory evidence">
          <BulletList items={conflicts} tone="bear" />
        </Block>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Block icon={<Timer className="w-3.5 h-3.5" />} title="5. Estimated persistence of edge">
          <p>{persistenceLine}</p>
        </Block>
        <Block icon={<ShieldAlert className="w-3.5 h-3.5" />} title="6. Principal risks">
          <BulletList items={risks} tone="warn" />
        </Block>
      </div>

      <Block
        icon={<Bot className="w-3.5 h-3.5" />}
        title="7. Suitability for the operator's DBot workflow"
      >
        <p>{dbotLine}</p>
      </Block>

      {v.alternativesRejected && v.alternativesRejected.length > 0 && (
        <Block
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          title="Alternatives considered and rejected"
        >
          <ul className="space-y-1 text-xs text-muted-foreground">
            {v.alternativesRejected.slice(0, 4).map((a, i) => (
              <li key={i}>
                <span className="text-foreground">{a.label}</span> — {a.reason}
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1.5">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-sm text-foreground/90 leading-relaxed">{children}</div>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "bull" | "bear" | "warn" }) {
  if (!items || items.length === 0)
    return <p className="text-xs text-muted-foreground">None flagged.</p>;
  const color =
    tone === "bull" ? "text-[var(--bull)]" : tone === "bear" ? "text-[var(--bear)]" : "text-warn";
  return (
    <ul className="space-y-1 text-xs">
      {items.map((r, i) => (
        <li key={i} className="text-foreground/85">
          <span className={`${color} mr-1.5`}>•</span>
          {r}
        </li>
      ))}
    </ul>
  );
}
