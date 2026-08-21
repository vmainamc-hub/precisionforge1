// Precision Parity AI — Parity Online Changepoint Engine (CUSUM / Page-Hinkley).
// Detects sudden regime shifts in the digit/parity stream so outdated evidence is discounted.

export interface ParityChangepointResult {
  hasChangepoint: boolean;
  changepointTickAge: number; // how many ticks ago changepoint occurred
  cusumScore: number;
  threshold: number;
  discountFactor: number; // 0.2..1.0 — weight applied to historical evidence
  state: "STABLE" | "CHANGEPOINT_DETECTED" | "TRANSITION";
  summary: string;
}

export function runParityChangepointEngine(
  digits: number[],
  threshold: number = 7.5,
): ParityChangepointResult {
  const n = digits.length;
  if (n < 40) {
    return {
      hasChangepoint: false,
      changepointTickAge: 999,
      cusumScore: 0,
      threshold,
      discountFactor: 1.0,
      state: "STABLE",
      summary: "Data too short for changepoint detector",
    };
  }

  // Map to centered parity values: +0.5 for Even, -0.5 for Odd
  const values = digits.map((d) => (d % 2 === 0 ? 0.5 : -0.5));

  // Compute baseline mean from first half
  const baselineLen = Math.min(200, Math.floor(n * 0.5));
  let sum0 = 0;
  for (let i = 0; i < baselineLen; i++) {
    sum0 += values[i];
  }
  const mean0 = sum0 / baselineLen;

  // Two-sided CUSUM test over test window
  let sPos = 0;
  let sNeg = 0;
  let maxPos = 0;
  let maxNeg = 0;
  let lastTriggerIndex = -1;

  for (let i = baselineLen; i < n; i++) {
    const dev = values[i] - mean0;
    sPos = Math.max(0, sPos + dev - 0.05);
    sNeg = Math.max(0, sNeg - dev - 0.05);

    if (sPos > maxPos) maxPos = sPos;
    if (sNeg > maxNeg) maxNeg = sNeg;

    if (sPos >= threshold || sNeg >= threshold) {
      lastTriggerIndex = i;
      sPos = 0;
      sNeg = 0;
    }
  }

  const maxCusum = Math.max(maxPos, maxNeg);
  const hasChangepoint = lastTriggerIndex !== -1 && n - 1 - lastTriggerIndex <= 30;
  const changepointTickAge = lastTriggerIndex !== -1 ? n - 1 - lastTriggerIndex : 999;

  let state: "STABLE" | "CHANGEPOINT_DETECTED" | "TRANSITION" = "STABLE";
  let discountFactor = 1.0;

  if (hasChangepoint) {
    if (changepointTickAge <= 10) {
      state = "CHANGEPOINT_DETECTED";
      discountFactor = 0.35; // heavily discount old history
    } else {
      state = "TRANSITION";
      discountFactor = 0.65;
    }
  } else if (maxCusum >= threshold * 0.75) {
    state = "TRANSITION";
    discountFactor = 0.85;
  }

  const summary = `CUSUM: ${maxCusum.toFixed(1)}/${threshold} (${state}, discount=${discountFactor.toFixed(2)})`;

  return {
    hasChangepoint,
    changepointTickAge,
    cusumScore: maxCusum,
    threshold,
    discountFactor,
    state,
    summary,
  };
}
