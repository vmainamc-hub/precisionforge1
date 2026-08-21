import { useMemo } from "react";
import { PE_SYMBOLS, type ScanState } from "@/hooks/usePrecisionEdgeScan";
import { cn } from "@/lib/utils";

function toneFor(v: number) {
  if (v >= 70) return "var(--bull)";
  if (v >= 55) return "var(--warn)";
  return "var(--bear)";
}

export function MarketList({ scan }: { scan: ScanState }) {
  const healthByMarket = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of scan.rows) m[r.market] = r.marketHealth;
    return m;
  }, [scan.rows]);

  return (
    <div className="glass rounded-xl border border-border/50 flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-3 border-b border-border/40">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Markets
        </div>
        <div className="text-lg font-semibold text-foreground">{scan.feedsReady} live feeds</div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0">
        {PE_SYMBOLS.map((s) => {
          const price = scan.tickCounts[s.symbol] ?? 0;
          const last = scan.lastDigits[s.symbol];
          const health = healthByMarket[s.symbol];
          const ready = price >= 1000;
          return (
            <div
              key={s.symbol}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-secondary/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground truncate">{s.name}</div>
                <div className="text-[10px] tabular text-muted-foreground">
                  {price >= 1000 ? "1500t" : `${price}t`} · {s.symbol}
                </div>
              </div>
              <div className="w-14 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(6, Math.min(100, health ?? (ready ? 40 : 8)))}%`,
                    backgroundColor: toneFor(health ?? 40),
                    opacity: ready ? 1 : 0.4,
                  }}
                />
              </div>
              <div
                className={cn(
                  "w-7 h-7 shrink-0 grid place-items-center rounded-full text-[12px] font-semibold tabular border",
                  last === undefined
                    ? "border-border/40 text-muted-foreground"
                    : "border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10",
                )}
              >
                {last === undefined ? "–" : last}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
