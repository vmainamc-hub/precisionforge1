// ALL-MARKETS READY FEED — every market currently at BOT_ON, plus a watchlist
// of everything else with the specific reason it is not ready yet and how far
// through its canonical tick window it is.
//
// Purely presentational: it renders the authoritative bot pipeline's own
// verdicts and never re-derives a gate.
import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import type { BotSignalRow } from "@/hooks/useBotSignal";
import { cn } from "@/lib/utils";

export function ReadyFeed({
  readyRows,
  rows,
  selected,
  onSelect,
}: {
  readyRows: BotSignalRow[];
  rows: BotSignalRow[];
  selected: string | null;
  onSelect: (symbol: string) => void;
}) {
  const waiting = rows.filter((r) => r.signal.verdict !== "BOT_ON");

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--bull)]" />
            Live ready feed · all markets
          </div>
          <div className="text-[11px] tabular text-muted-foreground">
            {readyRows.length} ready · {rows.length} monitored
          </div>
        </div>

        {readyRows.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No market is at BOT_ON right now. Every market in the watchlist below is being evaluated
            on every tick — the first one to reach equilibrium appears here.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {readyRows.map((r) => (
              <button
                key={r.symbol}
                onClick={() => onSelect(r.symbol)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selected === r.symbol
                    ? "border-[var(--bull)]/60 bg-[var(--bull)]/15"
                    : "border-[var(--bull)]/30 bg-[var(--bull)]/[0.06] hover:bg-[var(--bull)]/10",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{r.name}</span>
                  <span className="rounded border border-[var(--bull)]/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--bull)]">
                    Bot on
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.signal.instructions.contractLabel} · fitness {r.signal.fitness.toFixed(0)} ·
                  confidence {r.signal.confidence.toFixed(0)}%
                </div>
                <div className="mt-1 text-[11px] tabular text-muted-foreground">
                  E {r.signal.equilibrium.error.toFixed(2)}pp · {r.signal.ticks.toLocaleString()}{" "}
                  ticks
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Watchlist · why each market is not ready
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {waiting.map((r) => {
            const rd = r.signal.readiness;
            const pct = Math.round(rd.windowProgress * 100);
            return (
              <button
                key={r.symbol}
                onClick={() => onSelect(r.symbol)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selected === r.symbol
                    ? "border-[var(--primary)]/60 bg-[var(--primary)]/10"
                    : "border-border/50 bg-background/30 hover:bg-secondary/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      r.signal.verdict === "BOT_STANDBY"
                        ? "border-amber-500/40 text-amber-400"
                        : "border-red-500/40 text-red-400",
                    )}
                  >
                    {r.signal.verdict.replace("BOT_", "")}
                  </span>
                </div>

                {/* Tick-count progress towards the canonical window. */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] tabular text-muted-foreground">
                    <span>
                      {r.signal.ticks.toLocaleString()} /{" "}
                      {r.signal.equilibrium.window.toLocaleString()} ticks
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border/50">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct >= 100 ? "bg-[var(--bull)]" : "bg-[var(--primary)]",
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
                  <span className="line-clamp-3">{rd.primaryBlocker ?? "Waiting"}</span>
                </div>
                <div className="mt-1 text-[10px] tabular text-muted-foreground">
                  E {r.signal.equilibrium.error.toFixed(2)}pp
                  {rd.equilibriumGapPp > 0 && ` · ${rd.equilibriumGapPp.toFixed(2)}pp outside band`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
