// APEX SENTINEL — simulator surface.
// Everything shown here comes from locked paper positions resolved on their
// actual expiry digit. Sample sizes are always visible; nothing is smoothed
// into looking better than it is.
import { SectionTitle } from "@/components/apex/EvidencePanel";
import { Button } from "@/components/ui/button";
import { useApexSimulator } from "@/hooks/useApexSimulator";
import type { SimBucket, SimPerformance, SimTrade } from "@/lib/apex/simulator";

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className="mt-1 font-mono text-lg font-semibold"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

export function SampleTag({ perf }: { perf: SimPerformance }) {
  const tone =
    perf.tier === "HIGH" || perf.tier === "MATURE"
      ? "var(--bull)"
      : perf.tier === "USABLE"
        ? "var(--neon)"
        : "var(--warn)";
  return (
    <span
      className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
      style={{ color: tone, borderColor: tone }}
    >
      {perf.tier === "NONE" ? "NO SAMPLE" : `${perf.tier} · N=${perf.n} · ${perf.health}`}
    </span>
  );
}

function Buckets({ title, rows }: { title: string; rows: SimBucket[] }) {
  return (
    <div className="rounded-lg border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No resolved sample yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.slice(0, 5).map((b) => (
            <li key={b.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-foreground/80">{b.key}</span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {(b.winRate * 100).toFixed(0)}% · N={b.n}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultTag({ t }: { t: SimTrade }) {
  const tone =
    t.result === "WIN" ? "var(--bull)" : t.result === "LOSS" ? "var(--bear)" : "var(--warn)";
  return (
    <span className="font-mono text-[11px] font-semibold" style={{ color: tone }}>
      {t.result}
    </span>
  );
}

export function SimulatorPanel() {
  const sim = useApexSimulator(60);
  const o = sim.overall;

  return (
    <div className="space-y-5">
      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint="paper trading only — no live execution">
          Contract-resolution simulator
        </SectionTitle>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          Positions open only on evidence available at entry, are locked, and resolve on the actual
          expiry digit under the real contract rule ({" "}
          <span className="font-mono">Under 7 → 0-6 WIN / 7-9 LOSS</span>,{" "}
          <span className="font-mono">Over 2 → 3-9 WIN / 0-2 LOSS</span>). Intermediate ticks are
          never counted as outcomes. Duration {sim.config.durationTicks} tick(s), cooldown{" "}
          {sim.config.cooldownTicks} ticks, one open position per market.
        </p>

        <div className="mb-4 flex items-center gap-3">
          <SampleTag perf={o} />
          <span className="text-[11px] text-muted-foreground">
            {sim.open.length} position(s) currently locked and awaiting expiry
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={sim.reset}>
            Reset paper record
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Cell label="Resolved trades" value={`${o.n}`} />
          <Cell
            label="Contract win rate"
            value={o.n ? `${(o.winRate * 100).toFixed(1)}%` : "—"}
            tone={o.n ? (o.winRate >= o.theoretical ? "var(--bull)" : "var(--bear)") : undefined}
          />
          <Cell label="Wilson lower bound" value={o.n ? `${(o.lower * 100).toFixed(1)}%` : "—"} />
          <Cell
            label="Expectancy / stake"
            value={o.n ? o.expectancy.toFixed(3) : "—"}
            tone={o.expectancy >= 0 ? "var(--bull)" : "var(--bear)"}
          />
          <Cell label="Net P/L" value={o.n ? o.netPnl.toFixed(2) : "—"} />
          <Cell label="Max drawdown" value={o.n ? o.maxDrawdown.toFixed(2) : "—"} />
          <Cell label="Longest losing streak" value={o.n ? `${o.longestLosingStreak}` : "—"} />
          <Cell
            label="Current streak"
            value={o.currentStreak ? `${o.currentStreak > 0 ? "+" : ""}${o.currentStreak}` : "—"}
          />
        </div>
      </div>

      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint="segmented by the entry state">Performance segmentation</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <Buckets title="By regime" rows={sim.breakdown.regime} />
          <Buckets title="By opportunity score" rows={sim.breakdown.scoreBand} />
          <Buckets title="By sensitive-digit state" rows={sim.breakdown.threat} />
          <Buckets title="By freshness" rows={sim.breakdown.freshness} />
          <Buckets title="By stability" rows={sim.breakdown.stability} />
          <Buckets title="By engine agreement" rows={sim.breakdown.agreement} />
        </div>
      </div>

      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint="actual entry → expiry outcomes">Market / contract record</SectionTitle>
        {sim.byMarket.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No contract has resolved yet. The record stays empty rather than showing invented
            performance.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="py-2">Market</th>
                  <th>Contract</th>
                  <th className="text-right">N</th>
                  <th className="text-right">Win rate</th>
                  <th className="text-right">vs baseline</th>
                  <th className="text-right">Expectancy</th>
                  <th className="text-right">Max DD</th>
                  <th className="text-right">Worst streak</th>
                </tr>
              </thead>
              <tbody>
                {sim.byMarket.map((r) => (
                  <tr key={`${r.symbol}-${r.contract}`} className="border-t border-border/40">
                    <td className="py-2 font-mono">{r.symbol}</td>
                    <td>{r.contract}</td>
                    <td className="text-right font-mono">{r.perf.n}</td>
                    <td className="text-right font-mono">{(r.perf.winRate * 100).toFixed(1)}%</td>
                    <td
                      className="text-right font-mono"
                      style={{ color: r.perf.edgePp >= 0 ? "var(--bull)" : "var(--bear)" }}
                    >
                      {r.perf.edgePp >= 0 ? "+" : ""}
                      {r.perf.edgePp.toFixed(1)}pp
                    </td>
                    <td className="text-right font-mono">{r.perf.expectancy.toFixed(3)}</td>
                    <td className="text-right font-mono">{r.perf.maxDrawdown.toFixed(2)}</td>
                    <td className="text-right font-mono">{r.perf.longestLosingStreak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint="entry digit vs expiry digit">Live simulated trade ledger</SectionTitle>
        {sim.ledger.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No simulated entries yet — the simulator only opens when a candidate clears its entry
            gates.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-background/90 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                <tr>
                  <th className="py-2">Time</th>
                  <th>Market</th>
                  <th>Contract</th>
                  <th className="text-right">Entry digit</th>
                  <th className="text-right">Expiry digit</th>
                  <th className="text-right">Result</th>
                  <th className="text-right">P/L</th>
                  <th>Entry state</th>
                </tr>
              </thead>
              <tbody>
                {sim.ledger.map((t) => (
                  <tr key={t.id} className="border-t border-border/40">
                    <td className="py-2 font-mono text-muted-foreground">
                      {new Date(t.openedAt).toLocaleTimeString()}
                    </td>
                    <td className="font-mono">{t.symbol}</td>
                    <td>{t.contractLabel}</td>
                    <td className="text-right font-mono">{t.entryDigit}</td>
                    <td className="text-right font-mono">
                      {t.expiryDigit === null ? "—" : t.expiryDigit}
                    </td>
                    <td className="text-right">
                      <ResultTag t={t} />
                    </td>
                    <td
                      className="text-right font-mono"
                      style={{
                        color: t.pnl > 0 ? "var(--bull)" : t.pnl < 0 ? "var(--bear)" : undefined,
                      }}
                    >
                      {t.result === "OPEN" ? "—" : t.pnl.toFixed(2)}
                    </td>
                    <td className="max-w-[240px] truncate text-muted-foreground">
                      opp {t.state.opportunity} · {t.state.regime} · threat {t.state.threatState} ·{" "}
                      {t.state.agreement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
