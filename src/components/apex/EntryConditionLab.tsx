// APEX SENTINEL — ENTRY CONDITION LAB.
// Shows which way of ENTERING has actually improved contract-resolved
// expectancy for one market/contract. Every row carries its sample size,
// out-of-sample record and evidence state — nothing is ranked on raw win rate.
import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/apex/EvidencePanel";
import {
  entryLab,
  type EntryConditionState,
  type EntryConditionStats,
  type EntryRecommendation,
} from "@/lib/apex/entry-conditions";
import type { RankedOpportunity } from "@/lib/apex/types";

function toneFor(state: EntryConditionState): string {
  switch (state) {
    case "STRONG":
    case "VALIDATED":
      return "var(--bull)";
    case "PROMISING":
      return "var(--neon)";
    case "DEGRADING":
    case "WEAK":
      return "var(--warn)";
    case "INVALIDATED":
      return "var(--bear)";
    default:
      return "var(--muted-foreground)";
  }
}

export function StateTag({ state }: { state: EntryConditionState }) {
  const tone = toneFor(state);
  return (
    <span
      className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
      style={{ color: tone, borderColor: tone }}
    >
      {state}
    </span>
  );
}

/** Compact entry-condition verdict for the Best Opportunity panel. */
export function EntryConditionSummary({ item }: { item: RankedOpportunity }) {
  const entry = item.entry;
  const best = entry?.best ?? null;
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Discovered entry condition
        </span>
        {best ? <StateTag state={best.state} /> : <StateTag state="UNTESTED" />}
      </div>
      {best ? (
        <>
          <p className="mt-2 font-mono text-sm font-semibold text-foreground">{best.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{best.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Expectancy" value={`${(best.expectancy * 100).toFixed(1)}%`} />
            <Metric label="Sample" value={`N=${best.n}`} />
            <Metric
              label="Out-of-sample"
              value={`${(best.oosExpectancy * 100).toFixed(1)}% · ${best.oosN}`}
            />
            <Metric label="Max losing streak" value={`${best.longestLosingStreak}`} />
          </div>
          <p
            className="mt-3 font-mono text-xs"
            style={{ color: entry?.activeNow ? "var(--bull)" : "var(--warn)" }}
          >
            {entry?.activeNow ? "TRIGGER ACTIVE NOW" : "TRIGGER NOT FIRING"} —{" "}
            {entry?.currentTrigger}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Why this entry: chosen on contract-resolved expectancy with sample-size, interval and
            out-of-sample evidence — not on raw win rate.
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {entry?.note ?? "Entry conditions untested."}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function Row({ s }: { s: EntryConditionStats }) {
  return (
    <tr className="border-t border-border/40">
      <td className="py-2 pr-3">
        <div className="text-foreground">{s.label}</div>
        <div className="text-[11px] text-muted-foreground">{s.description}</div>
      </td>
      <td className="py-2 pr-3 font-mono">{s.n}</td>
      <td className="py-2 pr-3 font-mono">{s.n ? `${(s.winRate * 100).toFixed(1)}%` : "—"}</td>
      <td className="py-2 pr-3 font-mono">{s.n ? `${(s.expectancy * 100).toFixed(1)}%` : "—"}</td>
      <td className="py-2 pr-3 font-mono">
        {s.oosN ? `${(s.oosExpectancy * 100).toFixed(1)}% · ${s.oosN}` : "—"}
      </td>
      <td className="py-2 pr-3 font-mono">
        {s.recentWinRate >= 0 ? `${(s.recentWinRate * 100).toFixed(0)}%` : "—"}
      </td>
      <td className="py-2 pr-3 font-mono">{s.maxDrawdown.toFixed(1)}</td>
      <td className="py-2 pr-3 font-mono">{s.longestLosingStreak}</td>
      <td className="py-2 pr-3 font-mono">{s.score.toFixed(1)}</td>
      <td className="py-2">
        <StateTag state={s.state} />
      </td>
    </tr>
  );
}

/**
 * Full lab for the currently ranked candidate. Re-reads the lab on a timer:
 * discovery runs continuously in the core, independent of this component.
 */
export function EntryConditionLab({ item }: { item: RankedOpportunity | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1500);
    return () => clearInterval(t);
  }, []);

  if (!item) {
    return (
      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint="no ranked candidate">Entry condition lab</SectionTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          No market currently qualifies for ranking, so there is no candidate contract to inspect.
        </p>
      </div>
    );
  }

  const rec: EntryRecommendation = entryLab.recommend(
    item.symbol,
    item.contract.id,
    item.contract.theoretical,
  );
  const totals = entryLab.totals();
  const ledger = entryLab.ledgerFor(item.symbol, 12);

  return (
    <div className="space-y-5">
      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle
          hint={`${item.name} · ${item.contract.label} · ${totals.resolved} resolved shadow entries across ${totals.markets} markets`}
        >
          Entry condition lab
        </SectionTitle>
        <p className="mt-2 text-xs text-muted-foreground">
          Each rule runs its own shadow contract simulator for this market only. Entries resolve on
          the actual expiry digit under the real contract rule; a rule that never triggers records
          nothing.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">Entry condition</th>
                <th className="pb-2 pr-3">N</th>
                <th className="pb-2 pr-3">Win rate</th>
                <th className="pb-2 pr-3">Expectancy</th>
                <th className="pb-2 pr-3">Out-of-sample</th>
                <th className="pb-2 pr-3">Recent</th>
                <th className="pb-2 pr-3">Max DD</th>
                <th className="pb-2 pr-3">Loss streak</th>
                <th className="pb-2 pr-3">Score</th>
                <th className="pb-2">State</th>
              </tr>
            </thead>
            <tbody>
              {rec.all.map((s) => (
                <Row key={s.rule} s={s} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{rec.note}</p>
      </div>

      <div className="glass rounded-xl border border-border/50 p-5">
        <SectionTitle hint={`${item.name} only`}>Recent shadow entries</SectionTitle>
        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No entry rule has triggered on this market yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {ledger.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
              >
                <span className="text-foreground/80">
                  {t.contractLabel} · {t.rule} · entry {t.entryDigit} → expiry{" "}
                  {t.expiryDigit ?? "…"}
                </span>
                <span
                  className="font-mono"
                  style={{
                    color:
                      t.result === "WIN"
                        ? "var(--bull)"
                        : t.result === "LOSS"
                          ? "var(--bear)"
                          : "var(--warn)",
                  }}
                >
                  {t.result} · {t.trigger}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
