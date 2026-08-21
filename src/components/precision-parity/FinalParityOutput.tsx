// Section 44 — Final Parity Output.
// Every published Precision Parity signal must include, in the exact
// language of the master spec (V6 §44):
//   • Recommendation (BUY EVEN / BUY ODD / NO TRADE)
//   • Confidence
//   • Market Story
//   • Hidden Process
//   • Forecast (multi-tick horizons, §37)
//   • Supporting Evidence
//   • Contradictory Evidence
//   • Risk
//   • DBot Plan
// Layered on top of Precision Parity's existing engine outputs.

import type { MarketParityReport, ParityContract } from "@/lib/precision-parity/types";
import {
  Brain,
  ShieldAlert,
  Timer,
  Layers,
  GitBranch,
  Bot,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";

interface Props {
  report: MarketParityReport;
}

function pct(x: number, digits = 0) {
  return `${(x * 100).toFixed(digits)}%`;
}

function sideLabel(c: ParityContract | "NO_TRADE"): string {
  if (c === "BUY_EVEN") return "BUY EVEN";
  if (c === "BUY_ODD") return "BUY ODD";
  return "NO TRADE";
}

export function FinalParityOutput({ report }: Props) {
  const v = report.verdict;
  const rec = v.recommendation;
  const forecast = report.forecast;

  // Section 34 — Internal vs External Dominance
  const externalEvenPct = report.windows[100]?.evenPct ?? report.windows[50]?.evenPct ?? 0.5;
  const hiddenRegime = report.hiddenRegime;
  const external = externalEvenPct > 0.5 ? "EVEN" : externalEvenPct < 0.5 ? "ODD" : "BALANCED";
  const internal =
    hiddenRegime === "EVEN_DOMINANCE"
      ? "EVEN"
      : hiddenRegime === "ODD_DOMINANCE"
        ? "ODD"
        : hiddenRegime === "REVERSAL_BUILDING"
          ? "REVERSAL BUILDING"
          : hiddenRegime === "COMPRESSION"
            ? "COMPRESSION"
            : hiddenRegime === "EXPANSION"
              ? "EXPANSION"
              : hiddenRegime === "ALTERNATING"
                ? "ALTERNATING"
                : "BALANCED";

  const dominanceAgree = external === internal;

  // Market Story — a short prose interpretation
  const marketStory = (() => {
    const parts: string[] = [];
    parts.push(
      `${report.name} is in a ${report.regime.toLowerCase()} regime with hidden state ${hiddenRegime.replace("_", " ").toLowerCase()}.`,
    );
    parts.push(
      `External dominance sits with ${external} (${pct(externalEvenPct, 1)} EVEN); internal dominance points to ${internal}.`,
    );
    if (dominanceAgree)
      parts.push(
        `Internal and external dominance agree — the visible market and the hidden process are aligned.`,
      );
    else
      parts.push(
        `Internal and external dominance disagree — the visible market may be preparing to rotate.`,
      );
    parts.push(
      `Manipulation ${report.manipulation.toFixed(0)}/100, fluctuation ${report.fluctuation.toFixed(0)}/100, crowding ${report.crowding.toFixed(0)}/100.`,
    );
    return parts.join(" ");
  })();

  // Hidden Process — describe what is developing beneath the surface (§33, §35)
  const hiddenProcess = (() => {
    const digit = report.digitPsychology;
    const parts: string[] = [];
    parts.push(
      `Rotation speed ${(digit.rotationSpeed * 100).toFixed(0)}/100, clustering ${(digit.clustering * 100).toFixed(0)}/100.`,
    );
    parts.push(
      `Rising digit: ${digit.rising}. Falling digit: ${digit.falling}. Hot: ${digit.hot}. Cold: ${digit.cold}.`,
    );
    parts.push(
      `Zone A (0-4) share ${pct(digit.zoneA, 1)}; Zone B (5-9) share ${pct(digit.zoneB, 1)}.`,
    );
    if (hiddenRegime === "REVERSAL_BUILDING")
      parts.push(`Hidden accumulation is building against current external dominance.`);
    return parts.join(" ");
  })();

  // Multi-tick forecast (§37)
  const horizons = forecast?.ensemble.horizons ?? [];

  // Supporting / contradictory evidence — pick out of the winning hypothesis
  const winning = v.hypotheses.find((h) => h.contract === rec) ?? v.hypotheses[0];
  const opposite = v.hypotheses.find((h) => h.contract !== winning?.contract);
  const supports = (winning?.supports ?? []).slice(0, 6).map((e) => `${e.engine}: ${e.detail}`);
  const conflicts = [
    ...(winning?.conflicts ?? []).slice(0, 3).map((e) => `${e.engine}: ${e.detail}`),
    ...(opposite?.supports ?? []).slice(0, 3).map((e) => `${e.engine} (opposite): ${e.detail}`),
  ];

  // Risk (§44)
  const risks: string[] = [];
  if (report.manipulation >= 55)
    risks.push(`Manipulation elevated (${report.manipulation.toFixed(0)}/100).`);
  if (report.crowding >= 60)
    risks.push(
      `Crowding risk (${report.crowding.toFixed(0)}/100) — recommendation may already be widely visible.`,
    );
  if (report.fluctuation >= 60)
    risks.push(
      `Fluctuation high (${report.fluctuation.toFixed(0)}/100) — structural positions unstable.`,
    );
  if (!dominanceAgree) risks.push(`External and internal dominance disagree — flip risk elevated.`);
  const stream = forecast?.streakProtection;
  if (stream) {
    if (stream.transitionRisk > 0.5)
      risks.push(`Transition risk ${(stream.transitionRisk * 100).toFixed(0)}%.`);
    if (stream.edgeExpiryRisk > 0.5)
      risks.push(`Edge expiry risk ${(stream.edgeExpiryRisk * 100).toFixed(0)}%.`);
    if (stream.latenessRisk > 0.5)
      risks.push(
        `Lateness risk ${(stream.latenessRisk * 100).toFixed(0)}% — the crowd may already be in.`,
      );
  }
  if (risks.length === 0) risks.push(`No principal risks flagged; monitor for regime change.`);

  // DBot plan (§41)
  const plan = v.plan;
  const dbot = v.dbot;
  const survival = forecast?.dbotSurvival;
  const flip = forecast?.ensemble.edgeReverses ?? forecast?.ensemble.edgeWeakens ?? 0;

  return (
    <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.04] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">
            Precision Parity · Final Output (§44)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
          <span className="rounded border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[var(--accent)] font-semibold">
            {sideLabel(rec)}
          </span>
          <span className="rounded border border-border/50 bg-secondary/40 px-2 py-0.5 text-muted-foreground tabular">
            Conf {v.confidence.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DominancePill kind="external" side={external} />
        <DominancePill kind="internal" side={internal} agree={dominanceAgree} />
      </div>

      <Block icon={<Brain className="w-3.5 h-3.5" />} title="Market Story">
        <p>{marketStory}</p>
      </Block>

      <Block icon={<Layers className="w-3.5 h-3.5" />} title="Hidden Process">
        <p>{hiddenProcess}</p>
      </Block>

      {horizons.length > 0 && (
        <Block icon={<Timer className="w-3.5 h-3.5" />} title="Multi-Tick Forecast (§37)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {horizons.map((h) => (
              <div
                key={h.horizon}
                className="rounded border border-border/50 bg-secondary/30 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Next {h.horizon} tick{h.horizon > 1 ? "s" : ""}
                </div>
                <div className="mt-1 flex items-baseline gap-2 tabular">
                  <span className="text-[var(--accent)] font-semibold">{pct(h.pEven, 1)} even</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-foreground">{pct(h.pOdd, 1)} odd</span>
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Block title="Supporting Evidence">
          <BulletList items={supports} tone="bull" />
        </Block>
        <Block title="Contradictory Evidence">
          <BulletList items={conflicts} tone="bear" />
        </Block>
      </div>

      <Block
        icon={<ShieldAlert className="w-3.5 h-3.5" />}
        title="Risk (what could invalidate this)"
      >
        <BulletList items={risks} tone="warn" />
      </Block>

      <Block icon={<Bot className="w-3.5 h-3.5" />} title="DBot Plan (§41)">
        <ul className="space-y-1 text-xs text-foreground/90">
          <li>
            <span className="text-muted-foreground">Recommended entries:</span>{" "}
            {plan?.recommendedRuns ?? dbot?.recommendedRuns ?? "3–5"}
          </li>
          <li>
            <span className="text-muted-foreground">Expected persistence:</span>{" "}
            {plan?.expectedPersistenceTrades ?? "—"} entries
            {v.stability?.expectedDurationSeconds
              ? ` (~${v.stability.expectedDurationSeconds}s)`
              : ""}
          </li>
          <li>
            <span className="text-muted-foreground">Flip probability:</span>{" "}
            {survival
              ? `${((1 - (survival.survival[5] ?? 0)) * 100).toFixed(0)}% within 5 entries`
              : `${(flip * 100).toFixed(0)}%`}
          </li>
          <li>
            <span className="text-muted-foreground">Cooldown:</span>{" "}
            {v.panel?.dbotSurvival.cooldownSeconds ?? plan?.signalExpirySeconds ?? "—"}s
          </li>
          {(dbot?.cancelConditions ?? []).length > 0 && (
            <li>
              <span className="text-muted-foreground">Cancel if:</span>{" "}
              {dbot!.cancelConditions.join("; ")}
            </li>
          )}
          <li>
            <span className="text-muted-foreground">Recovery:</span>{" "}
            {plan?.recoveryCompatibility ?? "—"}
          </li>
        </ul>
      </Block>

      {v.panel?.chief && (
        <Block icon={<GitBranch className="w-3.5 h-3.5" />} title="Chief Analyst Verdict (§42)">
          <p className="text-sm text-foreground/90">{v.panel.chief.reasoning}</p>
          {v.panel.chief.uncertainty && (
            <p className="mt-1 text-xs text-muted-foreground">
              Uncertainty: {v.panel.chief.uncertainty}
            </p>
          )}
        </Block>
      )}
    </div>
  );
}

function DominancePill({
  kind,
  side,
  agree,
}: {
  kind: "external" | "internal";
  side: string;
  agree?: boolean;
}) {
  const Icon = kind === "external" ? Eye : EyeOff;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {kind} dominance
        </div>
        <div className="text-sm font-semibold text-foreground">
          {side}
          {kind === "internal" && agree !== undefined && (
            <span
              className={`ml-2 text-[10px] font-semibold uppercase tracking-wider ${agree ? "text-[var(--bull)]" : "text-warn"}`}
            >
              {agree ? "AGREES" : "DISAGREES"}
            </span>
          )}
        </div>
      </div>
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
