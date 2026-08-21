// EQUILIBRIUM ENGINE — owner of the Primary Law (the Equilibrium Doctrine).
//
//   Over 4  = P(last digit >= 5) over the last 1000 ticks
//   Under 5 = P(last digit <= 4) over the last 1000 ticks
//   E       = |Over4% - 50|  ==  |Under5% - 50|
//
// The bot performs best when both sit at 50%. E is therefore a hard gate on the
// entire system, not a weighted input.
import type { EquilibriumBand } from "./spec";
import { bandFor, equilibriumScore, type BotSignalConfig } from "./config";
import { initKalman, kalmanStep, kalmanUncertainty, type KalmanState } from "./kalman";

export interface WindowEquilibrium {
  window: number;
  samples: number;
  over4Pct: number;
  under5Pct: number;
  error: number;
  band: EquilibriumBand;
  score: number;
}

export interface EquilibriumReading {
  /** Canonical (default 1000-tick) measurement. */
  window: number;
  samples: number;
  over4Pct: number;
  under5Pct: number;
  error: number;
  band: EquilibriumBand;
  score: number;
  /** Every measured window, canonical included, strictest-first ordering kept. */
  windows: WindowEquilibrium[];
  /** 0-100: share of measured windows inside PERFECT/PRIME. */
  stability: number;
  /** Kalman velocity of Over4%, expressed in pp per 100 ticks. */
  driftVelocity: number;
  /** Filtered latent level of Over4%. */
  filteredOver4: number;
  /** Standard deviation of the filtered level. */
  uncertainty: number;
  /** How long the market has held its current band. */
  timeInBandMs: number;
  /** Projected ms until the band is exited at the current drift, Infinity if stable. */
  timeToExitBandMs: number;
  /** Which side equilibrium is walking towards. */
  driftSide: "HIGH" | "LOW" | "STABLE";
}

export function over4Pct(digits: number[]): number {
  if (digits.length === 0) return 50;
  return (digits.filter((d) => d >= 5).length / digits.length) * 100;
}

export function measureWindow(
  digits: number[],
  window: number,
  cfg: BotSignalConfig,
): WindowEquilibrium {
  const slice = digits.slice(-window);
  const over4 = over4Pct(slice);
  const error = Math.abs(over4 - 50);
  return {
    window,
    samples: slice.length,
    over4Pct: over4,
    under5Pct: 100 - over4,
    error,
    band: bandFor(error, cfg.bands),
    score: equilibriumScore(error, cfg.eMax),
  };
}

// ── Per-market latent state (Kalman + band residency) ──────────────────────
interface MarketEqState {
  kalman: KalmanState;
  band: EquilibriumBand;
  bandSince: number;
  lastAt: number;
  lastSamples: number;
}

const states = new Map<string, MarketEqState>();

export function resetEquilibriumState(market?: string) {
  if (market) states.delete(market);
  else states.clear();
}

/**
 * Full doctrine reading for one market. Stateful only in the sense that the
 * Kalman filter and band residency are carried between calls per market.
 */
export function readEquilibrium(
  market: string,
  digits: number[],
  cfg: BotSignalConfig,
  now = Date.now(),
): EquilibriumReading {
  const canonical = measureWindow(digits, cfg.canonicalWindow, cfg);
  // Dedupe: once the canonical window is clamped to 1000 an evidence window can
  // collide with it, which produced duplicate rows (and duplicate React keys).
  const evidence = cfg.evidenceWindows
    .filter((w) => w !== cfg.canonicalWindow)
    .map((w) => measureWindow(digits, w, cfg))
    .filter((w) => w.samples > 0);
  const windows = [canonical, ...evidence].sort((a, b) => a.window - b.window);

  const measured = windows.filter((w) => w.samples >= 50);
  const stability = measured.length
    ? (measured.filter((w) => w.band === "PERFECT" || w.band === "PRIME").length /
        measured.length) *
      100
    : 0;

  let st = states.get(market);
  if (!st) {
    st = {
      kalman: initKalman(canonical.over4Pct),
      band: canonical.band,
      bandSince: now,
      lastAt: now,
      lastSamples: digits.length,
    };
    states.set(market, st);
  } else {
    // Step the filter once per evaluation; drift is later scaled to pp/100 ticks.
    const grew = Math.max(1, digits.length - st.lastSamples);
    st.kalman = kalmanStep(st.kalman, canonical.over4Pct, 1);
    st.lastSamples = digits.length;
    st.lastAt = now;
    if (canonical.band !== st.band) {
      st.band = canonical.band;
      st.bandSince = now;
    }
    void grew;
  }

  // Velocity is pp per filter step; a step ≈ one evaluation cycle. Express it in
  // pp per 100 ticks using the observed evaluation cadence as the tick proxy.
  const driftVelocity = st.kalman.velocity * 100;
  const timeInBandMs = now - st.bandSince;
  const edgeOfBand = bandEdge(canonical.band, cfg);
  const distanceToEdge = Math.max(0, edgeOfBand - canonical.error);
  const timeToExitBandMs =
    Math.abs(driftVelocity) < 0.05
      ? Number.POSITIVE_INFINITY
      : (distanceToEdge / Math.abs(driftVelocity)) * 100_000;

  return {
    window: canonical.window,
    samples: canonical.samples,
    over4Pct: canonical.over4Pct,
    under5Pct: canonical.under5Pct,
    error: canonical.error,
    band: canonical.band,
    score: canonical.score,
    windows,
    stability,
    driftVelocity,
    filteredOver4: st.kalman.level,
    uncertainty: kalmanUncertainty(st.kalman),
    timeInBandMs,
    timeToExitBandMs,
    driftSide: driftVelocity > 0.15 ? "HIGH" : driftVelocity < -0.15 ? "LOW" : "STABLE",
  };
}

function bandEdge(band: EquilibriumBand, cfg: BotSignalConfig): number {
  switch (band) {
    case "PERFECT":
      return cfg.bands.perfect;
    case "PRIME":
      return cfg.bands.prime;
    case "ACCEPTABLE":
      return cfg.bands.acceptable;
    case "DRIFTING":
      return cfg.bands.drifting;
    default:
      return cfg.eMax;
  }
}
