// Precision Edge Intelligence Engine — shared types.
// Pure data contracts. No UI, no rendering, no side effects.
import type { BotEvidence, BotSignal } from "./bot/types";
import type { BotSignalConfig } from "./bot/config";

export type Tick = { t: number; price: number };

export type ContractType =
  "UNDER" | "OVER" | "MATCHES" | "DIFFERS" | "EVEN" | "ODD" | "RISE" | "FALL";

export interface CandidateContract {
  type: ContractType;
  /** Barrier digit for OVER/UNDER/MATCHES/DIFFERS. */
  barrier?: number;
  /** Human label, e.g. "Under 7". */
  label: string;
}

export interface RecoveryPlan {
  primary: CandidateContract;
  recovery: CandidateContract;
  compatibility: number; // 0-100
  probability: number; // 0-1 recovery win probability
  quality: number; // 0-100
}

export type SetupState =
  "emerging" | "building" | "confirmed" | "strengthening" | "weakening" | "expired";

export interface EngineScore {
  /** Stable machine name of the engine. */
  name: string;
  /** 0-100 score. Higher = stronger edge / better condition. */
  score: number;
  /** Contribution weight actually applied during fusion (post-normalisation). */
  weight: number;
  /** Arbitrary feature breakdown the engine wants to expose. */
  features: Record<string, number | string | boolean>;
  /** Short human explanation strings. */
  reasons: string[];
  /** Optional warnings. */
  warnings?: string[];
}

export interface FeatureBundle {
  // Rolling window statistics extracted once and shared with every engine.
  ticks: Tick[];
  windowSize: number;
  digits: number[];
  freq: number[]; // length 10
  pct: number[]; // length 10, sums to 1
  missing: number[]; // digits with zero occurrences in window
  dominant: number[]; // sorted-desc top digits
  weak: number[]; // sorted-asc weakest digits
  entropy: number; // bits, 0..log2(10)
  entropyNorm: number; // 0..1
  skewness: number;
  oddPct: number;
  evenPct: number;
  greenPct: number; // % of ticks where price rose vs previous
  redPct: number;
  momentum: number; // -1..1
  acceleration: number;
  velocity: number; // digits per second (approx)
  tickConsistency: number; // 0..1
  distributionStability: number; // 0..1, higher = more stable
  historicalDeviation: number; // 0..1
  zoneA: number; // digits 0-4 share
  zoneB: number; // digits 5-9 share
  digitRotation: number; // 0..1 how quickly dominant digit changes
  digitPressure: number[]; // length 10, recent-vs-baseline pressure per digit
  digitVelocity: number[]; // length 10
  lastDigit: number;
  timestamp: number;
}

export interface CandidateEvaluation {
  candidate: CandidateContract;
  probability: number; // rolling P(win) 0..1
  historicalProb: number; // long window P(win) 0..1
  edge: number; // -1..1
  quality: number; // 0..100
  recovery?: RecoveryPlan;
}

export interface EngineOutput {
  market: string;
  timestamp: number;
  candidates: CandidateEvaluation[];
  recommended: CandidateEvaluation | null;
  recovery: RecoveryPlan | null;
  setupQuality: number; // 0..100
  confidence: number; // 0..100
  marketHealth: number; // 0..100
  marketHealthLabel: "excellent" | "good" | "average" | "weak" | "avoid";
  edgeScore: number; // 0..100 overall
  state: SetupState;
  ageMs: number;
  trend: "up" | "down" | "flat";
  engineContributions: EngineScore[];
  featureContributions: Record<string, number>;
  reasons: string[];
  warnings: string[];
  /**
   * Bot-aligned signal for `Precision_Percentage_Bot_V6_CONTINUOUS_SAFE_FIXED_v4`.
   * Additive: existing consumers can ignore it.
   */
  botSignal?: BotSignal;
  /** Fused bot-fitness 0-100 (same number as edgeScore, named for clarity). */
  botFitness?: number;
}

export interface EngineContext {
  market: string;
  features: FeatureBundle;
  windows: Record<number, Tick[]>; // 20,50,100,200,500,1000
  candidates: CandidateContract[];
  config: EngineConfig;
  dna: MarketDNA;
  /**
   * Bot evidence bundle. Every engine scores "how favourable is this for the
   * bot" using this. Optional so legacy callers that build a context by hand
   * keep compiling; engines degrade to neutral when it is absent.
   */
  bot?: BotEvidence;
}

export interface Engine {
  readonly name: string;
  evaluate(ctx: EngineContext): EngineScore;
}

export interface FeatureFlags {
  digitRotation: boolean;
  entropy: boolean;
  missingDigits: boolean;
  hotDigits: boolean;
  coldDigits: boolean;
  winningPercentage: boolean;
  losingPercentage: boolean;
  crowdingHeuristic: boolean;
  recoveryCompatibility: boolean;
  zoneBalance: boolean;
  momentum: boolean;
  acceleration: boolean;
  greenRed: boolean;
  distributionStability: boolean;
  historicalDeviation: boolean;
  [key: string]: boolean;
}

export interface EngineConfig {
  engineWeights: Record<string, number>; // auto-normalised to 100
  featureWeights: Record<string, number>; // per-feature contribution weight
  features: FeatureFlags;
  recommendationThreshold: number; // min edgeScore for recommendation
  persistenceMs: number; // time before "confirmed"
  rollingWindows: number[];
  memorySize: number; // max historical records per market
  notificationThreshold: number;
  autoAnalysis: boolean;
  evaluationFrequencyMs: number;
  /** Bot signal layer configuration (Equilibrium Doctrine, vetoes, simulator). */
  bot: BotSignalConfig;
}

export interface MarketDNA {
  market: string;
  samples: number;
  meanDistribution: number[]; // length 10
  meanEntropy: number;
  meanGreenPct: number;
  meanRecoveryCompatibility: number;
  meanMarketHealth: number;
  meanProbabilities: Record<string, number>; // by candidate label
  updatedAt: number;
}

export interface HistoricalRecord {
  timestamp: number;
  market: string;
  trade: CandidateContract | null;
  engines: EngineScore[];
  edgeScore: number;
  recommendation: string;
  state: SetupState;
  features: Partial<FeatureBundle>;
  /** Outcome to be filled later by trade logger. */
  outcome?: "win" | "loss" | null;
}
