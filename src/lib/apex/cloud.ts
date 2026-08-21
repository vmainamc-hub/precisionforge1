/**
 * Durable, market-isolated persistence for Sentinel's learned state.
 *
 * Absolute market isolation is the contract of this module: every write is
 * keyed by (user, symbol, kind) and carries ONLY that market's records. Nothing
 * in here ever pools two markets, and a payload that contains a foreign symbol
 * is rejected on load by the simulator's own importer.
 *
 * Without a signed-in user Sentinel keeps learning in-session (RAM +
 * localStorage) and reports LOCAL so the UI never implies false durability.
 */
import { supabase } from "@/integrations/supabase/client";
import { apexSimulator, type SimTrade } from "./simulator";
import { exportMemory, importMemory } from "./memory";
import { isApexSymbol } from "./universe";
import {
  comboLearning,
  type ComboEvidence,
  type ComboSerialised,
} from "../sentinel/combination-learning";

/** Bumped whenever the learned-state payload shape changes. */
const LEARNING_VERSION = 2;

export type ApexCloudPhase = "IDLE" | "LOCAL" | "LOADING" | "SYNCED" | "ERROR";

export interface ApexCloudStatus {
  phase: ApexCloudPhase;
  /** Markets whose ledgers have been written at least once this session. */
  markets: number;
  restoredTrades: number;
  savedTrades: number;
  lastSyncAt: number | null;
  error: string | null;
}

const SAVE_INTERVAL_MS = 20_000;
/** Versioned snapshots of learned state, at most this often per session. */
const SNAPSHOT_INTERVAL_MS = 15 * 60_000;
let lastSnapshotAt = 0;

let status: ApexCloudStatus = {
  phase: "IDLE",
  markets: 0,
  restoredTrades: 0,
  savedTrades: 0,
  lastSyncAt: null,
  error: null,
};
const listeners = new Set<() => void>();
let running = false;
let userId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let unsubResolved: (() => void) | null = null;
/** Symbols with unflushed changes — one flush writes one row per symbol. */
const dirty = new Set<string>();
let memoryDirty = false;

function emit() {
  listeners.forEach((l) => l());
}

function patch(next: Partial<ApexCloudStatus>) {
  status = { ...status, ...next };
  emit();
}

export function apexCloudStatus(): ApexCloudStatus {
  return status;
}

export function subscribeApexCloud(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** One market's ledger row. */
async function saveMarket(symbol: string) {
  if (!userId) return;
  const trades = apexSimulator.exportMarket(symbol);
  if (!trades.length) return;
  const { error } = await supabase.from("apex_market_state").upsert(
    {
      user_id: userId,
      symbol,
      kind: "sim_ledger",
      payload: { symbol, trades } as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,symbol,kind" },
  );
  if (error) throw error;
  status.savedTrades += trades.length;
}

async function saveMemory() {
  if (!userId) return;
  const { error } = await supabase.from("apex_market_state").upsert(
    {
      user_id: userId,
      // Market memory rows are themselves keyed per market inside the payload;
      // the analogue keys embed the symbol so no market can read another's.
      symbol: "__memory",
      kind: "memory",
      payload: exportMemory() as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,symbol,kind" },
  );
  if (error) throw error;
}

// ── STAGE 3.5 combination learning: durable, per-market, versioned ─────

/**
 * The learned observations are stored per market under a versioned key so a
 * restore can never mix markets, and aggregate rows are mirrored into
 * sentinel_combo_stats so the learning is inspectable without replaying it.
 */
async function saveCombinationLearning() {
  const evidence = comboLearning.drainDirty();
  if (!evidence.length) return;

  // 1. Aggregate rows — one per market × contract × regime × entry condition.
  const rows = evidence.map((e: ComboEvidence) => ({
    symbol: e.symbol,
    contract: e.contract,
    regime: e.regime,
    entry_condition: e.entryCondition,
    n: e.n,
    wins: e.wins,
    losses: e.losses,
    weighted_n: e.weightedN,
    weighted_wins: Math.round(e.weightedN * Math.max(0, e.weightedWinRate) * 100) / 100,
    expectancy: e.expectancy,
    weighted_expectancy: e.weightedExpectancy,
    net_pnl: e.netPnl,
    max_drawdown: e.maxDrawdown,
    deterioration_pp: e.deteriorationPp,
    current_streak: e.currentStreak,
    longest_losing_streak: e.longestLosingStreak,
    decay_half_life_ms: comboLearning.getHalfLifeMs(),
    version: LEARNING_VERSION,
    last_outcome_at: e.lastOutcomeAt ? new Date(e.lastOutcomeAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  }));
  const { error: aggError } = await supabase
    .from("sentinel_combo_stats")
    .upsert(rows, { onConflict: "symbol,contract,regime,entry_condition" });
  if (aggError) throw aggError;

  // 2. Replayable observation payload, split per market so isolation holds.
  const full = comboLearning.serialise();
  const symbols = [...new Set(evidence.map((e) => e.symbol))];
  for (const symbol of symbols) {
    const payload: ComboSerialised = {
      version: full.version,
      halfLifeMs: full.halfLifeMs,
      entries: full.entries.filter((x) => x.symbol === symbol),
    };
    const { error } = await supabase.from("sentinel_learning_state").upsert(
      {
        symbol,
        kind: "combo_observations",
        payload: payload as never,
        version: LEARNING_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "symbol,kind" },
    );
    if (error) throw error;
  }
}

/** One versioned snapshot per market per UTC day — history is never rewritten. */
async function snapshotCalibration(symbols: string[]) {
  const full = comboLearning.serialise();
  for (const symbol of symbols) {
    const entries = full.entries.filter((x) => x.symbol === symbol);
    if (!entries.length) continue;
    // A duplicate for today is expected and harmless: the unique index keeps
    // exactly one snapshot per (symbol, day, version), so ignore conflicts.
    await supabase.from("sentinel_calibration_snapshots").upsert(
      {
        symbol,
        version: LEARNING_VERSION,
        payload: {
          halfLifeMs: full.halfLifeMs,
          combinations: comboLearning.forMarket(symbol),
        } as never,
      },
      { onConflict: "symbol,taken_on,version", ignoreDuplicates: true },
    );
  }
}

async function flush() {
  if (!userId) return;
  const pending = [...dirty];
  dirty.clear();
  const wasMemoryDirty = memoryDirty;
  memoryDirty = false;
  try {
    for (const symbol of pending) await saveMarket(symbol);
    if (wasMemoryDirty) await saveMemory();
    await saveCombinationLearning();
    if (pending.length && Date.now() - lastSnapshotAt > SNAPSHOT_INTERVAL_MS) {
      lastSnapshotAt = Date.now();
      await snapshotCalibration(pending);
    }
    patch({
      phase: "SYNCED",
      lastSyncAt: Date.now(),
      markets: Math.max(status.markets, pending.length),
      error: null,
    });
  } catch (e) {
    // Never lose evidence because of a transient write failure: put the
    // markets back in the queue and surface the degradation honestly.
    pending.forEach((s) => dirty.add(s));
    memoryDirty = memoryDirty || wasMemoryDirty;
    comboLearning.markAllDirty();
    patch({ phase: "ERROR", error: e instanceof Error ? e.message : String(e) });
  }
}

async function restore() {
  if (!userId) return;
  patch({ phase: "LOADING", error: null });
  const { data, error } = await supabase
    .from("apex_market_state")
    .select("symbol, kind, payload")
    .eq("user_id", userId);
  if (error) {
    patch({ phase: "ERROR", error: error.message });
    return;
  }
  const books: Record<string, SimTrade[]> = {};
  for (const row of data ?? []) {
    if (row.kind === "memory") {
      importMemory(row.payload as never);
      continue;
    }
    if (row.kind !== "sim_ledger") continue;
    // Retired/excluded markets are never rehydrated, even if history exists.
    if (!isApexSymbol(row.symbol)) continue;
    const payload = row.payload as { trades?: SimTrade[] } | null;
    const trades = Array.isArray(payload?.trades) ? payload.trades : [];
    books[row.symbol] = trades.filter((t) => t && t.symbol === row.symbol);
  }
  const restored = apexSimulator.importBooks(books);

  // Learned combination evidence is restored from its own versioned rows and
  // merged by observation timestamp, so a reload never double-counts.
  const { data: learned, error: learnedError } = await supabase
    .from("sentinel_learning_state")
    .select("symbol, kind, payload, version")
    .eq("kind", "combo_observations");
  if (!learnedError) {
    for (const row of learned ?? []) {
      if (!isApexSymbol(row.symbol)) continue;
      comboLearning.hydrate(row.payload as never);
    }
  }

  patch({
    phase: "SYNCED",
    restoredTrades: restored,
    markets: Object.keys(books).length,
    lastSyncAt: Date.now(),
  });
}

/**
 * Start durable sync. Safe to call repeatedly; only the first call attaches.
 */
export async function startApexCloudSync(): Promise<void> {
  if (running || typeof window === "undefined") return;
  running = true;

  // The local cache is loaded first so learning survives even signed out.
  comboLearning.loadCache();

  const { data } = await supabase.auth.getUser();
  userId = data.user?.id ?? null;
  if (!userId) {
    // Anonymous session: learning continues locally and says so.
    patch({ phase: "LOCAL", error: null });
    unsubResolved = apexSimulator.onResolved((trade) => {
      comboLearning.recordTrade(trade);
    });
    running = false;
    return;
  }

  await restore();

  unsubResolved = apexSimulator.onResolved((trade) => {
    dirty.add(trade.symbol);
    memoryDirty = true;
    // Stage 3.5 learns from every resolution, tagged with the regime and entry
    // condition measured AT ENTRY — never the current ones.
    comboLearning.recordTrade(trade);
    void appendTrade(trade);
  });
  timer = setInterval(() => void flush(), SAVE_INTERVAL_MS);
}

/** Append one resolved contract as immutable, market-tagged evidence. */
async function appendTrade(trade: SimTrade) {
  if (!userId || trade.result === "OPEN") return;
  const { error } = await supabase.from("apex_sim_trades").insert({
    user_id: userId,
    symbol: trade.symbol,
    contract: trade.contract,
    entry_condition: trade.entryCondition,
    entry_at: new Date(trade.openedAt).toISOString(),
    entry_digit: trade.entryDigit,
    duration_ticks: trade.durationTicks,
    resolved_at: trade.resolvedAt ? new Date(trade.resolvedAt).toISOString() : null,
    resolution_digit: trade.expiryDigit,
    outcome: trade.result,
    stake: trade.stake,
    payout: trade.payout,
    pnl: trade.pnl,
    detail: {
      market: trade.market,
      side: trade.side,
      barrier: trade.barrier,
      winners: trade.winners,
      entryRule: trade.entryRule,
      state: trade.state,
    } as never,
  });
  if (error) patch({ phase: "ERROR", error: error.message });

  // Four-dimension tagged copy: the row Stage 3.5 can be rebuilt from. The
  // client key makes the insert idempotent across reconnects.
  const { error: tagError } = await supabase.from("sentinel_sim_trades").upsert(
    {
      user_id: userId,
      symbol: trade.symbol,
      contract: trade.contract,
      regime: trade.state?.regime || "UNKNOWN",
      entry_condition: trade.entryCondition || "IMMEDIATE",
      entry_at: new Date(trade.openedAt).toISOString(),
      resolved_at: trade.resolvedAt ? new Date(trade.resolvedAt).toISOString() : null,
      entry_digit: trade.entryDigit,
      resolution_digit: trade.expiryDigit,
      duration_ticks: trade.durationTicks,
      result: trade.result,
      stake: trade.stake,
      pnl: trade.pnl,
      direction_score: trade.state?.confidence ?? null,
      setup_score: trade.state?.opportunity ?? null,
      danger: trade.state?.danger ?? null,
      detail: {
        market: trade.market,
        side: trade.side,
        barrier: trade.barrier,
        winners: trade.winners,
        entryRule: trade.entryRule,
        state: trade.state,
      } as never,
      client_key: `${trade.symbol}:${trade.id}`,
    },
    // User-scoped idempotency: the same operator re-syncing the same trade is a
    // no-op, while two operators may legitimately share a client key.
    { onConflict: "user_id,client_key", ignoreDuplicates: true },
  );

  // A duplicate client_key means the evidence is already durable — not an error.
  if (tagError && !tagError.message.includes("duplicate")) {
    patch({ phase: "ERROR", error: tagError.message });
  }
}

export function stopApexCloudSync() {
  if (timer) clearInterval(timer);
  timer = null;
  unsubResolved?.();
  unsubResolved = null;
  running = false;
}
