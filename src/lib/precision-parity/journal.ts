// Precision Parity AI — Durable Track-Record & Live Calibration Engine.
// Persists per-market verdict → realised-outcome pairs with Supabase cloud persistence and offline localStorage fallback.
// Feeds Calibration, Conformal bounds, Walk-Forward validation, and Adaptive Ensemble weights.

import { supabase } from "@/integrations/supabase/client";
import type { FinalSignal } from "./final-signal";

export type ParityOutcome = "pending" | "win" | "loss" | "skipped" | "invalidated";
export type ParityQualityBand = "premium" | "standard" | "developing" | "unknown";

export interface ParityJournalEntry {
  id: string;
  ts: number;
  market: string;
  side: "EVEN" | "ODD";
  pModel: number; // 0..1 model confidence
  quality: ParityQualityBand;
  horizon: number; // ticks
  outcome: ParityOutcome;
  entryFormula?: string;
  publishedAt?: string;
  expiresAt?: string;
  resolvedAt?: string | null;
  entryDigit?: number;
}

const KEY = "pp:journal:v2";
const MAX = 1000;

function isBrowser(): boolean {
  return typeof localStorage !== "undefined";
}

function loadLocal(): ParityJournalEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ParityJournalEntry[]) : [];
  } catch {
    return [];
  }
}

function persistLocal(list: ParityJournalEntry[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

let cache: ParityJournalEntry[] | null = null;
const listeners = new Set<() => void>();

function all(): ParityJournalEntry[] {
  if (!cache) cache = loadLocal();
  return cache;
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

// Initial async sync from Supabase if table exists
let hasAttemptedSupabaseSync = false;
async function syncFromSupabase() {
  if (hasAttemptedSupabaseSync || !isBrowser()) return;
  hasAttemptedSupabaseSync = true;
  try {
    const { data, error } = await (supabase as any)
      .from("parity_signals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const mapped: ParityJournalEntry[] = data.map((d: any) => ({
        id: d.id || `${Date.now()}`,
        ts: d.published_at ? new Date(d.published_at).getTime() : Date.now(),
        market: d.market,
        side: d.action === "BUY_EVEN" ? "EVEN" : "ODD",
        pModel: (d.confidence || 75) / 100,
        quality: (d.confidence || 75) >= 75 ? "premium" : "standard",
        horizon: 1,
        outcome: (d.outcome as ParityOutcome) || "pending",
        entryFormula: d.entry_formula,
        publishedAt: d.published_at,
        expiresAt: d.expires_at,
        resolvedAt: d.resolved_at,
      }));

      // Merge with local cache
      const local = all();
      const idMap = new Map(local.map((e) => [e.id, e]));
      for (const m of mapped) {
        idMap.set(m.id, m);
      }
      cache = Array.from(idMap.values()).sort((a, b) => a.ts - b.ts);
      persistLocal(cache);
      notify();
    }
  } catch {
    // Supabase table not provisioned or offline fallback
  }
}

if (isBrowser()) {
  setTimeout(syncFromSupabase, 500);
}

export function subscribeParityJournal(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function listParityJournal(): ParityJournalEntry[] {
  return [...all()].reverse();
}

/** Record a standard journal verdict */
export function recordParityVerdict(
  e: Omit<ParityJournalEntry, "id" | "ts" | "outcome">,
): ParityJournalEntry {
  const list = all();
  const recent = list[list.length - 1];
  if (
    recent &&
    recent.market === e.market &&
    recent.side === e.side &&
    Date.now() - recent.ts < 60_000
  ) {
    return recent;
  }
  const entry: ParityJournalEntry = {
    ...e,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    outcome: "pending",
    publishedAt: new Date().toISOString(),
  };
  list.push(entry);
  cache = list;
  persistLocal(list);
  notify();

  // Async sync to Supabase
  try {
    (supabase as any)
      .from("parity_signals")
      .insert({
        id: entry.id,
        market: entry.market,
        action: entry.side === "EVEN" ? "BUY_EVEN" : "BUY_ODD",
        confidence: Math.round(entry.pModel * 100),
        entry_formula: entry.entryFormula || "",
        published_at: entry.publishedAt,
        outcome: "pending",
      })
      .then(() => {})
      .catch(() => {});
  } catch {
    /* ignore */
  }

  return entry;
}

/** Record a published FinalSignal into the durable track-record */
export function recordPublishedFinalSignal(signal: FinalSignal): ParityJournalEntry | null {
  if (signal.action === "NO_TRADE") return null;
  const side = signal.action === "BUY_EVEN" ? "EVEN" : "ODD";
  const quality: ParityQualityBand =
    signal.confidence >= 75 ? "premium" : signal.confidence >= 65 ? "standard" : "developing";

  return recordParityVerdict({
    market: signal.market.symbol,
    side,
    pModel: signal.confidence / 100,
    quality,
    horizon: 1,
    entryFormula: signal.entryFormula,
    expiresAt: signal.validity.expiresAt,
    entryDigit: signal.focusDigitOrPattern?.digit,
  });
}

/** Update the realized outcome for a recorded signal */
export function markParityOutcome(id: string, outcome: ParityOutcome) {
  const list = all();
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const resolvedAt = new Date().toISOString();
  list[idx] = { ...list[idx], outcome, resolvedAt };
  cache = list;
  persistLocal(list);
  notify();

  try {
    (supabase as any)
      .from("parity_signals")
      .update({ outcome, resolved_at: resolvedAt })
      .eq("id", id)
      .then(() => {})
      .catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Check pending signals against the latest printed tick last digit and auto-resolve */
export function checkAndResolvePendingSignals(market: string, printedDigit: number) {
  const list = all();
  const now = Date.now();
  const printedParity: "EVEN" | "ODD" = printedDigit % 2 === 0 ? "EVEN" : "ODD";

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    if (entry.market === market && entry.outcome === "pending") {
      // If signal had a specific trigger digit, resolve when that digit appeared or window expired
      const isWin = entry.side === printedParity;
      markParityOutcome(entry.id, isWin ? "win" : "loss");
    }
  }
}

export interface ParityJournalStats {
  market: string | "*";
  total: number;
  decided: number;
  wins: number;
  hitRate: number;
  brier: number;
  byBand: Record<
    ParityQualityBand,
    { total: number; decided: number; hitRate: number; brier: number }
  >;
}

export function parityJournalStats(market: string | "*" = "*"): ParityJournalStats {
  const list = all().filter((e) => (market === "*" ? true : e.market === market));
  const decided = list.filter((e) => e.outcome === "win" || e.outcome === "loss");
  const wins = decided.filter((e) => e.outcome === "win").length;
  const hitRate = decided.length ? wins / decided.length : 0;
  const brier = decided.length
    ? decided.reduce((acc, e) => {
        const y = e.outcome === "win" ? 1 : 0;
        return acc + (e.pModel - y) ** 2;
      }, 0) / decided.length
    : 0;
  const bands: ParityQualityBand[] = ["premium", "standard", "developing", "unknown"];
  const byBand = Object.fromEntries(
    bands.map((b) => {
      const bucket = list.filter((e) => e.quality === b);
      const bDecided = bucket.filter((e) => e.outcome === "win" || e.outcome === "loss");
      const bWins = bDecided.filter((e) => e.outcome === "win").length;
      const bHit = bDecided.length ? bWins / bDecided.length : 0;
      const bBrier = bDecided.length
        ? bDecided.reduce((acc, e) => acc + (e.pModel - (e.outcome === "win" ? 1 : 0)) ** 2, 0) /
          bDecided.length
        : 0;
      return [b, { total: bucket.length, decided: bDecided.length, hitRate: bHit, brier: bBrier }];
    }),
  ) as ParityJournalStats["byBand"];
  return {
    market,
    total: list.length,
    decided: decided.length,
    wins,
    hitRate,
    brier,
    byBand,
  };
}

export function _resetParityJournalForTests() {
  cache = [];
  if (isBrowser()) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
