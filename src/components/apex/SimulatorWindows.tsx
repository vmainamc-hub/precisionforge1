import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/apex/EvidencePanel";
import { simulatorWindows, type SimWindowRow } from "@/lib/apex/windows";
import { apexSimulator } from "@/lib/apex/simulator";
import type { ApexContractId } from "@/lib/apex/types";

/**
 * CONTINUOUS SIMULATOR WINDOWS for ONE market + contract.
 * Every figure comes from that market's own contract-resolved ledger.
 */
export function SimulatorWindows({
  symbol,
  name,
  contract,
  contractLabel,
  theoretical,
}: {
  symbol: string;
  name: string;
  contract: ApexContractId;
  contractLabel: string;
  theoretical: number;
}) {
  const [rows, setRows] = useState<SimWindowRow[]>(() =>
    simulatorWindows(symbol, contract, theoretical, name),
  );

  useEffect(() => {
    const refresh = () => setRows(simulatorWindows(symbol, contract, theoretical, name));
    refresh();
    const unsub = apexSimulator.subscribe(refresh);
    const t = setInterval(refresh, 5000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, [symbol, contract, theoretical, name]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionTitle hint={`${name} · ${contractLabel} · isolated ledger`}>
        Simulator windows
      </SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left uppercase tracking-wider text-muted-foreground">
              <th className="py-1 pr-3">Window</th>
              <th className="py-1 pr-3">Trades</th>
              <th className="py-1 pr-3">W / L</th>
              <th className="py-1 pr-3">Win rate</th>
              <th className="py-1 pr-3">Net</th>
              <th className="py-1 pr-3">Expectancy</th>
              <th className="py-1 pr-3">Longest W / L</th>
              <th className="py-1 pr-3">Current</th>
              <th className="py-1 pr-3">Last</th>
              <th className="py-1">Avg gap</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.minutes} className="border-t border-border/60">
                <td className="py-1 pr-3 text-foreground">{r.minutes}m</td>
                <td className="py-1 pr-3">{r.perf.n}</td>
                <td className="py-1 pr-3">
                  {r.perf.wins} / {r.perf.losses}
                </td>
                <td
                  className="py-1 pr-3"
                  style={{
                    color:
                      r.perf.n === 0
                        ? undefined
                        : r.perf.winRate >= r.perf.theoretical
                          ? "var(--bull)"
                          : "var(--bear)",
                  }}
                >
                  {r.perf.n ? `${(r.perf.winRate * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-1 pr-3">{r.perf.n ? r.perf.netPnl.toFixed(2) : "—"}</td>
                <td className="py-1 pr-3">
                  {r.perf.n
                    ? `${r.perf.expectancy >= 0 ? "+" : ""}${r.perf.expectancy.toFixed(3)}`
                    : "—"}
                </td>
                <td className="py-1 pr-3">
                  {r.perf.longestWinningStreak} / {r.perf.longestLosingStreak}
                </td>
                <td className="py-1 pr-3">{r.perf.currentStreak}</td>
                <td className="py-1 pr-3">{r.lastResult ?? "—"}</td>
                <td className="py-1">
                  {r.avgGapMs > 0 ? `${Math.round(r.avgGapMs / 1000)}s` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {rows.find((r) => r.minutes === 20)?.headline}
      </p>
    </div>
  );
}
