// Precision Trend AI V3 — Market Mind Engine types.
//
// This is NOT a voting system. The Market Mind Engine collects evidence from
// six reasoning modules (State, Trend, Momentum, Volatility & Entropy,
// Psychology, Scenario Simulator) and produces one integrated verdict —
// exactly like an experienced analyst.

export type TrendContract = "BUY_RISE" | "BUY_FALL";

export type MarketState =
  | "HEALTHY_TREND"
  | "STRONG_TREND"
  | "WEAK_TREND"
  | "EARLY_TREND"
  | "LATE_TREND"
  | "PULLBACK"
  | "RECOVERY"
  | "COMPRESSION"
  | "EXPANSION"
  | "ACCUMULATION"
  | "DISTRIBUTION"
  | "EXHAUSTION"
  | "TRANSITION"
  | "BREAKOUT"
  | "FALSE_BREAKOUT"
  | "REVERSAL"
  | "MANIPULATION"
  | "NOISY"
  | "STABLE";

export type EntryTiming =
  | "ENTER_NOW"
  | "WAIT"
  | "WAIT_FOR_PULLBACK"
  | "WAIT_FOR_BREAKOUT"
  | "WAIT_FOR_CONFIRMATION"
  | "WAIT_FOR_REJECTION";

export type ModuleVerdict = "BULLISH" | "BEARISH" | "NEUTRAL" | "BLOCK";

export interface ReasoningModule {
  name: string;
  verdict: ModuleVerdict;
  strength: number; // 0..100 how strong the module's read is
  headline: string; // short line
  notes: string[]; // bullet-style observations
}

export interface Scenario {
  label: string;
  description: string;
  probability: number; // 0..100
  favours: TrendContract | "NEITHER";
}

export interface ScenarioAnalysis {
  scenarios: Scenario[];
  dominant: Scenario;
  disagreement: number; // 0..100, how uncertain the future is
}

export interface Contradiction {
  headline: string;
  resolution: string;
  severity: "MINOR" | "MODERATE" | "SEVERE";
}

export interface DebateArgument {
  point: string;
  weight: number; // 0..100 how strong this argument is
}

export interface Debate {
  winner: TrendContract | "NEITHER";
  edge: number; // 0..100 how convincingly the winner outweighed the loser
  risePoints: DebateArgument[];
  fallPoints: DebateArgument[];
  rejection: string; // why the losing case was set aside (or why neither survived)
  synthesis: string; // one-line closing conclusion the analyst reached
}

export interface MarketMindReport {
  // Header
  state: MarketState;
  timing: EntryTiming;
  recommendation: TrendContract | "NO_TRADE";
  confidence: number; // 0..100 — earned, not averaged
  score: number; // 0..100 ranking score
  reason: string; // one line
  analystNote: string; // analyst-style paragraph
  suggestedConsecutiveEntries: number; // 0..6 for DBot
  expectedPersistenceSeconds: number;
  caution: string | null;

  // Six modules
  modules: {
    state: ReasoningModule;
    trend: ReasoningModule;
    momentum: ReasoningModule;
    volatility: ReasoningModule;
    psychology: ReasoningModule;
    scenario: ReasoningModule;
  };

  // Supporting analytics
  scenarios: ScenarioAnalysis;
  contradictions: Contradiction[];
  debate: Debate;
  telemetry: {
    trendScore: number; // -100 bearish .. +100 bullish
    momentumScore: number;
    volatilityQuality: number; // 0..100 how suitable
    psychologyScore: number; // -100 sellers trapped .. +100 buyers trapped
    entropy: number; // 0..1
    virtualWinRate: number; // 0..100
    continuationProbability: number; // 0..100
    reversalProbability: number; // 0..100
    buyingPressure: number; // 0..100
    sellingPressure: number; // 0..100
  };
}

export interface MarketReport {
  market: string;
  name: string;
  ticks: number;
  lastPrice: number;
  mind: MarketMindReport;
  opportunityScore: number; // == mind.score, kept for compatibility
}

// Legacy alias — some UI still references this name.
export type MarketTrendReport = MarketReport;
