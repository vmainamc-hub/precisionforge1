import type { ScanState } from "@/hooks/usePrecisionEdgeScan";
import { cn } from "@/lib/utils";

function toneClass(v: number) {
  if (v >= 70) return "text-[var(--bull)]";
  if (v >= 55) return "text-warn";
  return "text-[var(--bear)]";
}

function healthLabel(v: number) {
  if (v >= 70) return "Good";
  if (v >= 55) return "Fair";
  return "Weak";
}

function statusFor(r: ScanState["rows"][number], threshold: number, minHealth: number) {
  if (r.recommended && r.ready && r.edgeScore >= threshold && r.marketHealth >= minHealth)
    return { label: "TAKE", cls: "text-[var(--bull)]" };
  if (r.recommended && r.edgeScore >= threshold - 8) return { label: "WATCH", cls: "text-warn" };
  return { label: "HOLD", cls: "text-muted-foreground" };
}

export function RankedTable({
  scan,
  threshold,
  minHealth,
}: {
  scan: ScanState;
  threshold: number;
  minHealth: number;
}) {
  const rows = scan.rows.filter((r) => r.recommended != null).slice(0, 30);
  return (
    <div className="glass rounded-xl border border-border/50">
      <div className="px-4 pt-4 pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Ranked opportunities
        </div>
        <div className="text-lg font-semibold text-foreground">
          {scan.analysedCount} markets analysed
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-y border-border/40">
              <th className="text-left font-medium px-4 py-2.5">Market</th>
              <th className="text-left font-medium px-3 py-2.5">Trade</th>
              <th className="text-left font-medium px-3 py-2.5">Recovery</th>
              <th className="text-right font-medium px-3 py-2.5">Quality</th>
              <th className="text-left font-medium px-3 py-2.5">Health</th>
              <th className="text-left font-medium px-3 py-2.5">State</th>
              <th className="text-left font-medium px-3 py-2.5">Trend</th>
              <th className="text-right font-medium px-3 py-2.5">Conf.</th>
              <th className="text-right font-medium px-3 py-2.5">Age</th>
              <th className="text-right font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted-foreground py-8">
                  Collecting live ticks…
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const rec = r.recommended!;
                const st = statusFor(r, threshold, minHealth);
                const trend =
                  r.trend === "up" ? "Rising" : r.trend === "down" ? "Fading" : "Stable";
                return (
                  <tr key={r.market} className="border-b border-border/25 hover:bg-secondary/25">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-[10px] tabular text-muted-foreground">{r.market}</div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--bull)]">
                      {rec.candidate.label}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.recovery
                        ? `${r.recovery.primary.label} → ${r.recovery.recovery.label}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular font-semibold text-foreground">
                      {rec.quality.toFixed(1)}
                    </td>
                    <td className={cn("px-3 py-2.5 tabular", toneClass(r.marketHealth))}>
                      {r.marketHealth.toFixed(0)}{" "}
                      <span className="text-muted-foreground">{healthLabel(r.marketHealth)}</span>
                    </td>
                    <td className="px-3 py-2.5 capitalize text-warn">{r.state}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5",
                        r.trend === "down" ? "text-[var(--bear)]" : "text-[var(--bull)]",
                      )}
                    >
                      {trend}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-foreground">
                      {r.confidence.toFixed(0)}%
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-muted-foreground">
                      {(r.ageMs / 1000) | 0}s
                    </td>
                    <td className={cn("px-4 py-2.5 text-right font-semibold", st.cls)}>
                      {st.label}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
