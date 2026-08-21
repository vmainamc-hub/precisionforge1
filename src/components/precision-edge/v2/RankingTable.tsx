import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MarketReasoning } from "@/lib/precision-edge-v2/types";
import { StateBadge } from "./StateBadge";
import { cn } from "@/lib/utils";

function MarketRow({ m }: { m: MarketReasoning }) {
  const [open, setOpen] = useState(false);
  const head = m.best ?? m.headline;
  const reason =
    head.state === "REJECTED" || head.state === "CONFLICT" ? head.rejection : head.reasons[0];

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground truncate">{m.name}</span>
            <span className="text-[10px] tabular text-muted-foreground">
              last {m.stats.lastDigit}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            <span className="text-foreground/90 font-medium">{head.label}</span> · {reason}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-semibold tabular text-foreground">
            {head.confidence.toFixed(0)}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            H {m.psychology.health.toFixed(0)}
          </div>
        </div>
        <StateBadge state={head.state} />
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-border/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {m.verdicts.map((v) => (
            <div
              key={v.id}
              className="rounded-md border border-border/40 bg-background/30 px-2.5 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">{v.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular text-muted-foreground">
                    {v.confidence.toFixed(0)}%
                  </span>
                  <StateBadge state={v.state} />
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 leading-snug">
                {v.state === "REJECTED" || v.state === "CONFLICT" ? v.rejection : v.reasons[0]}
              </div>
              <div className="text-[10px] tabular text-muted-foreground/70 mt-1">
                win {(v.empWinRate * 100).toFixed(1)}% · edge {(v.edge * 100).toFixed(1)} · persist{" "}
                {v.persistenceTicks}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RankingTable({ scan }: { scan: { markets: MarketReasoning[] } }) {
  return (
    <div className="glass rounded-xl border border-border/50">
      <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Ranking table
          </div>
          <div className="text-lg font-semibold text-foreground">
            Every market stays visible — only its state changes
          </div>
        </div>
        <span className="text-xs text-muted-foreground tabular">{scan.markets.length} markets</span>
      </div>
      <div className="p-3 space-y-2">
        {scan.markets.length === 0 ? (
          <div className="grid place-items-center text-xs text-muted-foreground py-10">
            Building reasoning from live ticks…
          </div>
        ) : (
          scan.markets.map((m) => <MarketRow key={m.market} m={m} />)
        )}
      </div>
    </div>
  );
}
