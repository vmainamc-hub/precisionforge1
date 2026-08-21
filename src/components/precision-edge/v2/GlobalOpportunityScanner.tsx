// Global Opportunity Scanner UI — separate panel with its own scan button.
// Reuses the shared MarketReasoning output from usePrecisionReasoning; does
// not touch or modify the existing Scan pipeline.
import { useMemo, useState } from "react";
import { Globe, ShieldCheck, ShieldOff, Clock, Target, Activity, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_GLOBAL_OPTIONS,
  globalScan,
  type GlobalScanResult,
} from "@/lib/precision-edge-v2/global-scanner";
import type { MarketReasoning } from "@/lib/precision-edge-v2/types";

interface Props {
  markets: MarketReasoning[];
  readyThreshold?: number;
  /** Hard gates — configured in the Precision Edge settings drawer. */
  minEdgePct?: number;
  minPersistenceTicks?: number;
  maxManipulation?: number;
  onRunScan?: () => void; // trigger a fresh scan cycle
}

export function GlobalOpportunityScanner({
  markets,
  readyThreshold,
  minEdgePct,
  minPersistenceTicks,
  maxManipulation,
  onRunScan,
}: Props) {
  const [result, setResult] = useState<GlobalScanResult | null>(null);
  const [running, setRunning] = useState(false);

  const opts = useMemo(
    () => ({
      ...DEFAULT_GLOBAL_OPTIONS,
      readyThreshold: readyThreshold ?? DEFAULT_GLOBAL_OPTIONS.readyThreshold,
      minEdgePct: minEdgePct ?? DEFAULT_GLOBAL_OPTIONS.minEdgePct,
      minPersistenceTicks: minPersistenceTicks ?? DEFAULT_GLOBAL_OPTIONS.minPersistenceTicks,
      maxManipulation: maxManipulation ?? DEFAULT_GLOBAL_OPTIONS.maxManipulation,
    }),
    [readyThreshold, minEdgePct, minPersistenceTicks, maxManipulation],
  );

  const handleGlobalScan = () => {
    setRunning(true);
    onRunScan?.();
    // Give the reasoning engine a moment to refresh before ranking.
    window.setTimeout(() => {
      setResult(globalScan(markets, opts));
      setRunning(false);
    }, 350);
  };

  const best = result?.best ?? null;
  const scannedTime = result ? new Date(result.scannedAt).toISOString().slice(11, 19) : "—";

  return (
    <section className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/[0.04] p-4 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Precision Edge · Global Scan
            </div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              Cross-Market Opportunity Scanner
            </h2>
          </div>
        </div>
        <button
          onClick={handleGlobalScan}
          disabled={running || markets.length === 0}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50",
            running && "neon-border",
          )}
        >
          <Globe className={cn("w-3.5 h-3.5", running && "animate-spin")} />
          {running ? "Scanning…" : "Global Scan"}
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]">
        <span className="rounded border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
          Hard gate · Edge ≥ {opts.minEdgePct.toFixed(1)}%
        </span>
        <span className="rounded border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
          Hard gate · Manipulation &lt; {opts.maxManipulation}%
        </span>
        <span className="rounded border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
          Hard gate · Persistence ≥ {opts.minPersistenceTicks}t
        </span>
      </div>

      {!result && (
        <p className="text-xs text-muted-foreground">
          Press <span className="font-semibold text-foreground">Global Scan</span> to compare every
          market and surface the single strongest opportunity. Setups must keep BOTH Red bars inside
          the winning zone and clear all three hard gates.
        </p>
      )}

      {result && !best && (
        <div className="rounded-lg border border-warn/30 bg-warn/[0.05] p-4">
          <div className="flex items-center gap-2 text-warn">
            <ShieldOff className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.25em]">
              No qualifying market
            </span>
          </div>
          <p className="mt-2 text-sm text-foreground">
            {result.reason ?? "No high-quality opportunities found. Continue monitoring."}
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
            <Stat label="Scanned" value={String(result.scannedMarkets)} />
            <Stat label="Red-bar fails" value={String(result.rejectedForRedBars)} />
            <Stat label="Not READY" value={String(result.rejectedForReady)} />
            <Stat label="AI vetoed" value={String(result.rejectedByAI)} />
            <Stat label="Edge gate" value={String(result.rejectedForEdge)} />
            <Stat label="Manipulation gate" value={String(result.rejectedForManipulation)} />
            <Stat label="Persistence gate" value={String(result.rejectedForPersistence)} />
          </div>
        </div>
      )}

      {best && (
        <div className="rounded-lg border border-[var(--bull)]/40 bg-[var(--bull)]/[0.06] p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--bull)]">
                Strongest Opportunity
              </div>
              <div className="text-xl font-bold text-foreground">
                {best.name} · <span className="text-[var(--bull)]">{best.verdict.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--bull)]/40 bg-[var(--bull)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--bull)]">
              <ShieldCheck className="w-3.5 h-3.5" /> READY
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <BigStat label="Confidence" value={`${best.aiConfidence.toFixed(1)}%`} accent />
            <BigStat label="Precision" value={`${best.precision.toFixed(1)}%`} />
            <BigStat label="Stability" value={`${best.stability.toFixed(1)}%`} />
            <BigStat label="Momentum" value={best.momentumLabel} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <ZoneBadge label="Winning Zone" value="Confirmed" ok />
            <ZoneBadge
              label="Main Red Bar"
              value={`Inside · d${best.redDigit}`}
              ok={best.redInWinning}
            />
            <ZoneBadge
              label="Second Red Bar"
              value={`Inside · d${best.lightRedDigit}`}
              ok={best.lightRedInWinning}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
            <Stat
              icon={<Clock className="w-3 h-3" />}
              label="Signal Age"
              value={`${best.signalAgeTicks} ticks`}
            />
            <Stat
              icon={<Target className="w-3 h-3" />}
              label="Edge"
              value={`${(best.verdict.edge * 100).toFixed(2)}%`}
            />
            <Stat
              icon={<Activity className="w-3 h-3" />}
              label="Health"
              value={`${best.reasoning.psychology.health.toFixed(0)}`}
            />
            <Stat
              icon={<TrendingUp className="w-3 h-3" />}
              label="Scanned"
              value={`${scannedTime} UTC`}
            />
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              AI Recommendation
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {best.name} · {best.verdict.label} is currently the strongest opportunity across all
              analysed markets. Both Red bars sit inside the winning zone, the setup is mature, and
              the analyst has verified confidence at {best.aiConfidence.toFixed(1)}%.
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              {best.aiNotes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          </div>

          {result && result.topThree.length > 1 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Top 3 comparison
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {result.topThree.map((c, i) => (
                  <div
                    key={`${c.market}:${c.verdict.id}`}
                    className={cn(
                      "rounded-md border p-2 text-[11px]",
                      i === 0
                        ? "border-[var(--bull)]/40 bg-[var(--bull)]/[0.05]"
                        : "border-border/40 bg-secondary/20",
                    )}
                  >
                    <div className="font-semibold text-foreground">
                      #{i + 1} · {c.name}
                    </div>
                    <div className="text-muted-foreground">{c.verdict.label}</div>
                    <div className="mt-1 tabular text-muted-foreground">
                      Conf {c.aiConfidence.toFixed(1)}% · Prec {c.precision.toFixed(0)}% · Stab{" "}
                      {c.stability.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="tabular text-foreground text-xs font-semibold">{value}</div>
    </div>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        accent ? "border-[var(--bull)]/40 bg-[var(--bull)]/10" : "border-border/40 bg-secondary/20",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "tabular text-lg font-bold",
          accent ? "text-[var(--bull)]" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ZoneBadge({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5 flex items-center justify-between gap-2",
        ok ? "border-[var(--bull)]/40 bg-[var(--bull)]/[0.06]" : "border-warn/40 bg-warn/[0.06]",
      )}
    >
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-xs font-semibold", ok ? "text-[var(--bull)]" : "text-warn")}>
          {value}
        </div>
      </div>
      {ok ? (
        <ShieldCheck className="w-4 h-4 text-[var(--bull)]" />
      ) : (
        <ShieldOff className="w-4 h-4 text-warn" />
      )}
    </div>
  );
}
