// Precision Edge Intelligence Engine — public entry point.
// Consumers (dashboard, auto-trader, backtester) import from here only.
export * from "./types";
export { DEFAULT_CONFIG, mergeConfig, normaliseWeights } from "./config";
export { PrecisionEdgeEngine } from "./orchestrator";
export { RollingStore, digit } from "./rolling-store";
export { extractFeatures } from "./features";
export { contractWinProb, defaultCandidates } from "./probability";
export { fuseScores } from "./fusion";
export { evaluateCandidates, pickRecommendation, noSetupCandidate } from "./recommendation";
export { buildExplanation } from "./explanation";
export {
  addHistoricalSink,
  clearHistoricalSinks,
  logOutput,
  getHistory,
  recordOutcome,
} from "./historical-logger";
export { getDNA, updateDNA, resetDNA } from "./market-dna";
export { digitStatisticsEngine } from "./engines/digit-statistics";
export { probabilityEngine } from "./engines/probability";
export { recoveryEngine, findRecovery } from "./engines/recovery";
export { greenRedEngine } from "./engines/green-red";
export { zoneEngine } from "./engines/zone";
export { psychologyEngine } from "./engines/psychology";
export { contrarianEngine } from "./engines/contrarian";
export { marketHealthEngine, healthLabel } from "./engines/market-health";
export { equilibriumEngine } from "./engines/equilibrium";
export { botSimulatorEngine } from "./engines/bot-simulator";
export { burstForecasterEngine } from "./engines/burst-forecaster";
export {
  setupStabilityEngine,
  updateSetupState,
  resetSetupTrackers,
  trackerSnapshot,
} from "./engines/setup-stability";

// Bot-aligned signal layer (Equilibrium Doctrine, simulator, vetoes).
export * as bot from "./bot";
