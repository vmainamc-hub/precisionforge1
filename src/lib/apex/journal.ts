// APEX SENTINEL — journal, paper trading and execution policy.
// Analysis and execution are architecturally separate: this module never
// touches the intelligence engines, it only records what the operator (or
// paper engine) did with them.
//
// The journal is server-backed (sentinel_journal) with localStorage acting as
// an offline cache: entries are written locally first so nothing is ever lost,
// then mirrored durably. Signed out, it degrades to local-only and says so.
import { supabase } from "@/integrations/supabase/client";
import type { ApexContractId } from "./types";

export type ExecutionMode = "MANUAL" | "PAPER" | "DBOT" | "API";
export type Outcome = "PENDING" | "WIN" | "LOSS" | "VOID";

export interface JournalEntry {
  id: string;
  ts: number;
  mode: ExecutionMode;
  symbol: string;
  name: string;
  contract: ApexContractId;
  contractLabel: string;
  opportunity: number;
  confidence: number;
  edgePct: number;
  danger: number;
  quality: number;
  entryDigitIndex: number;
  outcome: Outcome;
  resolvedDigit?: number;
  note?: string;
}

const KEY = "apex.journal.v1";
const SETTINGS_KEY = "apex.exec.v1";
const MAX_ENTRIES = 500;

export interface ExecutionSettings {
  mode: ExecutionMode;
  maxOpenTrades: number;
  minOpportunity: number;
  paperStake: number;
}

export const DEFAULT_EXECUTION: ExecutionSettings = {
  mode: "MANUAL", // real execution is opt-in only
  maxOpenTrades: 1,
  minOpportunity: 70,
  paperStake: 1,
};

let entries: JournalEntry[] | null = null;
const listeners = new Set<() => void>();
let journalUserId: string | null = null;
let journalPhase: "LOCAL" | "SYNCED" | "ERROR" = "LOCAL";
let journalError: string | null = null;

export function journalSyncStatus() {
  return { phase: journalPhase, error: journalError, durable: !!journalUserId };
}

function load(): JournalEntry[] {
  if (entries) return entries;
  entries = [];
  if (typeof window === "undefined") return entries;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) entries = JSON.parse(raw) as JournalEntry[];
  } catch {
    entries = [];
  }
  return entries;
}

function persist() {
  if (typeof window === "undefined" || !entries) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => l());
}

function rowFor(e: JournalEntry) {
  return {
    user_id: journalUserId!,
    client_id: e.id,
    ts: new Date(e.ts).toISOString(),
    mode: e.mode,
    symbol: e.symbol,
    name: e.name,
    contract: e.contract,
    contract_label: e.contractLabel,
    opportunity: e.opportunity,
    confidence: e.confidence,
    edge_pct: e.edgePct,
    danger: e.danger,
    quality: e.quality,
    entry_digit_index: e.entryDigitIndex,
    outcome: e.outcome,
    resolved_digit: e.resolvedDigit ?? null,
    note: e.note ?? null,
  };
}

async function pushEntry(e: JournalEntry) {
  if (!journalUserId) return;
  const { error } = await supabase
    .from("sentinel_journal")
    .upsert(rowFor(e), { onConflict: "user_id,client_id" });
  if (error) {
    journalPhase = "ERROR";
    journalError = error.message;
  } else {
    journalPhase = "SYNCED";
    journalError = null;
  }
  listeners.forEach((l) => l());
}

/**
 * Attach the durable journal. Safe to call repeatedly. Local entries that
 * predate sign-in are pushed up, and server entries are merged in by client id
 * so the same trade is never recorded twice.
 */
export async function startJournalSync(): Promise<void> {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getUser();
  journalUserId = data.user?.id ?? null;
  if (!journalUserId) {
    journalPhase = "LOCAL";
    return;
  }
  const list = load();
  const { data: rows, error } = await supabase
    .from("sentinel_journal")
    .select("*")
    .eq("user_id", journalUserId)
    .order("ts", { ascending: true })
    .limit(MAX_ENTRIES);
  if (error) {
    journalPhase = "ERROR";
    journalError = error.message;
    return;
  }
  const known = new Set(list.map((e) => e.id));
  for (const row of rows ?? []) {
    if (known.has(row.client_id)) continue;
    list.push({
      id: row.client_id,
      ts: new Date(row.ts).getTime(),
      mode: row.mode as ExecutionMode,
      symbol: row.symbol,
      name: row.name ?? row.symbol,
      contract: row.contract as ApexContractId,
      contractLabel: row.contract_label ?? row.contract,
      opportunity: Number(row.opportunity ?? 0),
      confidence: Number(row.confidence ?? 0),
      edgePct: Number(row.edge_pct ?? 0),
      danger: Number(row.danger ?? 0),
      quality: Number(row.quality ?? 0),
      entryDigitIndex: row.entry_digit_index ?? 0,
      outcome: row.outcome as Outcome,
      resolvedDigit: row.resolved_digit ?? undefined,
      note: row.note ?? undefined,
    });
  }
  list.sort((a, b) => a.ts - b.ts);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
  const serverIds = new Set((rows ?? []).map((r) => r.client_id));
  journalPhase = "SYNCED";
  journalError = null;
  persist();
  // Push anything that only exists locally.
  for (const e of list) if (!serverIds.has(e.id)) void pushEntry(e);
}

export function subscribeJournal(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listJournal(): JournalEntry[] {
  return [...load()].reverse();
}

export function recordEntry(e: Omit<JournalEntry, "id" | "ts" | "outcome">): JournalEntry {
  const list = load();
  const entry: JournalEntry = {
    ...e,
    id: `${Date.now().toString(36)}-${list.length}`,
    ts: Date.now(),
    outcome: "PENDING",
  };
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
  persist();
  void pushEntry(entry);
  return entry;
}

export function resolveEntry(id: string, outcome: Outcome, resolvedDigit?: number) {
  const list = load();
  const e = list.find((x) => x.id === id);
  if (!e || e.outcome !== "PENDING") return;
  e.outcome = outcome;
  if (resolvedDigit !== undefined) e.resolvedDigit = resolvedDigit;
  persist();
  void pushEntry(e);
}

export function openTrades(): JournalEntry[] {
  return load().filter((e) => e.outcome === "PENDING");
}

export function journalStats() {
  const list = load();
  const settled = list.filter((e) => e.outcome === "WIN" || e.outcome === "LOSS");
  const wins = settled.filter((e) => e.outcome === "WIN").length;
  return {
    total: list.length,
    settled: settled.length,
    wins,
    losses: settled.length - wins,
    winRate: settled.length ? wins / settled.length : 0,
    open: list.filter((e) => e.outcome === "PENDING").length,
  };
}

export function loadExecutionSettings(): ExecutionSettings {
  if (typeof window === "undefined") return DEFAULT_EXECUTION;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_EXECUTION, ...(JSON.parse(raw) as Partial<ExecutionSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_EXECUTION;
}

export function saveExecutionSettings(s: ExecutionSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function clearJournal() {
  entries = [];
  persist();
}
