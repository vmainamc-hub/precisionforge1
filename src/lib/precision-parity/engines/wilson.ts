// Precision Parity AI — Core Mathematical Utilities and Wilson Score Confidence Interval.
// Pure functions, no side-effects or I/O.

/**
 * Wilson score interval for a binomial proportion.
 * Calculates the asymmetric confidence interval [lower, upper] given successes and total trials.
 * Unlike naive Wald intervals (p ± z*sqrt(p(1-p)/n)), Wilson score intervals never produce values
 * outside [0, 1] and perform accurately even for small sample sizes.
 *
 * @param successes Number of observed positive outcomes (e.g. Even counts)
 * @param total Total number of observed trials
 * @param confidenceLevel Confidence level, defaults to 0.95 (z = 1.95996)
 */
export function wilsonScoreInterval(
  successes: number,
  total: number,
  confidenceLevel: number = 0.95,
): { point: number; lower: number; upper: number; margin: number } {
  if (total <= 0) {
    return { point: 0.5, lower: 0.5, upper: 0.5, margin: 0 };
  }

  const p = Math.max(0, Math.min(1, successes / total));
  if (total === 0) return { point: 0.5, lower: 0.0, upper: 1.0, margin: 0.5 };

  // z-score for given confidence level
  let z = 1.95996; // 95%
  if (confidenceLevel >= 0.99) z = 2.57583;
  else if (confidenceLevel >= 0.9 && confidenceLevel < 0.95) z = 1.64485;
  else if (confidenceLevel >= 0.8 && confidenceLevel < 0.9) z = 1.28155;

  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const radical = Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  const halfWidth = (z * radical) / denominator;

  const lower = Math.max(0, center - halfWidth);
  const upper = Math.min(1, center + halfWidth);

  return {
    point: p,
    lower,
    upper,
    margin: (upper - lower) / 2,
  };
}

/**
 * Shannon entropy of a binary Bernoulli distribution.
 * Returns value in [0, 1] where 1 is maximum uncertainty (fair coin) and 0 is deterministic.
 */
export function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  const p1 = Math.max(1e-9, Math.min(1 - 1e-9, p));
  const p0 = 1 - p1;
  return -(p1 * Math.log2(p1) + p0 * Math.log2(p0));
}

/**
 * Clamp helper
 */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
