// APEX SENTINEL — SIMULATOR COMMAND CENTRE.
// Every valid market is listed with its own continuously running simulator
// state. A market with no current trade stays visible as WAITING — it never
// disappears, and no number is shown that the sample does not justify.
import { useMemo, useState } from "react";
import { SectionTitle } from "@/components/apex/EvidencePanel";
import { SampleTag } from "@/components/apex/SimulatorPanel";
import { Button } from "@/components/ui/button";
import { useApexSimulator } from "@/hooks/useApexSimulator";
import type {
  MarketSimulationState,
  SimPerformance,
  SimStatus,
  SimTrade,
} from "@/lib/apex/simulator";

type Filter =
  "all" | "ready" | "open" | "waiting" | "underperforming" | "validated" | "insufficient";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "ready", label: "Ready" },
  { id: "waiting", label: "Waiting" },
  { id: "validated", label: "Validated" },
  { id: "underperforming", label: "Underperforming" },
  { id: "insufficient", label: "Insufficient sample" },
];

function statusTone(s: SimStatus): string {
  switch (s) {
    case "OPEN":
      return "var(--neon)";
    case "READY":
      return "var(--bull)";
    case "BLOCKED":
      return "var(--bear)";
    case "STALE FEED":
    case "INSUFFICIENT DATA":
      return "var(--muted-foreground)";
    default:
      return "var(--warn)";
  }
}

function StatusTag({ status }: { status: SimStatus }) {
  const tone = statusTone(status);
  return (
    <span
      className="whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
      style={{ color: tone, borderColor: tone }}
    >
      {status}
    </span>
  );
}

function rate(perf: SimPerformance): string {
  if (!perf.n) return "—";
  return `${(perf.winRate * 100).toFixed(1)}%`;
}

function Streak({ perf }: { perf: SimPerformance }) {
  if (!perf.n) return <span className="text-muted-foreground">—</span>;
  const tone = perf.currentStreak >= 0 ? "var(--bull)" : "var(--bear)";
  return (
    <span className="font-mono" style={{ color: tone }}>
      {perf.currentStreak > 0 ? `+${perf.currentStreak}` : perf.currentStreak}
    </span>
  );
}

function ResultDots({ results }: { results: ("WIN" | "LOSS")[] }) {
  if (!results.length) return <span className="text-[10px] text-muted-foreground">no sample</span>;
  return (
    <span className="flex gap-[3px]">
      {results.slice(-12).map((r, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ background: r === "WIN" ? "var(--bull)" : "var(--bear)" }}
          title={r}
        />
      ))}
    </span>
  );
}

function matches(s: MarketSimulationState, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "open":
      return s.status === "OPEN";
    case "ready":
      return s.status === "READY";
    case "waiting":
      return s.status === "WAITING" || s.status === "COOLDOWN" || s.status === "BLOCKED";
    case "validated":
      return s.perf.health === "VALIDATED";
    case "underperforming":
      return s.perf.health === "UNDERPERFORMING";
    case "insufficient":
      return s.perf.health === "NO SAMPLE" || s.perf.health === "INSUFFICIENT SAMPLE";
  }
}

export function SimulatorCommandCenter() {
  const sim = useApexSimulator(20);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => sim.states.filter((s) => matches(s, filter)), [sim.states, filter]);
  const detail = selected ? (sim.states.find((s) => s.symbol === selected) ?? null) : null;
  const liveCount = sim.states.filter(
    (s) => s.status !== "INSUFFICIENT DATA" && s.status !== "STALE FEED",
  ).length;

  return (
    <div className="space-y-5">
      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint="one independent simulator per valid market — always running">
          Simulator command centre
        </SectionTitle>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {sim.states.length} market simulators registered · {liveCount} evaluating live ticks ·{" "}
          {sim.open.length} position(s) locked awaiting expiry. Each simulator observes the same
          shared Deriv tick stream, applies Sentinel's real entry gates, and resolves contracts on
          the actual expiry digit. Markets with no valid setup report WAITING — no trade is
          invented.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "default" : "outline"}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Market</th>
                <th>Simulator</th>
                <th>Candidate</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Last</th>
                <th className="text-right">N</th>
                <th className="text-right">Win rate</th>
                <th className="text-right">vs theo</th>
                <th className="text-right">Expectancy</th>
                <th className="text-right">Net P/L</th>
                <th className="text-right">Max DD</th>
                <th className="text-right">Streak</th>
                <th className="text-right">Worst</th>
                <th>Recent</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.symbol}
                  className="cursor-pointer border-t border-border/40 hover:bg-foreground/5"
                  onClick={() => setSelected(s.symbol === selected ? null : s.symbol)}
                >
                  <td className="py-2">
                    <div className="font-mono text-foreground">{s.symbol}</div>
                    <div className="text-[10px] text-muted-foreground">{s.marketName}</div>
                  </td>
                  <td>
                    <StatusTag status={s.status} />
                  </td>
                  <td className="max-w-[140px] truncate">{s.currentCandidate ?? "—"}</td>
                  <td className="text-right font-mono">
                    {s.status === "OPEN" && s.entryDigit !== null ? s.entryDigit : "—"}
                  </td>
                  <td
                    className="text-right font-mono"
                    style={{
                      color:
                        s.lastResult === "WIN"
                          ? "var(--bull)"
                          : s.lastResult === "LOSS"
                            ? "var(--bear)"
                            : undefined,
                    }}
                  >
                    {s.lastResult ?? "—"}
                  </td>
                  <td className="text-right font-mono">{s.perf.n}</td>
                  <td className="text-right font-mono">{rate(s.perf)}</td>
                  <td
                    className="text-right font-mono"
                    style={{
                      color: !s.perf.n
                        ? undefined
                        : s.perf.edgePp >= 0
                          ? "var(--bull)"
                          : "var(--bear)",
                    }}
                  >
                    {s.perf.n
                      ? `${s.perf.edgePp >= 0 ? "+" : ""}${s.perf.edgePp.toFixed(1)}pp`
                      : "—"}
                  </td>
                  <td className="text-right font-mono">
                    {s.perf.n ? s.perf.expectancy.toFixed(3) : "—"}
                  </td>
                  <td className="text-right font-mono">
                    {s.perf.n ? s.perf.netPnl.toFixed(2) : "—"}
                  </td>
                  <td className="text-right font-mono">
                    {s.perf.n ? s.perf.maxDrawdown.toFixed(2) : "—"}
                  </td>
                  <td className="text-right">
                    <Streak perf={s.perf} />
                  </td>
                  <td className="text-right font-mono">
                    {s.perf.n ? s.perf.longestLosingStreak : "—"}
                  </td>
                  <td>
                    <ResultDots results={s.perf.recentResults} />
                  </td>
                  <td>
                    <SampleTag perf={s.perf} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-4 text-center text-muted-foreground">
                    No market currently matches this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <MarketDetail state={detail} sim={sim} />}
    </div>
  );
}

function MarketDetail({
  state,
  sim,
}: {
  state: MarketSimulationState;
  sim: ReturnType<typeof useApexSimulator>;
}) {
  const ledger = sim.marketLedger(state.symbol, 100);
  const breakdown = sim.breakdownFor(state.symbol);

  return (
    <div className="glass rounded-xl border border-border/50 p-5">
      <SectionTitle hint="contract-resolved record for this market only">
        {state.symbol} · {state.marketName}
      </SectionTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag status={state.status} />
        <SampleTag perf={state.perf} />
        <span className="text-[11px] text-muted-foreground">
          Candidate {state.currentCandidate ?? "none"} · duration {state.durationTicks} tick(s)
          {state.cooldownTicks ? ` · cooldown ${state.cooldownTicks}` : ""}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Entry gate checklist
          </div>
          {state.gates.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {state.blockedBy[0] ?? "Awaiting the next evaluation cycle."}
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {state.gates.map((g) => (
                <li key={g.label} className="flex items-baseline justify-between gap-3 text-xs">
                  <span style={{ color: g.ok ? "var(--bull)" : "var(--bear)" }}>
                    {g.ok ? "PASS" : "FAIL"}
                  </span>
                  <span className="flex-1 truncate text-foreground/80">{g.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {g.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Per-contract record
          </div>
          {state.byContract.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No contract has resolved on this market yet — INSUFFICIENT DATA rather than an
              invented number.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {state.byContract.map((c) => (
                <li key={c.contract} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground/80">{c.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {rate(c.perf)} · N={c.perf.n} · {c.perf.tier} · exp{" "}
                    {c.perf.expectancy.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Buckets title="By regime" rows={breakdown.regime} />
        <Buckets title="By score band" rows={breakdown.scoreBand} />
        <Buckets title="By sensitive-digit state" rows={breakdown.threat} />
        <Buckets title="By engine agreement" rows={breakdown.agreement} />
        <Buckets title="By freshness" rows={breakdown.freshness} />
        <Buckets title="By stability" rows={breakdown.stability} />
      </div>

      <div className="mt-4 rounded-lg border border-border/50 p-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Chronological ledger (entry digit → expiry digit)
        </div>
        {ledger.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No simulated entries on this market yet.
          </p>
        ) : (
          <div className="mt-2 max-h-[320px] overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-background/90 text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                <tr>
                  <th className="py-1">Time</th>
                  <th>Contract</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Expiry</th>
                  <th className="text-right">Result</th>
                  <th className="text-right">P/L</th>
                  <th>Entry state</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((t) => (
                  <tr key={t.id} className="border-t border-border/40">
                    <td className="py-1 font-mono">{new Date(t.openedAt).toLocaleTimeString()}</td>
                    <td>{t.contractLabel}</td>
                    <td className="text-right font-mono">{t.entryDigit}</td>
                    <td className="text-right font-mono">
                      {t.expiryDigit === null ? "—" : t.expiryDigit}
                    </td>
                    <td
                      className="text-right font-mono"
                      style={{
                        color:
                          t.result === "WIN"
                            ? "var(--bull)"
                            : t.result === "LOSS"
                              ? "var(--bear)"
                              : "var(--warn)",
                      }}
                    >
                      {t.result}
                    </td>
                    <td className="text-right font-mono">
                      {t.result === "OPEN" ? "—" : t.pnl.toFixed(2)}
                    </td>
                    <td className="text-muted-foreground">{entryStateLine(t)}</td>
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

function entryStateLine(t: SimTrade): string {
  const s = t.state;
  return [
    `opp ${s.opportunity}`,
    `danger ${s.danger}`,
    `threat ${s.losingThreat} (${s.threatState})`,
    s.sensitiveConflict ? "sensitive conflict" : "no sensitive conflict",
    `bars ${s.barState}`,
    `regime ${s.regime}`,
    `forward ${s.forwardState}`,
    s.agreement,
    `model ${s.modelState}`,
  ].join(" · ");
}

function Buckets({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; n: number; winRate: number }[];
}) {
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
