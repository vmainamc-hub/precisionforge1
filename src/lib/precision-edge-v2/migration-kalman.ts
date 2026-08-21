// §29 Probability Migration — Kalman upgrade.
//
// A 1-D constant-velocity Kalman filter for the winner-side probability
// migration. Replaces the linear heuristic in engine.ts / hypothesis.ts with a
// proper state estimator: filtered probability, velocity, and an uncertainty
// band (1σ / 2σ) that gates and persistence can consume.
//
// Pure functions. No I/O. No mutation of caller state — each `step` returns a
// fresh state object.

export interface KalmanState {
  /** Filtered winner-side probability, 0..1 */
  p: number;
  /** Filtered velocity (change in p per tick) */
  v: number;
  /** 2x2 error covariance, row-major: [P00, P01, P10, P11] */
  cov: [number, number, number, number];
  /** Number of observations absorbed so far. */
  n: number;
}

export interface MigrationResult {
  /** Filtered probability estimate (0..1). */
  p: number;
  /** Estimated velocity per tick. */
  velocity: number;
  /** 1σ uncertainty on p. */
  sigma: number;
  /** 68% CI on p. */
  ci68: [number, number];
  /** 95% CI on p. */
  ci95: [number, number];
  /** Direction of migration: +1 rising, -1 falling, 0 flat (|v|<epsilon). */
  direction: -1 | 0 | 1;
  /** Human label. */
  label: "rising" | "falling" | "stable";
}

const EPS_V = 0.0008; // ~0.08 pp/tick threshold for "stable"

export function initKalman(p0: number = 0.5): KalmanState {
  return {
    p: clamp01(p0),
    v: 0,
    // Wide prior so the first observations dominate.
    cov: [0.25, 0, 0, 0.01],
    n: 0,
  };
}

/**
 * Absorb one observation `z` (empirical winner-side share in [0,1]).
 * `processNoise` (Q) reflects how quickly the true probability drifts.
 * `obsNoise` (R) reflects sampling noise on `z` (smaller window → larger R).
 */
export function stepKalman(
  s: KalmanState,
  z: number,
  opts: { processNoise?: number; obsNoise?: number } = {},
): KalmanState {
  const q = opts.processNoise ?? 5e-5; // slow drift
  const r = opts.obsNoise ?? 4e-3; // moderate observation noise
  // ── Predict ───────────────────────────────────────────────────────────
  // x' = F x, F = [[1,1],[0,1]]  (constant velocity)
  const pPred = clamp01(s.p + s.v);
  const vPred = s.v;
  const [c00, c01, c10, c11] = s.cov;
  // P' = F P Fᵀ + Q ;  Q on velocity only (assume drift enters via v)
  const p00 = c00 + c01 + c10 + c11;
  const p01 = c01 + c11;
  const p10 = c10 + c11;
  const p11 = c11 + q;

  // ── Update ────────────────────────────────────────────────────────────
  // H = [1, 0]. y = z - pPred. S = P00 + R. K = [P00, P10] / S
  const y = clamp01(z) - pPred;
  const S = p00 + r;
  const k0 = p00 / S;
  const k1 = p10 / S;
  const pNew = clamp01(pPred + k0 * y);
  const vNew = vPred + k1 * y;
  // P = (I - K H) P'
  const n00 = (1 - k0) * p00;
  const n01 = (1 - k0) * p01;
  const n10 = p10 - k1 * p00;
  const n11 = p11 - k1 * p01;

  return {
    p: pNew,
    v: vNew,
    cov: [n00, n01, n10, n11],
    n: s.n + 1,
  };
}

/** Absorb a whole series in order. Convenience wrapper. */
export function runKalman(
  observations: number[],
  opts: { p0?: number; processNoise?: number; obsNoise?: number } = {},
): KalmanState {
  let s = initKalman(opts.p0 ?? observations[0] ?? 0.5);
  for (const z of observations) s = stepKalman(s, z, opts);
  return s;
}

export function summarise(s: KalmanState): MigrationResult {
  const varP = Math.max(0, s.cov[0]);
  const sigma = Math.sqrt(varP);
  const dir: -1 | 0 | 1 = s.v > EPS_V ? 1 : s.v < -EPS_V ? -1 : 0;
  const label = dir === 1 ? "rising" : dir === -1 ? "falling" : "stable";
  return {
    p: s.p,
    velocity: s.v,
    sigma,
    ci68: [clamp01(s.p - sigma), clamp01(s.p + sigma)],
    ci95: [clamp01(s.p - 2 * sigma), clamp01(s.p + 2 * sigma)],
    direction: dir,
    label,
  };
}

/**
 * Convenience: given a rolling window of empirical winner-share observations,
 * return the migration summary. This is the primary consumer surface used by
 * engine.ts / hypothesis.ts to replace the linear migration heuristic.
 */
export function migrationFromSeries(
  observations: number[],
  opts?: { processNoise?: number; obsNoise?: number },
): MigrationResult {
  if (observations.length === 0) {
    return summarise(initKalman(0.5));
  }
  return summarise(runKalman(observations, opts));
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
