// Precision Edge AI Terminal — client-side configuration contract.
// Maps the terminal's tunable controls onto the engine config.
import { DEFAULT_CONFIG } from "./config";

export interface TerminalConfig {
  /** Raw engine weights (label keys below). Displayed normalised to 100%. */
  weights: Record<string, number>;
  /** Minimum run of consecutive same-zone digits an evidence chain must show. */
  minZoneDigits: number;
  /** Reject recommendations from markets below this health (0-100). */
  minMarketHealth: number;
  /** New top pick must beat the incumbent edge by this margin to switch. */
  hysteresis: number;
  /** Continuously re-scan every market on the refresh interval. */
  autoScan: boolean;
  /** Expected seconds between AI recommendation and DBot entry. */
  entryHorizon: number;
  /** Minimum edge score for a qualifying recommendation. */
  threshold: number;
}

/** The eight tunable engines, labelled for the settings panel. */
export const WEIGHT_LABELS: { key: string; label: string }[] = [
  { key: "digitStatistics", label: "Digit Statistics" },
  { key: "psychology", label: "Market Psychology" },
  { key: "contrarian", label: "Contrarian" },
  { key: "greenRed", label: "Bar Momentum" },
  { key: "zone", label: "Digit Zones" },
  { key: "recovery", label: "Recovery Fit" },
  { key: "probability", label: "Bot Compatibility" },
  { key: "setupStability", label: "Persistence" },
  { key: "marketHealth", label: "Market Health" },
];

export const ENTRY_HORIZONS = [10, 20, 30, 60, 90, 120];

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  weights: Object.fromEntries(
    WEIGHT_LABELS.map(({ key }) => [key, DEFAULT_CONFIG.engineWeights[key] ?? 10]),
  ),
  minZoneDigits: 3,
  minMarketHealth: 58,
  hysteresis: 6,
  autoScan: true,
  entryHorizon: 60,
  threshold: 63,
};

/** Sum of the eight tunable weights, used for percentage display. */
export function weightSum(weights: Record<string, number>): number {
  return WEIGHT_LABELS.reduce((a, { key }) => a + Math.max(0, weights[key] ?? 0), 0);
}

/** Percentage (0-100, rounded) a given weight represents. */
export function weightPct(weights: Record<string, number>, key: string): number {
  const sum = weightSum(weights);
  if (sum <= 0) return 0;
  return Math.round((Math.max(0, weights[key] ?? 0) / sum) * 100);
}

/** Build the engine weight map (tunable weights + fixed marketHealth gate). */
export function toEngineWeights(cfg: TerminalConfig): Record<string, number> {
  return {
    ...DEFAULT_CONFIG.engineWeights,
    ...cfg.weights,
  };
}

// ── §60 CIO + feature flags ────────────────────────────────────────────
export interface FeatureFlags {
  /** Renders the Chief Investment Office "house pick" strip above both routes. */
  cio: boolean;
  /** Show the calibrated-confidence annotation on Edge/Parity outputs. */
  calibratedConfidence: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  cio: true,
  calibratedConfidence: true,
};
