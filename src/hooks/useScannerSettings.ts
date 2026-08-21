// Persisted, shared settings for the Precision Multi-Market Scanner.
import { useSyncExternalStore } from "react";
import type { PrecisionContractId } from "@/lib/precision-scanner/contracts";
import type { ScannerWeights } from "@/lib/precision-scanner/scoring";

export interface ScannerSettings {
  minFinalScore: number;
  maxManipulation: number;
  minEdgePct: number; // percent, e.g. 0.8 == +0.8%
  minPersistence: number;
  /** How many coloured (building) digits must sit inside the winning zone. */
  minBuildingWinners: number;
  lockDurationMs: number;
  weights: ScannerWeights;
  enabledContracts: Record<PrecisionContractId, boolean>;
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  minFinalScore: 65,
  maxManipulation: 25,
  minEdgePct: 0.8,
  minPersistence: 35,
  minBuildingWinners: 4,
  lockDurationMs: 60_000,
  weights: { manipulation: 0.2, edge: 0.3, persistence: 0.25, pressure: 0.25 },
  enabledContracts: {
    OVER1: true,
    OVER2: true,
    OVER3: true,
    UNDER6: true,
    UNDER7: true,
    UNDER8: true,
  },
};

const KEY = "precision-scanner-settings";

function load(): ScannerSettings {
  if (typeof window === "undefined") return DEFAULT_SCANNER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SCANNER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ScannerSettings>;
    return {
      ...DEFAULT_SCANNER_SETTINGS,
      ...parsed,
      weights: { ...DEFAULT_SCANNER_SETTINGS.weights, ...(parsed.weights ?? {}) },
      enabledContracts: {
        ...DEFAULT_SCANNER_SETTINGS.enabledContracts,
        ...(parsed.enabledContracts ?? {}),
      },
    };
  } catch {
    return DEFAULT_SCANNER_SETTINGS;
  }
}

let current: ScannerSettings = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getScannerSettings() {
  return current;
}

export function patchScannerSettings(patch: Partial<ScannerSettings>) {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  emit();
}

export function resetScannerSettings() {
  patchScannerSettings(DEFAULT_SCANNER_SETTINGS);
}

/** Change one weight and renormalise the others so the four still sum to 1. */
export function setWeight(key: keyof ScannerWeights, value: number) {
  const w = { ...current.weights, [key]: value };
  const others = (Object.keys(w) as (keyof ScannerWeights)[]).filter((k) => k !== key);
  const rest = 1 - value;
  const othersSum = others.reduce((a, k) => a + current.weights[k], 0) || 1;
  for (const k of others) w[k] = Math.max(0.01, (current.weights[k] / othersSum) * rest);
  patchScannerSettings({ weights: w });
}

export function useScannerSettings(): ScannerSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => DEFAULT_SCANNER_SETTINGS,
  );
}
