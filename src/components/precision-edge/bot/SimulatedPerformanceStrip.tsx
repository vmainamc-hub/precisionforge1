// SIMULATED PERFORMANCE — the bot replayed over each historical window.
import type { SimResult } from "@/lib/precision-edge/bot/simulator";
import { cn } from "@/lib/utils";

export function SimulatedPerformanceStrip({ sims }: { sims: SimResult[] }) {
  if (!sims.length) return null;
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <header>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Simulated Bot Performance
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          The bot's exact rules replayed over each rolling window — not a generic digit edge.
        </p>
      </header>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sims.map((s) => (
          <div
            key={s.window}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Last {s.window.toLocaleString()} ticks
            </div>
            <div
              className={cn(
                "mt-1 font-mono text-xl font-semibold",
                s.winRate >= 0.6
                  ? "text-emerald-400"
                  : s.winRate >= 0.5
                    ? "text-amber-400"
                    : "text-red-400",
              )}
            >
              {(s.winRate * 100).toFixed(1)}%
            </div>
            <dl className="mt-2 space-y-0.5 text-[11px] text-[var(--muted-foreground)]">
              <Row k="Trades" v={String(s.trades)} />
              <Row k="PnL (stakes)" v={s.pnl.toFixed(2)} />
              <Row k="Expectancy" v={s.expectancy.toFixed(3)} />
              <Row k="Max loss streak" v={String(s.longestLossStreak)} />
              <Row k="Peak stake" v={`${s.peakStake.toFixed(2)}×`} />
              <Row k="Max drawdown" v={`${s.maxDrawdownStakes.toFixed(2)}`} />
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{k}</dt>
      <dd className="font-mono text-[var(--foreground)]">{v}</dd>
    </div>
  );
}
