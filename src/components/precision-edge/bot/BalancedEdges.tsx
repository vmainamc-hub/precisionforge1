// BALANCED EDGES MONITOR — Primary Law 2, made visible.
// The 0/1 edge against the 8/9 edge over the canonical window.
import type { EdgeBalanceReading } from "@/lib/precision-edge/bot/edges";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";

const BAND_STYLES: Record<string, string> = {
  PERFECT: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  PRIME: "text-lime-400 border-lime-500/40 bg-lime-500/10",
  ACCEPTABLE: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  SKEWED: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  BROKEN: "text-red-400 border-red-500/40 bg-red-500/10",
};

export function BalancedEdges({
  edges,
  tolerance,
  ticks,
}: {
  edges: EdgeBalanceReading;
  tolerance: number;
  ticks: number;
}) {
  const total = Math.max(0.001, edges.lowPct + edges.highPct);
  const lowShare = (edges.lowPct / total) * 100;
  const pass = edges.imbalancePp <= tolerance;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-[var(--primary)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Balanced Edges</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Digits 0,1 vs 8,9 · {ticks.toLocaleString()} ticks · primary law 2
            </p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-semibold",
            BAND_STYLES[edges.band],
          )}
        >
          {edges.band}
        </span>
      </header>

      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div className="bg-sky-500/80 transition-all" style={{ width: `${lowShare}%` }} />
        <div className="bg-violet-500/80 transition-all" style={{ width: `${100 - lowShare}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-sky-400">Low edge 0,1 · {edges.lowPct.toFixed(2)}%</span>
        <span className="text-[var(--muted-foreground)]">20.00% each</span>
        <span className="text-violet-400">High edge 8,9 · {edges.highPct.toFixed(2)}%</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Imbalance"
          value={`${edges.imbalancePp.toFixed(2)}pp`}
          tone={pass ? "ok" : "bad"}
        />
        <Metric label="Tolerance" value={`± ${tolerance.toFixed(1)}pp`} />
        <Metric label="Edge mass" value={`${edges.totalPct.toFixed(2)}% / 40%`} />
        <Metric label="Balance score" value={`${edges.score}`} />
      </dl>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        {pass
          ? `Edges are level${edges.heavySide === "EVEN" ? "" : ` with a slight ${edges.heavySide === "LOW" ? "0/1" : "8/9"} lean`} — the martingale ladder is being fed a two-sided tape.`
          : `The ${edges.heavySide === "LOW" ? "0/1" : "8/9"} edge is ${edges.imbalancePp.toFixed(2)}pp heavier. One-sided extremes break barrier recovery even when Over 4 / Under 5 looks centred.`}
      </p>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-md border border-[var(--border)] px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-sm text-[var(--foreground)]",
          tone === "ok" && "text-emerald-400",
          tone === "bad" && "text-red-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
