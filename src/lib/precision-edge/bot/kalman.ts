// Minimal 1-D level+velocity Kalman filter.
// Used by the equilibrium engine to track the latent state of Over4% — its
// filtered level, its velocity (drift) and the uncertainty of both. Pure data
// structure with an explicit step function; no module-level mutation.

export interface KalmanState {
  level: number;
  velocity: number;
  /** Covariance matrix [[p00,p01],[p10,p11]]. */
  p: [number, number, number, number];
  samples: number;
}

export interface KalmanTuning {
  /** Process noise on level. */
  qLevel: number;
  /** Process noise on velocity. */
  qVelocity: number;
  /** Measurement noise. */
  r: number;
}

export const DEFAULT_KALMAN: KalmanTuning = { qLevel: 0.02, qVelocity: 0.004, r: 0.6 };

export function initKalman(level: number): KalmanState {
  return { level, velocity: 0, p: [1, 0, 0, 1], samples: 1 };
}

/** One predict+update cycle. `dt` is measured in filter steps (usually 1). */
export function kalmanStep(
  state: KalmanState,
  measurement: number,
  dt = 1,
  tuning: KalmanTuning = DEFAULT_KALMAN,
): KalmanState {
  // Predict
  const level = state.level + state.velocity * dt;
  const velocity = state.velocity;
  const [p00, p01, p10, p11] = state.p;
  const pp00 = p00 + dt * (p10 + p01) + dt * dt * p11 + tuning.qLevel;
  const pp01 = p01 + dt * p11;
  const pp10 = p10 + dt * p11;
  const pp11 = p11 + tuning.qVelocity;

  // Update
  const s = pp00 + tuning.r;
  const k0 = pp00 / s;
  const k1 = pp10 / s;
  const residual = measurement - level;

  return {
    level: level + k0 * residual,
    velocity: velocity + k1 * residual,
    p: [(1 - k0) * pp00, (1 - k0) * pp01, pp10 - k1 * pp00, pp11 - k1 * pp01],
    samples: state.samples + 1,
  };
}

/** Standard deviation of the filtered level — the uncertainty readout. */
export function kalmanUncertainty(state: KalmanState): number {
  return Math.sqrt(Math.max(0, state.p[0]));
}
