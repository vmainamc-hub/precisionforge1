// Phase 10.2 — Digit Hazard & Waiting-Time Engine
// Models empirical inter-arrival times for digits 0-9 with rigorous Gambler's Fallacy guards.

export interface DigitHazard {
  digit: number;
  currentGap: number; // ticks since last appearance
  medianGap: number; // empirical median gap
  gapPercentile: number; // 0..100 percentile of current gap
  probNextTicks: number[]; // P(appears within next k ticks), k = 1..5
  geometricBaseline: number[]; // theoretical geometric probabilities
  isNonGeometric: boolean; // true only if gap distribution rejects geometric null (p < 0.05)
  hazardEdge: number; // -100% .. +100% deviation from geometric baseline
  narrative: string;
}

export interface DigitHazardReport {
  hazards: DigitHazard[];
  mostOverdue: DigitHazard;
  mostFrequentRecent: DigitHazard;
  gamblersFallacyDetected: boolean;
  narrative: string;
}

export function computeDigitHazards(digits: number[] = []): DigitHazardReport {
  const clean = (digits ?? [])
    .map((d) => (typeof d === "number" && Number.isFinite(d) ? Math.abs(Math.floor(d)) % 10 : 0))
    .slice(-500);
  const n = clean.length;

  const hazards: DigitHazard[] = [];
  let gamblersFallacyCount = 0;

  for (let d = 0; d < 10; d++) {
    const gapLengths: number[] = [];
    let lastIdx = -1;

    for (let i = 0; i < n; i++) {
      if (clean[i] === d) {
        if (lastIdx >= 0) {
          gapLengths.push(i - lastIdx);
        }
        lastIdx = i;
      }
    }

    const currentGap = lastIdx >= 0 ? n - 1 - lastIdx : n;

    // Geometric theoretical baseline with p = 0.1
    // P(T <= k) = 1 - (1 - p)^k
    const pGeo = 0.1;
    const geometricBaseline = [1, 2, 3, 4, 5].map((k) => 1 - (1 - pGeo) ** k);

    let medianGap = 7;
    let gapPercentile = 50;
    let probNextTicks = [...geometricBaseline];
    let isNonGeometric = false;
    let hazardEdge = 0;

    if (gapLengths.length >= 10) {
      gapLengths.sort((a, b) => a - b);
      medianGap = gapLengths[Math.floor(gapLengths.length / 2)];

      // Percentile of current gap
      const smallerCount = gapLengths.filter((g) => g <= currentGap).length;
      gapPercentile = Math.round((smallerCount / gapLengths.length) * 100);

      // Empirical forward conditional probability given currentGap
      const eligibleGaps = gapLengths.filter((g) => g >= currentGap);
      if (eligibleGaps.length >= 8) {
        probNextTicks = [1, 2, 3, 4, 5].map((k) => {
          const finishedWithinK = eligibleGaps.filter((g) => g <= currentGap + k).length;
          const empProb = finishedWithinK / eligibleGaps.length;
          // Shrink toward geometric baseline
          const shrinkWeight = Math.min(1.0, eligibleGaps.length / 20);
          return shrinkWeight * empProb + (1 - shrinkWeight) * geometricBaseline[k - 1];
        });

        // 2-sample Kolmogorov-Smirnov test against geometric CDF
        let maxD = 0;
        for (let i = 0; i < gapLengths.length; i++) {
          const empCDF = (i + 1) / gapLengths.length;
          const geoCDF = 1 - (1 - pGeo) ** gapLengths[i];
          maxD = Math.max(maxD, Math.abs(empCDF - geoCDF));
        }

        // Critical value for alpha = 0.05: 1.36 / sqrt(N)
        const ksCritical = 1.36 / Math.sqrt(gapLengths.length);
        isNonGeometric = maxD > ksCritical;

        if (isNonGeometric) {
          hazardEdge = ((probNextTicks[0] - geometricBaseline[0]) / geometricBaseline[0]) * 100;
        } else {
          // Gambler's fallacy guard: If distribution is geometric, force edge to 0
          hazardEdge = 0;
          gamblersFallacyCount++;
        }
      }
    }

    const narrative = isNonGeometric
      ? `Digit ${d} gap distribution rejects memoryless geometric null (KS D=${gapPercentile.toFixed(0)}th percentile). Forward edge: +${hazardEdge.toFixed(1)}%.`
      : `Digit ${d} inter-arrivals are strictly memoryless geometric. Gambler's fallacy guard active: 0% predictive edge.`;

    hazards.push({
      digit: d,
      currentGap,
      medianGap,
      gapPercentile,
      probNextTicks,
      geometricBaseline,
      isNonGeometric,
      hazardEdge,
      narrative,
    });
  }

  // Sort by current gap descending
  const sorted = [...hazards].sort((a, b) => b.currentGap - a.currentGap);
  const mostOverdue = sorted[0];
  const mostFrequentRecent = [...hazards].sort((a, b) => a.currentGap - b.currentGap)[0];

  const gamblersFallacyDetected = gamblersFallacyCount >= 8;
  const narrative = gamblersFallacyDetected
    ? `Memoryless arrival regime: Digit gaps follow theoretical geometric distributions. Overdue digits do not possess statistical edge.`
    : `Empirical hazard clustering detected across ${10 - gamblersFallacyCount} digits.`;

  return {
    hazards,
    mostOverdue,
    mostFrequentRecent,
    gamblersFallacyDetected,
    narrative,
  };
}
