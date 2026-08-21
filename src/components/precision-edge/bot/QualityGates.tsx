// QUALITY GATES — live readout of the four operator settings that act as hard
// vetoes: Edge, Manipulation, Fluctuation and Persistence. Each row shows the
// measured value against the operator's floor/cap so a block is never a
// mystery.
import type { BotSignalConfig } from "@/lib/precision-edge/bot/config";
import type { QualityMetrics } from "@/lib/precision-edge/bot/quality";
import { cn } from "@/lib/utils";
import { Gauge } from "lucide-react";

interface GateRow {
  label: string;
  measured: string;
  limit: string;
  pass: boolean;
}

export function QualityGates({ quality, cfg }: { quality: QualityMetrics; cfg: BotSignalConfig }) {
  const rows: GateRow[] = [
    {
      label: "Edge",
      measured: `${quality.edgePct.toFixed(2)}% / trade`,
      limit: `≥ ${cfg.minEdgePct.toFixed(1)}%`,
      pass: quality.edgePct >= cfg.minEdgePct,
    },
    {
      label: "Manipulation",
      measured: `${quality.manipulation}%`,
      limit: `< ${cfg.maxManipulation}%`,
      pass: quality.manipulation < cfg.maxManipulation,
    },
    {
      label: "Fluctuation",
      measured: `${quality.fluctuation.toFixed(2)} (${quality.fluctuationSpreadPp.toFixed(2)}pp)`,
      limit: `≤ ${cfg.fluctuationTolerance.toFixed(2)}`,
      pass: quality.fluctuation <= cfg.fluctuationTolerance,
    },
    {
      label: "Persistence",
      measured: `${quality.persistence} win run`,
      limit: `≥ ${cfg.minPersistenceTicks}`,
      pass: quality.persistence >= cfg.minPersistenceTicks,
    },
    {
      label: "Balanced edges",
      measured: `${quality.edgeBalance.imbalancePp.toFixed(2)}pp (${quality.edgeBalance.lowPct.toFixed(1)} / ${quality.edgeBalance.highPct.toFixed(1)})`,
      limit: `≤ ${cfg.maxEdgeImbalance.toFixed(1)}pp`,
      pass: quality.edgeBalance.imbalancePp <= cfg.maxEdgeImbalance,
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <header className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-[var(--primary)]" />
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Quality Gates · live vs settings
        </h2>
      </header>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map((r) => (
          <li
            key={r.label}
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs",
              r.pass
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/40 bg-red-500/10 text-red-300",
            )}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-80">{r.label}</div>
            <div className="font-mono text-sm">{r.measured}</div>
            <div className="text-[10px] opacity-70">gate {r.limit}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
