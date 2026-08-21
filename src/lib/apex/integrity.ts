// APEX SENTINEL — DATA INTEGRITY / ANTI-MIXING PROTECTION.
//
// Market isolation is a correctness property, not a UI preference. This module
// audits the live simulator ledgers for anything that would mean a statistic
// cannot be confidently attributed to exactly one market, strategy and entry
// condition.
import { apexSimulator, type SimTrade, type MarketSimulationState } from "./simulator";
import { isApexSymbol } from "./universe";

export type CheckState = "PASS" | "WARN" | "FAIL";

export interface IntegrityCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  /** Offending record ids, when applicable. */
  offenders: string[];
}

export interface IntegrityReport {
  state: CheckState;
  score: number; // 0..100
  checks: IntegrityCheck[];
  tradesAudited: number;
  marketsAudited: number;
  checkedAt: number;
}

/** Validate one trade record before its result may be counted anywhere. */
export function validateTrade(t: SimTrade): string[] {
  const problems: string[] = [];
  if (!t.id) problems.push("missing trade id");
  if (!t.symbol) problems.push("missing market_id");
  if (!isApexSymbol(t.symbol))
    problems.push(`market_id ${t.symbol} is outside the validated universe`);
  if (!t.contract) problems.push("missing contract type");
  if (!t.contractLabel) problems.push("missing contract label");
  if (!Number.isFinite(t.barrier)) problems.push("missing contract barrier");
  if (!t.winners?.length) problems.push("missing contract winner set");
  if (!t.entryCondition) problems.push("missing entry_condition_id");
  if (!Number.isFinite(t.openedAt) || t.openedAt <= 0) problems.push("invalid entry timestamp");
  if (!t.state) problems.push("missing entry snapshot");
  if (t.result !== "OPEN") {
    if (!Number.isFinite(t.resolvedAt ?? NaN))
      problems.push("resolved trade without resolution timestamp");
    if ((t.resolvedAt ?? 0) < t.openedAt)
      problems.push("resolution precedes entry (impossible timestamp)");
    if (t.expiryDigit === null) problems.push("resolved trade without expiry digit");
    else {
      const shouldWin = t.winners.includes(t.expiryDigit);
      if (shouldWin !== (t.result === "WIN"))
        problems.push("outcome inconsistent with expiry digit and contract rule");
    }
  }
  return problems;
}

export function auditIntegrity(
  states: MarketSimulationState[] = apexSimulator.getStates(),
  ledger: SimTrade[] = apexSimulator.getLedger(5000),
): IntegrityReport {
  const checks: IntegrityCheck[] = [];
  const push = (
    id: string,
    label: string,
    state: CheckState,
    detail: string,
    offenders: string[] = [],
  ) => checks.push({ id, label, state, detail, offenders });

  // 1. Every trade is attributable.
  const invalid: string[] = [];
  for (const t of ledger) {
    const p = validateTrade(t);
    if (p.length) invalid.push(`${t.id || "«no id»"}: ${p[0]}`);
  }
  push(
    "attribution",
    "Trade attribution",
    invalid.length ? "FAIL" : "PASS",
    invalid.length
      ? `${invalid.length} record(s) cannot be confidently attributed and are excluded from evidence.`
      : `All ${ledger.length} records carry market, contract, entry-condition, snapshot and timestamp identifiers.`,
    invalid.slice(0, 5),
  );

  // 2. No duplicate trade ids / duplicate resolutions.
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const t of ledger) {
    if (seen.has(t.id)) dupes.push(t.id);
    seen.add(t.id);
  }
  push(
    "duplicates",
    "Duplicate trades / resolutions",
    dupes.length ? "FAIL" : "PASS",
    dupes.length
      ? `${dupes.length} duplicated trade id(s) detected.`
      : "No duplicated trade ids or double resolutions.",
    dupes.slice(0, 5),
  );

  // 3. Cross-market contamination — a market's book may only contain its own symbol.
  const contaminated: string[] = [];
  for (const s of states) {
    const book = apexSimulator.getMarketLedger(s.symbol, 5000);
    for (const t of book) {
      if (t.symbol !== s.symbol)
        contaminated.push(`${s.symbol} ledger holds ${t.symbol} trade ${t.id}`);
    }
  }
  push(
    "isolation",
    "Cross-market isolation",
    contaminated.length ? "FAIL" : "PASS",
    contaminated.length
      ? `${contaminated.length} foreign record(s) found inside a market ledger.`
      : `${states.length} market ledgers each contain only their own market's contracts.`,
    contaminated.slice(0, 5),
  );

  // 4. Counter consistency — the state's resolved count must equal its own book.
  const mismatched: string[] = [];
  for (const s of states) {
    const resolved = apexSimulator
      .getMarketLedger(s.symbol, 5000)
      .filter((t) => t.result !== "OPEN").length;
    if (resolved !== s.perf.n)
      mismatched.push(`${s.symbol}: state ${s.perf.n} vs ledger ${resolved}`);
  }
  push(
    "counters",
    "Per-market counters",
    mismatched.length ? "FAIL" : "PASS",
    mismatched.length
      ? `${mismatched.length} market(s) report a resolved count that disagrees with their own ledger.`
      : "Every market's reported resolved count matches its own ledger exactly.",
    mismatched.slice(0, 5),
  );

  // 5. Orphaned records — a trade whose market has no simulator state.
  const known = new Set(states.map((s) => s.symbol));
  const orphans = ledger.filter((t) => !known.has(t.symbol)).map((t) => t.id);
  push(
    "orphans",
    "Orphaned simulator records",
    orphans.length ? "WARN" : "PASS",
    orphans.length
      ? `${orphans.length} record(s) belong to a market with no live simulator.`
      : "No orphaned records.",
    orphans.slice(0, 5),
  );

  // 6. Stale open positions — an entry that never resolved.
  const now = Date.now();
  const stale = ledger
    .filter((t) => t.result === "OPEN" && now - t.openedAt > 5 * 60_000)
    .map((t) => t.id);
  push(
    "stale-open",
    "Stale open positions",
    stale.length ? "WARN" : "PASS",
    stale.length
      ? `${stale.length} paper position(s) open for over 5 minutes — feed may have stalled.`
      : "No stale open paper positions.",
    stale.slice(0, 5),
  );

  const fails = checks.filter((c) => c.state === "FAIL").length;
  const warns = checks.filter((c) => c.state === "WARN").length;
  const state: CheckState = fails ? "FAIL" : warns ? "WARN" : "PASS";
  const score = Math.max(0, 100 - fails * 30 - warns * 8);

  return {
    state,
    score,
    checks,
    tradesAudited: ledger.length,
    marketsAudited: states.length,
    checkedAt: now,
  };
}
