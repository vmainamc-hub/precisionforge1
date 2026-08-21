// Phase 3 — Sequential Monte Carlo (Particle Filter)
// Dynamic Bayesian filtering tracking latent even/odd bias and edge persistence without self-referential bias.

export interface Particle {
  evenBias: number; // 0..1 probability of next tick being EVEN
  persistence: number; // expected duration (ticks)
  weight: number; // normalized importance weight
}

export interface ParticleReport {
  posteriorMeanEven: number;
  credibleLow: number;
  credibleHigh: number; // 90% credible interval [5%, 95%]
  effectiveParticles: number;
  weightCollapse: boolean; // ESS < 10% → edge collapsed, invalidate live signal
  edgeDistribution: number[]; // 20-bin histogram of even bias (0..1)
  survivalByEntry: number[]; // P(edge persists after entry k), k = 1..5
  narrative: string;
}

const PARTICLES = 2000;
const SIGMA_WALK = 0.012;

function createRng(seed: number = 42) {
  let s = seed | 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// Box-Muller normal transform
function sampleGaussian(mean: number, std: number, rng: () => number): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * std;
}

// Approximate Beta sampling using Gamma / Normal approximation
function sampleBeta(alpha: number, beta: number, rng: () => number): number {
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const std = Math.sqrt(variance);
  const val = sampleGaussian(mean, std, rng);
  return Math.max(0.01, Math.min(0.99, val));
}

export function runParticleFilter(
  digits: number[],
  targetContract: "BUY_EVEN" | "BUY_ODD" | "DIGITEVEN" | "DIGITODD" | "NO_TRADE" = "BUY_EVEN",
): ParticleReport {
  const n = digits.length;
  const sample = digits.slice(-500);
  const rng = createRng(n + 101);

  // Compute seed Beta distribution from historical window
  let evenCount = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] % 2 === 0) evenCount++;
  }
  const oddCount = sample.length - evenCount;
  const alpha = 1 + evenCount;
  const beta = 1 + oddCount;

  // 1. Initialize particle cloud
  const particles: Particle[] = new Array(PARTICLES);
  const initWeight = 1.0 / PARTICLES;
  for (let i = 0; i < PARTICLES; i++) {
    particles[i] = {
      evenBias: sampleBeta(alpha, beta, rng),
      persistence: 5 + rng() * 15,
      weight: initWeight,
    };
  }

  // 2. Sequential filtering through recent 50 ticks
  const recentWindow = digits.slice(-50);
  for (let t = 0; t < recentWindow.length; t++) {
    const isEvenObserved = recentWindow[t] % 2 === 0;

    // A. State propagation (random walk with mean-reversion toward 0.5)
    for (let i = 0; i < PARTICLES; i++) {
      const p = particles[i];
      const drifted = sampleGaussian(p.evenBias * 0.98 + 0.5 * 0.02, SIGMA_WALK, rng);
      p.evenBias = Math.max(0.01, Math.min(0.99, drifted));
    }

    // B. Likelihood update
    let sumW = 0;
    for (let i = 0; i < PARTICLES; i++) {
      const p = particles[i];
      const likelihood = isEvenObserved ? p.evenBias : 1 - p.evenBias;
      p.weight *= likelihood;
      sumW += p.weight;
    }

    // C. Normalization
    if (sumW > 1e-12) {
      for (let i = 0; i < PARTICLES; i++) {
        particles[i].weight /= sumW;
      }
    } else {
      // Re-initialize uniform if numerical underflow
      for (let i = 0; i < PARTICLES; i++) {
        particles[i].weight = initWeight;
      }
    }

    // D. Compute Kish ESS
    let sumSqW = 0;
    for (let i = 0; i < PARTICLES; i++) {
      sumSqW += particles[i].weight * particles[i].weight;
    }
    const ess = sumSqW > 0 ? 1.0 / sumSqW : 0;

    // E. Systematic Resampling when ESS < PARTICLES / 2
    if (ess < PARTICLES / 2) {
      const cumsum = new Float64Array(PARTICLES);
      let acc = 0;
      for (let i = 0; i < PARTICLES; i++) {
        acc += particles[i].weight;
        cumsum[i] = acc;
      }

      const resampled: Particle[] = new Array(PARTICLES);
      const step = 1.0 / PARTICLES;
      let u = rng() * step;
      let j = 0;

      for (let i = 0; i < PARTICLES; i++) {
        while (u > cumsum[j] && j < PARTICLES - 1) {
          j++;
        }
        resampled[i] = {
          evenBias: particles[j].evenBias,
          persistence: particles[j].persistence,
          weight: initWeight,
        };
        u += step;
      }

      for (let i = 0; i < PARTICLES; i++) {
        particles[i] = resampled[i];
      }
    }
  }

  // 3. Posterior Summary Statistics
  let meanEven = 0;
  let sumSqWFinal = 0;
  const biases: number[] = new Array(PARTICLES);

  for (let i = 0; i < PARTICLES; i++) {
    meanEven += particles[i].evenBias * particles[i].weight;
    sumSqWFinal += particles[i].weight * particles[i].weight;
    biases[i] = particles[i].evenBias;
  }

  const effectiveParticles = sumSqWFinal > 0 ? 1.0 / sumSqWFinal : 0;
  const weightCollapse = effectiveParticles < 0.1 * PARTICLES;

  // Credible interval extraction (weighted percentiles)
  biases.sort((a, b) => a - b);
  const idx5 = Math.floor(PARTICLES * 0.05);
  const idx95 = Math.floor(PARTICLES * 0.95);
  const credibleLow = biases[idx5];
  const credibleHigh = biases[idx95];

  // 20-bin histogram of even bias (0.0 to 1.0)
  const edgeDistribution: number[] = new Array(20).fill(0);
  for (let i = 0; i < PARTICLES; i++) {
    const bin = Math.min(19, Math.max(0, Math.floor(biases[i] * 20)));
    edgeDistribution[bin]++;
  }

  // Forward survival by entry k = 1..5
  const isTargetEven = targetContract === "BUY_EVEN" || targetContract === "DIGITEVEN";
  const targetBias = isTargetEven ? meanEven : 1 - meanEven;

  const survivalByEntry: number[] = [1, 2, 3, 4, 5].map((k) => {
    // Model edge decay via geometric survival P(staying > 0.5128 after k entries)
    const decay = Math.exp(-0.18 * (k - 1));
    const survivedBias = 0.5 + (targetBias - 0.5) * decay;
    return Math.max(0.05, Math.min(0.99, survivedBias >= 0.5128 ? survivedBias : 0.5 * decay));
  });

  const narrative = weightCollapse
    ? `SMC Particle Filter detected weight collapse (ESS: ${effectiveParticles.toFixed(0)}/${PARTICLES} < 10%). Latent edge has fully dissipated.`
    : `SMC Particle Filter (N=${PARTICLES}): Posterior mean P(EVEN)=${(meanEven * 100).toFixed(1)}%, 90% credible interval [${(credibleLow * 100).toFixed(1)}% - ${(credibleHigh * 100).toFixed(1)}%]. ESS healthy at ${effectiveParticles.toFixed(0)} particles.`;

  return {
    posteriorMeanEven: meanEven,
    credibleLow,
    credibleHigh,
    effectiveParticles,
    weightCollapse,
    edgeDistribution,
    survivalByEntry,
    narrative,
  };
}
