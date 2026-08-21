// Precision Digit Mathematical Utilities
// Numerical approximations for Error Function (erf) and Complementary Error Function (erfc)

/**
 * Standard Error Function erf(x) approximation via Chebyshev/Abramowitz-Stegun
 * Maximum error: 1.5e-7
 */
export function erf(x: number): number {
  if (!Number.isFinite(x)) {
    return x > 0 ? 1 : -1;
  }
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Complementary Error Function erfc(x) = 1 - erf(x)
 * Accurate tail approximation
 */
export function erfc(x: number): number {
  if (!Number.isFinite(x)) {
    return x > 0 ? 0 : 2;
  }
  const t = 1.0 / (1.0 + 0.5 * Math.abs(x));
  const tau =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? tau : 2.0 - tau;
}

// Attach polyfills safely if not defined
declare global {
  interface Math {
    erf?: (x: number) => number;
    erfc?: (x: number) => number;
  }
}

if (typeof Math !== "undefined") {
  if (!Math.erf) {
    Math.erf = erf;
  }
  if (!Math.erfc) {
    Math.erfc = erfc;
  }
}
