import { Brain, Zap, ShieldCheck, Timer, Gauge, TrendingUp, Cpu } from "lucide-react";
import type { MarketReasoning } from "@/lib/precision-edge-v2/types";
import { StateBadge } from "./StateBadge";

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: number | string;
  tone: "bull" | "warn" | "bear" | "neon";
}) {
  const color =
    tone === "bull"
      ? "var(--bull)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "bear"
          ? "var(--bear)"
          : "var(--primary)";
  return (
    <div className="flex-1 min-w-[86px]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-2xl font-semibold tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

const tone = (v: number): "bull" | "warn" | "bear" =>
  v >= 72 ? "bull" : v >= 58 ? "warn" : "bear";

export function BestTradePanel({ best }: { best: MarketReasoning | null }) {
  if (!best || !best.best) {
    return (
      <div className="rounded-xl border border-warn/40 bg-warn/[0.06] px-6 py-8 text-center space-y-2">
        <Brain className="w-8 h-8 mx-auto text-warn" />
        <p className="text-sm font-semibold uppercase tracking-wider text-warn">No Trade</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Every contract engine is reasoning, but no market currently presents a psychologically
          coherent hypothesis. The correct output is to wait — not to force a signal.
        </p>
      </div>
    );
  }

  const v = best.best;
  const hyp = best.hypotheses?.dominant;
  return (
    <div className="rounded-xl border border-[var(--bull)]/30 bg-[var(--bull)]/[0.06] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--bull)] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Best trade
            {v.quality && v.quality.tier !== "NONE" && (
              <span className="ml-1 rounded-md border border-[var(--bull)]/40 bg-[var(--bull)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--bull)]">
                {v.quality.symbol} {v.quality.label}
              </span>
            )}
          </div>
          <div className="mt-1 text-3xl font-bold text-foreground">
            <span className="text-[var(--bull)]">{v.label.toUpperCase()}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {best.name} · <span className="text-[var(--primary)]">market reasoning</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tabular text-[var(--bull)] neon-text">
            {v.confidence.toFixed(0)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Confidence
          </div>
          <StateBadge state={v.state} className="mt-2" />
        </div>
      </div>

      {hyp && (
        <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/[0.05] px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              Dominant hypothesis
            </div>
            <div className="text-[11px] tabular text-[var(--primary)]">
              {(hyp.strength * 100).toFixed(0)}% strength
            </div>
          </div>
          <div className="text-xs text-foreground/90 font-medium">{hyp.label}</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">{hyp.narrative}</div>
          {best.hypotheses && best.hypotheses.ranked.length > 1 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {best.hypotheses.ranked.slice(1, 4).map((h) => (
                <span
                  key={h.id}
                  className="rounded border border-border/40 bg-secondary/30 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  title={h.narrative}
                >
                  {h.label} · {(h.strength * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-y border-border/40 py-3">
        <Metric
          icon={ShieldCheck}
          label="Health"
          value={best.psychology.health.toFixed(0)}
          tone={tone(best.psychology.health)}
        />
        <Metric
          icon={TrendingUp}
          label="Edge"
          value={`${(v.edge * 100).toFixed(1)}`}
          tone={tone(50 + v.edge * 800)}
        />
        <Metric
          icon={Timer}
          label="Persist."
          value={v.persistenceTicks}
          tone={tone(Math.min(100, v.persistenceTicks * 12))}
        />
        <Metric
          icon={Gauge}
          label="Manip."
          value={`${best.psychology.manipulation.toFixed(0)}%`}
          tone={tone(100 - best.psychology.manipulation)}
        />
      </div>

      <div className="text-xs text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">Psychology · </span>
        {best.behaviour.summary}
      </div>

      <ul className="space-y-1.5">
        {v.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
            <Zap className="w-3 h-3 mt-0.5 shrink-0 text-[var(--bull)]" />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 border-t border-border/40 pt-3">
        {v.gates.map((g) => (
          <div
            key={g.name}
            className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5"
            title={g.detail}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground truncate">{g.name}</span>
              <span className={g.ok ? "text-[var(--bull)]" : "text-[var(--bear)]"}>
                {g.ok ? "✓" : "✕"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {v.supports?.length || v.conflicts?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/40 pt-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--bull)] mb-1.5">
              Supports
            </div>
            <ul className="space-y-1">
              {(v.supports ?? []).map((s, i) => (
                <li key={i} className="text-[11px] text-foreground/90 flex gap-1.5">
                  <span className="text-[var(--bull)]">✓</span>
                  {s}
                </li>
              ))}
              {(v.supports ?? []).length === 0 && (
                <li className="text-[11px] text-muted-foreground">—</li>
              )}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--bear)] mb-1.5">
              Conflicts
            </div>
            <ul className="space-y-1">
              {(v.conflicts ?? []).map((s, i) => (
                <li key={i} className="text-[11px] text-foreground/90 flex gap-1.5">
                  <span className="text-[var(--bear)]">✕</span>
                  {s}
                </li>
              ))}
              {(v.conflicts ?? []).length === 0 && (
                <li className="text-[11px] text-muted-foreground">—</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {v.alternativesRejected && v.alternativesRejected.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Why not the alternatives
          </div>
          <ul className="space-y-1">
            {v.alternativesRejected.map((a) => (
              <li key={a.id} className="text-[11px] text-muted-foreground">
                <span className="text-foreground/80 font-medium">{a.label}</span> — {a.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.edgeParts && v.edgeParts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 border-t border-border/40 pt-3">
          {v.edgeParts.map((p) => (
            <div
              key={p.name}
              className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5"
              title={p.detail}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate">{p.name}</span>
                <span className={p.pass ? "text-[var(--bull)]" : "text-[var(--bear)]"}>
                  {p.pass ? "✓" : "✕"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {v.dbotPrimed && (
        <div
          className={`rounded-lg border px-3 py-2 ${v.dbotPrimed.primed ? "border-[var(--bull)]/40 bg-[var(--bull)]/[0.06]" : "border-warn/40 bg-warn/[0.05]"}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
            <Zap className="w-3 h-3" /> DBot entry priming
          </div>
          <div className="text-xs text-foreground/90 leading-relaxed">{v.dbotPrimed.detail}</div>
          <div className="mt-1 text-[10px] tabular text-muted-foreground">
            Last {v.dbotPrimed.windowSize} ticks · {v.dbotPrimed.losersInWindow} losers ·{" "}
            {v.dbotPrimed.confirmations} confirmation{v.dbotPrimed.confirmations === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {(v.persistence || v.recovery) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/40 pt-3">
          {v.persistence && (
            <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                <Timer className="w-3 h-3" /> DBot execution persistence
              </div>
              <div className="text-xs text-foreground/90 leading-relaxed">
                {v.persistence.narrative}
              </div>
              <div className="mt-1.5 flex gap-3 text-[10px] tabular text-muted-foreground">
                <span>
                  30s:{" "}
                  <span className="text-foreground">
                    {(v.persistence.survival30s * 100).toFixed(0)}%
                  </span>
                </span>
                <span>
                  60s:{" "}
                  <span className="text-foreground">
                    {(v.persistence.survival60s * 100).toFixed(0)}%
                  </span>
                </span>
                <span>
                  90s:{" "}
                  <span className="text-foreground">
                    {(v.persistence.survival90s * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          )}
          {v.recovery && (
            <div
              className={`rounded-lg border px-3 py-2 ${v.recovery.compatible ? "border-[var(--bull)]/30 bg-[var(--bull)]/[0.05]" : "border-warn/30 bg-warn/[0.05]"}`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" /> Recovery compatibility ·{" "}
                {v.recovery.recoveryLabel}
              </div>
              <div className="text-xs text-foreground/90 leading-relaxed">
                {v.recovery.narrative}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
        <span className="text-foreground font-medium">Recommendation · </span>
        <span className="text-[var(--bull)] font-semibold">{v.state}</span> — the most internally
        consistent hypothesis across digit identity, trader flow, recovery and persistence.
      </p>
    </div>
  );
}
