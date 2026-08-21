// Precision Edge AI V2 — Market Reasoning Intelligence Engine.
// Pure data contracts. Each supported contract has its own independent
// intelligence engine; the decision layer only compares them at the end.

export type Tick = { t: number; price: number };

export type ContractId = "UNDER6" | "UNDER7" | "UNDER8" | "OVER1" | "OVER2" | "OVER3";

/** Lifecycle state of a contract hypothesis for a given market. */
export type VerdictState =
  "READY" | "WATCH" | "BUILDING" | "CONFLICT" | "REJECTED" | "TRANSITION" | "UNSTABLE" | "EXPIRED";

export type DigitTemp = "hot" | "cold" | "neutral";
export type DigitTrend = "rising" | "falling" | "stable";

/** The identity of a single digit — not merely a percentage. */
export interface DigitProfile {
  d: number;
  pct: number; // window share 0..1
  recentPct: number; // recent-window share 0..1
  pressure: number; // recentPct - pct
  temp: DigitTemp;
  trend: DigitTrend;
  low: boolean; // 0-4
  high: boolean; // 5-9
  even: boolean;
  zone: "A" | "B"; // A = 0-4, B = 5-9
}

export interface DigitStatistics {
  digits: number[];
  freq: number[]; // length 10
  pct: number[]; // length 10
  recentPct: number[]; // length 10
  profiles: DigitProfile[]; // length 10
  hot: number[];
  cold: number[];
  dominant: number; // most frequent digit
  suppressed: number; // least frequent digit
  lastDigit: number;
  windowSize: number;
}

export interface MarketPsychology {
  entropyNorm: number; // 0..1
  health: number; // 0..100
  healthLabel: "excellent" | "good" | "average" | "weak" | "avoid";
  zoneA: number; // 0-4 share
  zoneB: number; // 5-9 share
  oddPct: number;
  evenPct: number;
  manipulation: number; // 0..100 — distribution anomaly
  crowding: number; // 0..100 — single-digit concentration
  persistenceTicks: number; // stability window observed
}

/** Which trader group is currently dominating / exhausting. */
export interface TraderBehaviour {
  overPressure: number; // -1..1 (high digits gaining)
  underPressure: number; // -1..1 (low digits gaining)
  oddPressure: number; // -1..1
  evenPressure: number; // -1..1
  dominantGroup: string;
  exhaustingGroup: string;
  summary: string;
}

export interface Gate {
  name: string;
  ok: boolean;
  major: boolean;
  detail: string;
}

export interface ContractVerdict {
  id: ContractId;
  label: string; // "Under 7"
  side: "UNDER" | "OVER";
  barrier: number;
  state: VerdictState;
  confidence: number; // 0..100
  empWinRate: number; // 0..1
  recentWinRate: number; // 0..1
  theoretical: number; // 0..1
  edge: number; // empWinRate - theoretical
  momentum: number; // recentWinRate - empWinRate
  persistenceTicks: number;
  consistency: number; // internal-coherence score used for ranking
  gates: Gate[];
  reasons: string[]; // supporting reasoning bullets
  rejection: string | null; // why rejected / in conflict
  // ── V3 additions (optional so existing UI keeps working) ──────────────
  supports?: string[];
  conflicts?: string[];
  alternativesRejected?: { id: string; label: string; reason: string }[];
  gateFailed?: string;
  edgeParts?: { name: string; value: number; pass: boolean; detail: string }[];
  // ── V3.5 Hypothesis-Driven additions (all optional) ───────────────────
  hypothesisAlignment?: number; // -1..+1 vs dominant hypothesis
  hypothesisAlignmentLabel?: string;
  quality?: import("./opportunity").SignalQuality;
  persistence?: import("./opportunity").PersistenceForecast;
  recovery?: import("./opportunity").RecoveryPlan;
  // ── V4 PRESSURE-FIRST ────────────────────────────────────────────────
  // The Digit Pressure / Scarcity reading for this contract. This is now the
  // PRIMARY driver of state, confidence and ranking — everything else is
  // corroborating evidence.
  pressure?: import("./pressure-engine").PressureVerdict;
  // ── V3.6 DBot-aware entry priming ────────────────────────────────────
  // Matches the user's actual DBot behaviour: wait for ≥N losers in the
  // recent window, then a confirmation winner. Only primed setups fire.
  dbotPrimed?: {
    primed: boolean;
    losersInWindow: number;
    confirmations: number;
    windowSize: number;
    detail: string;
  };
}

export interface MarketReasoning {
  market: string;
  name: string;
  ticks: number;
  ready: boolean; // enough ticks to reason
  stats: DigitStatistics;
  psychology: MarketPsychology;
  behaviour: TraderBehaviour;
  verdicts: ContractVerdict[]; // one per contract engine
  best: ContractVerdict | null; // most internally-consistent READY verdict
  headline: ContractVerdict; // top-ranked verdict regardless of state
  // ── V3 additions ──────────────
  digitStates?: { d: number; state: string; score: number; detail: string }[];
  patternLabel?: string;
  patternSimilarity?: number;
  fluctuation?: number;
  fluctuationReasons?: string[];
  // ── V3.5 Hypothesis-Driven additions ────────────────────────────────
  hypotheses?: import("./hypothesis").HypothesisSet;
  // ── V4 — the market-wide pressure/scarcity field (per-digit states) ──
  pressureField?: import("./pressure-engine").PressureField;
}
