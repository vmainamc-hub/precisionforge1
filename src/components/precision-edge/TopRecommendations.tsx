import type { ScanState } from "@/hooks/usePrecisionEdgeScan";
import { marketDNA } from "@/lib/precision-edge/narrative";

export function TopRecommendations({ scan }: { scan: ScanState }) {
  const items = scan.qualifying.slice(0, 6);
  return (
    <div className="glass rounded-xl border border-border/50 flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-3 border-b border-border/40">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Top recommendations
        </div>
        <div className="text-lg font-semibold text-foreground">Stabilised qualifying setups</div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {items.length === 0 ? (
          <div className="h-full grid place-items-center text-xs text-muted-foreground py-10">
            Awaiting scan…
          </div>
        ) : (
          items.map((r) => {
            const rec = r.recommended!;
            return (
              <div
                key={r.market}
                className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-foreground truncate">{r.name}</span>
                  <span className="text-[13px] font-semibold tabular text-[var(--bull)]">
                    {rec.quality.toFixed(1)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {rec.candidate.label}
                  {r.recovery && (
                    <>
                      {" "}
                      · {r.recovery.primary.label} → {r.recovery.recovery.label}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                    {marketDNA(r)}
                  </span>
                  <span className="capitalize text-warn">{r.state}</span>
                  <span className="tabular text-muted-foreground ml-auto">
                    H {r.marketHealth.toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
