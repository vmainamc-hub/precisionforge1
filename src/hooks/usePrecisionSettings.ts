// Persisted settings for Precision Edge V2. All controls surfaced in the
// Settings drawer so operators can tune the engine without touching code.
import { useCallback, useEffect, useState } from "react";

export interface EngineWeights {
  digitStatistics: number;
  psychology: number;
  contrarian: number;
  barMomentum: number;
  digitZones: number;
  recoveryFit: number;
  botCompatibility: number;
  persistence: number;
  marketHealth: number;
}

export type ContractKey = "UNDER6" | "UNDER7" | "UNDER8" | "OVER1" | "OVER2" | "OVER3";

export interface PrecisionSettings {
  threshold: number; // minimum confidence for a signal (0-100)
  refreshMs: number; // scan cadence
  lookbackTicks: number; // ticks retained for reasoning
  minMarketHealth: number; // 0-100
  minPersistence: number; // 0-100 (scaled ticks)
  minStability: number; // 0-100 (min consistency)
  minBotCompatibility: number; // 0-100
  minZoneDigits: number; // consecutive same-zone digits
  hysteresis: number; // switch delta
  autoScan: boolean;
  onlyEnabledBot: boolean;
  entryHorizon: number; // seconds
  minHoldSeconds: number; // min lifetime of a signal
  enabledBots: Record<ContractKey, boolean>;
  weights: EngineWeights;
  // ── V3 reasoning controls ──────────────────────────────────────────
  fluctuationTolerance: number; // 0..1
  minSubEdges: number; // 0..7
  historicalAgreementMin: number; // 0..1
  migrationStabilityMin: number; // 0..1
  patternSimilarityBoost: number; // 0..1
  // ── Adjustable signal-quality caps (V3.5) ───────────────────────────
  // Hard gates the analyst must satisfy before a signal can fire.
  maxManipulation: number; // reject when psy.manipulation ≥ this (0-100)
  minEdgePct: number; // reject when contract edge < this (percentage points, e.g. 1.2 = 1.2%)
  minPersistenceTicks: number; // reject when trailing winning streak < this
  // ── Noise filter (V3.7) ─────────────────────────────────────────────
  confirmationScans: number; // consecutive scans a setup must survive before publishing
  minSignalScore: number; // minimum fused score (0-100) required to publish
  signalCooldownSeconds: number; // quiet period after a signal expires
  // ── Bot signal layer (Equilibrium Doctrine) — V3.8 ───────────────────
  equilibriumTolerance: number; // pp around 50% that still counts as equilibrium
  botWindowTicks: number; // canonical measurement window (ticks)
  minSimWinRate: number; // 0..1 simulated win rate floor
  maxDriftVelocity: number; // pp per 100 ticks before the drift veto arms
  martingaleDepth: number; // ladder steps the recovery must survive
  minCalibrationReliability: number; // 0..1
  // ── Primary Law 2: balanced edges (0,1 vs 8,9) ───────────────────────
  edgeImbalanceTolerance: number; // pp of |P(0,1) - P(8,9)| that still counts as balanced
  botVetoes: Record<string, boolean>;
}

export const BOT_VETO_LABELS: { key: string; label: string }[] = [
  { key: "equilibriumOffCentre", label: "Outside 50% ± tolerance" },
  { key: "equilibriumBroken", label: "Equilibrium broken" },
  { key: "equilibriumDrift", label: "Equilibrium drifting" },
  { key: "barrierBelowTheory", label: "Barriers below theory" },
  { key: "martingaleUnsurvivable", label: "Martingale unsurvivable" },
  { key: "lateStageBurst", label: "Late-stage burst" },
  { key: "hiddenAccumulation", label: "Hidden accumulation" },
  { key: "insufficientTicks", label: "Insufficient history" },
  { key: "calibrationUnreliable", label: "Calibration unreliable" },
  { key: "persistenceTooShort", label: "Persistence below floor" },
  { key: "manipulationTooHigh", label: "Manipulation above cap" },
  { key: "edgeBelowFloor", label: "Edge below floor" },
  { key: "fluctuationTooHigh", label: "Fluctuation above tolerance" },
  { key: "edgesUnbalanced", label: "Edges 0,1 vs 8,9 unbalanced" },
];

export const CONTRACT_LABELS: Record<ContractKey, string> = {
  UNDER6: "Under 6",
  UNDER7: "Under 7",
  UNDER8: "Under 8",
  OVER1: "Over 1",
  OVER2: "Over 2",
  OVER3: "Over 3",
};

export const ENGINE_LABELS: { key: keyof EngineWeights; label: string }[] = [
  { key: "digitStatistics", label: "Digit Statistics" },
  { key: "psychology", label: "Market Psychology" },
  { key: "contrarian", label: "Contrarian" },
  { key: "barMomentum", label: "Bar Momentum" },
  { key: "digitZones", label: "Digit Zones" },
  { key: "recoveryFit", label: "Recovery Fit" },
  { key: "botCompatibility", label: "Bot Compatibility" },
  { key: "persistence", label: "Persistence" },
  { key: "marketHealth", label: "Market Health" },
];

export const ENTRY_HORIZONS = [10, 20, 30, 60, 90, 120];

export const DEFAULT_SETTINGS: PrecisionSettings = {
  threshold: 62, // V3.6 — quality tier + DBot-primed defend quality
  refreshMs: 750,
  lookbackTicks: 1000,
  minMarketHealth: 58, // V3.6
  minPersistence: 25, // V3.6 — primed detector replaces long streak req
  minStability: 52, // V3.6
  minBotCompatibility: 58, // V3.6
  minZoneDigits: 3,
  hysteresis: 8,
  autoScan: true,
  onlyEnabledBot: true,
  entryHorizon: 60,
  minHoldSeconds: 60,
  enabledBots: {
    UNDER6: true,
    UNDER7: true,
    UNDER8: true,
    OVER1: true,
    OVER2: true,
    OVER3: true,
  },
  weights: {
    digitStatistics: 14,
    psychology: 12,
    contrarian: 10,
    barMomentum: 12,
    digitZones: 10,
    recoveryFit: 8,
    botCompatibility: 8,
    persistence: 14,
    marketHealth: 12,
  },
  fluctuationTolerance: 0.7,
  minSubEdges: 4,
  historicalAgreementMin: 0.55,
  migrationStabilityMin: 0.5,
  patternSimilarityBoost: 0.15,
  maxManipulation: 45, // V4.0 — was 26 (too strict for synthetic indices)
  minEdgePct: -8, // V4.0 — badness floor, not a profit promise — 6-winner contracts rarely show >1.2% clean edge
  minPersistenceTicks: 1, // V3.6 — DBot-primed check replaces this as quality guard
  // V3.7 noise filter — moderate by design: cuts flicker, not signal flow.
  confirmationScans: 2,
  minSignalScore: 55,
  signalCooldownSeconds: 20,
  // V4.0 — Three-parameter doctrine over the standard 1000-tick window.
  // Tolerances are sized against the real sampling error at 1000 ticks
  // (SE of Over-4% ≈ 1.58pp) so the engine actually emits signals.
  equilibriumTolerance: 1.5,
  botWindowTicks: 1000,
  minSimWinRate: 0.5,
  maxDriftVelocity: 1.8,
  martingaleDepth: 6,
  minCalibrationReliability: 0.2,
  edgeImbalanceTolerance: 2.5,
  botVetoes: {
    equilibriumOffCentre: true,
    equilibriumBroken: true,
    equilibriumDrift: true,
    barrierBelowTheory: true,
    martingaleUnsurvivable: true,
    lateStageBurst: true,
    hiddenAccumulation: true,
    insufficientTicks: true,
    calibrationUnreliable: true,
    persistenceTooShort: true,
    manipulationTooHigh: true,
    edgeBelowFloor: true,
    fluctuationTooHigh: true,
    edgesUnbalanced: true,
  },
};

// Bump this key when default gates change so operators pick up looser/tighter
// defaults instead of a stale calibration from an older version.
const STORAGE_KEY = "precision-edge-v2-settings-v4.0";

export function weightPct(w: EngineWeights, key: keyof EngineWeights): number {
  const sum = ENGINE_LABELS.reduce((a, { key: k }) => a + Math.max(0, w[k]), 0);
  if (sum <= 0) return 0;
  return Math.round((Math.max(0, w[key]) / sum) * 100);
}

export function usePrecisionSettings() {
  const [settings, setSettings] = useState<PrecisionSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          enabledBots: { ...DEFAULT_SETTINGS.enabledBots, ...(parsed.enabledBots ?? {}) },
          weights: { ...DEFAULT_SETTINGS.weights, ...(parsed.weights ?? {}) },
          botVetoes: { ...DEFAULT_SETTINGS.botVetoes, ...(parsed.botVetoes ?? {}) },
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  const patch = useCallback(
    (p: Partial<PrecisionSettings>) => setSettings((s) => ({ ...s, ...p })),
    [],
  );
  const setWeight = useCallback(
    (key: keyof EngineWeights, v: number) =>
      setSettings((s) => ({ ...s, weights: { ...s.weights, [key]: v } })),
    [],
  );
  const toggleVeto = useCallback(
    (key: string, v: boolean) =>
      setSettings((s) => ({ ...s, botVetoes: { ...s.botVetoes, [key]: v } })),
    [],
  );
  const toggleBot = useCallback(
    (key: ContractKey, v: boolean) =>
      setSettings((s) => ({ ...s, enabledBots: { ...s.enabledBots, [key]: v } })),
    [],
  );

  return { settings, setSettings, patch, setWeight, toggleBot, toggleVeto, reset };
}
