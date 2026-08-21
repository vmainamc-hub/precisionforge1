// Precision Parity AI — Symbol Personality Engine.
// Tracks per-symbol empirical profiles (R_10 behaves differently from R_100 and 1HZ variants).

export interface SymbolPersonalityProfile {
  symbol: string;
  is1Hz: boolean;
  baseMaxStreak: number;
  baseEntropy: number;
  preferredEngines: string[];
  reliabilityMultiplier: number;
  minConfidenceFloor: number;
}

const DEFAULT_PROFILES: Record<string, SymbolPersonalityProfile> = {
  R_10: {
    symbol: "R_10",
    is1Hz: false,
    baseMaxStreak: 9,
    baseEntropy: 0.96,
    preferredEngines: ["runs", "markov"],
    reliabilityMultiplier: 1.0,
    minConfidenceFloor: 58,
  },
  R_25: {
    symbol: "R_25",
    is1Hz: false,
    baseMaxStreak: 8,
    baseEntropy: 0.95,
    preferredEngines: ["patterns", "stats"],
    reliabilityMultiplier: 1.02,
    minConfidenceFloor: 56,
  },
  R_50: {
    symbol: "R_50",
    is1Hz: false,
    baseMaxStreak: 9,
    baseEntropy: 0.96,
    preferredEngines: ["markov", "pressure"],
    reliabilityMultiplier: 0.98,
    minConfidenceFloor: 58,
  },
  R_75: {
    symbol: "R_75",
    is1Hz: false,
    baseMaxStreak: 10,
    baseEntropy: 0.97,
    preferredEngines: ["runs", "pressure"],
    reliabilityMultiplier: 0.95,
    minConfidenceFloor: 60,
  },
  R_100: {
    symbol: "R_100",
    is1Hz: false,
    baseMaxStreak: 11,
    baseEntropy: 0.98,
    preferredEngines: ["runs", "changepoint"],
    reliabilityMultiplier: 0.92,
    minConfidenceFloor: 62,
  },
  "1HZ10V": {
    symbol: "1HZ10V",
    is1Hz: true,
    baseMaxStreak: 8,
    baseEntropy: 0.95,
    preferredEngines: ["markov", "runs"],
    reliabilityMultiplier: 1.05,
    minConfidenceFloor: 56,
  },
  "1HZ25V": {
    symbol: "1HZ25V",
    is1Hz: true,
    baseMaxStreak: 8,
    baseEntropy: 0.94,
    preferredEngines: ["stats", "markov", "patterns"],
    reliabilityMultiplier: 1.08,
    minConfidenceFloor: 54,
  },
  "1HZ50V": {
    symbol: "1HZ50V",
    is1Hz: true,
    baseMaxStreak: 9,
    baseEntropy: 0.96,
    preferredEngines: ["markov", "pressure"],
    reliabilityMultiplier: 1.0,
    minConfidenceFloor: 58,
  },
  "1HZ100V": {
    symbol: "1HZ100V",
    is1Hz: true,
    baseMaxStreak: 10,
    baseEntropy: 0.97,
    preferredEngines: ["runs", "changepoint"],
    reliabilityMultiplier: 0.94,
    minConfidenceFloor: 60,
  },
};

export function getSymbolPersonality(symbol: string): SymbolPersonalityProfile {
  if (DEFAULT_PROFILES[symbol]) {
    return DEFAULT_PROFILES[symbol];
  }
  const is1Hz = symbol.startsWith("1HZ");
  return {
    symbol,
    is1Hz,
    baseMaxStreak: is1Hz ? 8 : 9,
    baseEntropy: 0.96,
    preferredEngines: ["stats", "markov", "runs"],
    reliabilityMultiplier: 1.0,
    minConfidenceFloor: 58,
  };
}

export interface ParityPersonalityReport {
  profile: SymbolPersonalityProfile & { regimeAffinity?: string; clusterTendency?: string };
  tendency: { bias: number; recommendation: "EVEN" | "ODD" | "NEUTRAL" };
}

export function runParityPersonalityEngine(
  symbol: string,
  digits: number[],
): ParityPersonalityReport {
  const profile = getSymbolPersonality(symbol);
  const n = digits.length;
  if (n < 10) {
    return {
      profile: { ...profile, regimeAffinity: "UNKNOWN", clusterTendency: "LOW" },
      tendency: { bias: 0, recommendation: "NEUTRAL" },
    };
  }
  const evenCount = digits.filter((d) => d % 2 === 0).length;
  const bias = evenCount / n - 0.5;
  return {
    profile: {
      ...profile,
      regimeAffinity: Math.abs(bias) > 0.05 ? "TREND_PERSISTENT" : "MEAN_REVERTING",
      clusterTendency: profile.is1Hz ? "BURST" : "DISTRIBUTED",
    },
    tendency: {
      bias,
      recommendation: bias > 0.03 ? "EVEN" : bias < -0.03 ? "ODD" : "NEUTRAL",
    },
  };
}
