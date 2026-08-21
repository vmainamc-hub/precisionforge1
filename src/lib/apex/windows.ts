// APEX SENTINEL — CONTINUOUS SIMULATOR WINDOWS.
// Per market + contract rolling windows (5 / 10 / 20 / 30 / 60 minutes and any
// configured longer window). Every figure comes from that market's own
// contract-resolved ledger — never a global counter, never another market.
import { apexSimulator, type SimPerformance } from "./simulator";
import type { ApexContractId } from "./types";

export const SIM_WINDOWS_MIN = [5, 10, 20, 30, 60] as const;

export interface SimWindowRow {
  minutes: number;
  windowMs: number;
  perf: SimPerformance;
  /** ms since the last resolution inside this window (−1 when none). */
  sinceLastTradeMs: number;
  /** Mean ms between entries inside this window (−1 when fewer than 2). */
  avgGapMs: number;
  lastResult: "WIN" | "LOSS" | null;
  headline: string;
}

export function simulatorWindows(
  symbol: string,
  contract: ApexContractId | null,
  theoretical: number,
  marketName = symbol,
  minutes: readonly number[] = SIM_WINDOWS_MIN,
): SimWindowRow[] {
  return minutes.map((m) => {
    const windowMs = m * 60_000;
    const perf = apexSimulator.recentPerformance(symbol, contract, theoretical, windowMs);
    const trades = apexSimulator
      .getRecentMarketLedger(symbol, windowMs)
      .filter((t) => (!contract || t.contract === contract) && t.result !== "OPEN")
      .sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0));

    const last = trades[trades.length - 1] ?? null;
    let avgGapMs = -1;
    if (trades.length >= 2) {
      let sum = 0;
      for (let i = 1; i < trades.length; i++) sum += trades[i].openedAt - trades[i - 1].openedAt;
      avgGapMs = sum / (trades.length - 1);
    }

    return {
      minutes: m,
      windowMs,
      perf,
      sinceLastTradeMs: last?.resolvedAt ? Date.now() - last.resolvedAt : -1,
      avgGapMs,
      lastResult: last ? (last.result === "WIN" ? "WIN" : "LOSS") : null,
      headline: perf.n
        ? `${marketName} ${contract ?? "all contracts"} — last ${m} minutes: ${perf.n} trades, ${perf.wins} wins, ${perf.losses} losses, ${(perf.winRate * 100).toFixed(1)}% win rate, longest win streak ${perf.longestWinningStreak}, longest loss streak ${perf.longestLosingStreak}, expectancy ${perf.expectancy >= 0 ? "+" : ""}${perf.expectancy.toFixed(3)}/stake.`
        : `${marketName} ${contract ?? "all contracts"} — no resolved paper trades in the last ${m} minutes.`,
    };
  });
}
