// Pattern Library — labels the current market state so we can compare
// against previously observed states. Persists a bounded LRU across scans
// (both in memory and localStorage).

import type { MarketMemory } from "./memory";
import type { MarketPsychology } from "./types";

export type PatternLabel =
  | "Strong-Over-Bias"
  | "Strong-Under-Bias"
  | "Compression"
  | "Expansion"
  | "Manipulation-Spike"
  | "Transition"
  | "Exhaustion"
  | "Recovery"
  | "Reversal"
  | "Neutral";

export interface PatternMatch {
  label: PatternLabel;
  similarity: number; // 0..1 vs library median
  notes: string;
}

const KEY = "pe:pattern-library";
const MAX = 400;

interface LibraryEntry {
  ts: number;
  market: string;
  label: PatternLabel;
  vec: number[]; // 10-dim recent pct
}

let library: LibraryEntry[] | null = null;

function load(): LibraryEntry[] {
  if (library) return library;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    library = raw ? JSON.parse(raw) : [];
  } catch {
    library = [];
  }
  return library!;
}

function save() {
  if (!library) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(library.slice(-MAX)));
  } catch {
    /* ignore */
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

export function classifyPattern(mem: MarketMemory, psy: MarketPsychology): PatternLabel {
  const short = mem[100];
  const long = mem[1000];
  if (psy.manipulation >= 32) return "Manipulation-Spike";
  const zoneShift = short.zoneA - long.zoneA;
  if (Math.abs(zoneShift) >= 0.06) return zoneShift > 0 ? "Strong-Under-Bias" : "Strong-Over-Bias";
  const entropyShift = short.entropyNorm - long.entropyNorm;
  if (entropyShift <= -0.05) return "Compression";
  if (entropyShift >= 0.05) return "Expansion";
  if (psy.crowding >= 55) return "Exhaustion";
  const cos = cosine(short.pct, long.pct);
  if (cos < 0.9) return "Transition";
  if (cos >= 0.98) return "Neutral";
  return "Recovery";
}

export function recordPattern(market: string, label: PatternLabel, mem: MarketMemory) {
  const lib = load();
  lib.push({ ts: Date.now(), market, label, vec: mem[100].pct.slice() });
  if (lib.length > MAX) lib.splice(0, lib.length - MAX);
  save();
}

export function matchPattern(mem: MarketMemory, label: PatternLabel): PatternMatch {
  const lib = load();
  const peers = lib.filter((e) => e.label === label);
  if (peers.length < 3) {
    return { label, similarity: 0.5, notes: `Insufficient library evidence for ${label}` };
  }
  const vec = mem[100].pct;
  const sims = peers.map((p) => cosine(vec, p.vec));
  sims.sort((a, b) => b - a);
  const top = sims.slice(0, Math.max(3, Math.floor(sims.length / 5)));
  const similarity = top.reduce((a, b) => a + b, 0) / top.length;
  return {
    label,
    similarity,
    notes: `${peers.length} historical states labelled ${label} — mean similarity ${(similarity * 100).toFixed(0)}%`,
  };
}
