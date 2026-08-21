// Trade Journal — records every READY signal + outcome feedback.
// Purely client-side (localStorage). No server writes.

export type Outcome = "pending" | "win" | "loss" | "skipped" | "invalidated";

export interface JournalEntry {
  id: string;
  ts: number;
  market: string;
  contract: string;
  confidence: number;
  health: number;
  edge: number;
  manipulation: number;
  persistence: number;
  patternLabel?: string;
  supports: string[];
  conflicts: string[];
  reasoning: string;
  outcome: Outcome;
}

const KEY = "pe:journal";
const MAX = 250;

function load(): JournalEntry[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

function save(list: JournalEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

let cache: JournalEntry[] | null = null;
const listeners = new Set<() => void>();

function get(): JournalEntry[] {
  if (!cache) cache = load();
  return cache;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function listJournal(): JournalEntry[] {
  return [...get()].slice().reverse();
}

export function recordSignal(e: Omit<JournalEntry, "id" | "ts" | "outcome">): JournalEntry {
  const list = get();
  const recent = list[list.length - 1];
  // De-dupe: don't log the same market+contract within 90s.
  if (
    recent &&
    recent.market === e.market &&
    recent.contract === e.contract &&
    Date.now() - recent.ts < 90_000
  ) {
    return recent;
  }
  const entry: JournalEntry = {
    ...e,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    outcome: "pending",
  };
  list.push(entry);
  cache = list;
  save(list);
  notify();
  return entry;
}

export function markOutcome(id: string, outcome: Outcome) {
  const list = get();
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], outcome };
  cache = list;
  save(list);
  notify();
}

export function journalStats() {
  const list = get();
  const decided = list.filter((e) => e.outcome === "win" || e.outcome === "loss");
  const wins = decided.filter((e) => e.outcome === "win").length;
  return {
    total: list.length,
    decided: decided.length,
    wins,
    winRate: decided.length ? wins / decided.length : 0,
    skipped: list.filter((e) => e.outcome === "skipped").length,
    invalidated: list.filter((e) => e.outcome === "invalidated").length,
  };
}
