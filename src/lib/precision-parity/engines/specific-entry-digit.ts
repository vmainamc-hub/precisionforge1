// Precision Parity AI — Specific Entry Digit Engine (Derived from Sentinel's conditional matrix).
// Determines the exact causal trigger digit (0..9) to wait for before running EVEN or ODD.
//
// For example:
// "Market 10 (1s), Contract Type ODD, Entry: Wait for digit 3 to appear then run ODD."

export interface ParityEntryDigitScore {
  digit: number;
  /** 0..100 composite entry score */
  score: number;
  /** P(target parity wins on the next tick | this digit is observed now) */
  pWin: number;
  /** Wilson 95% lower bound of pWin */
  pWinLower: number;
  /** Occurrences of this digit in history with a following tick */
  n: number;
  /** pWin - 0.50 theoretical expectation in percentage points */
  edgePp: number;
  /** Stability between older and newer half of observations (0..100) */
  stability: number;
  /** Mean gap in ticks between appearances of this digit */
  expectedWaitTicks: number;
  /** How many ticks since this digit was last observed */
  sinceSeen: number;
  /** Detailed reason why this digit is the optimal entry trigger */
  rationale: string;
}

export interface ParitySpecificEntryDecision {
  targetContract: "DIGITEVEN" | "DIGITODD";
  contractLabel: "DIGIT EVEN" | "DIGIT ODD";
  symbol: string;
  marketName: string;
  /** The specific trigger digit (0..9) to wait for */
  entryDigit: number;
  /** Top entry digit score object */
  preferred: ParityEntryDigitScore;
  /** Runner up entry digit */
  runnerUp: ParityEntryDigitScore | null;
  /** All 10 digit scores (0..9) */
  allScores: ParityEntryDigitScore[];
  /** Canonical single-sentence instruction: e.g. "Wait for digit 3 to appear, then run DIGIT ODD (1 tick)." */
  instructionHeadline: string;
  /** Full structured narrative */
  instructionDetail: string;
  /** Status: READY to execute when digit prints */
  status: "ARMED" | "ENTER_NOW" | "WAITING_FOR_DIGIT";
  /** Confidence 0..100 in this specific trigger digit */
  confidence: number;
  /** Expected wait time in ticks for this digit to print */
  expectedWaitTicks: number;
}

function wilsonLowerBound(wins: number, total: number, z = 1.96): number {
  if (total <= 0) return 0;
  const p = wins / total;
  const denominator = 1 + (z * z) / total;
  const centerAdjusted = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return Math.max(0, (centerAdjusted - margin) / denominator);
}

/** 10x10 Transition Matrix: row = current digit, col = next digit */
function buildDigitTransitionMatrix(digits: number[]): number[][] {
  const matrix: number[][] = Array.from({ length: 10 }, () => new Array<number>(10).fill(0));
  for (let i = 0; i + 1 < digits.length; i++) {
    const a = digits[i];
    const b = digits[i + 1];
    if (typeof a === "number" && typeof b === "number" && a >= 0 && a <= 9 && b >= 0 && b <= 9) {
      matrix[a][b] += 1;
    }
  }
  return matrix;
}

export function computeSpecificParityEntryDigit(
  digits: number[],
  targetContract: "DIGITEVEN" | "DIGITODD",
  symbol: string,
  marketName: string,
): ParitySpecificEntryDecision {
  const isEven = targetContract === "DIGITEVEN";
  const contractLabel = isEven ? "DIGIT EVEN" : "DIGIT ODD";
  const winningParity = isEven ? 0 : 1; // 0 for even digits (0,2,4,6,8), 1 for odd digits (1,3,5,7,9)

  // Ensure digits array is valid integers 0-9
  const cleanDigits = digits.map((d) =>
    typeof d === "number" && Number.isFinite(d) ? Math.abs(Math.floor(d)) % 10 : 0,
  );
  const n = cleanDigits.length;
  const half = Math.floor(n / 2);

  const fullMatrix = buildDigitTransitionMatrix(cleanDigits);
  const olderMatrix = buildDigitTransitionMatrix(cleanDigits.slice(0, half));
  const newerMatrix = buildDigitTransitionMatrix(cleanDigits.slice(half));

  const lastDigit = n > 0 ? cleanDigits[n - 1] : 0;

  const scores: ParityEntryDigitScore[] = [];

  for (let d = 0; d < 10; d++) {
    // Count how many times digit d was followed by a winning parity digit
    let totalOccurrences = 0;
    let winningTransitions = 0;

    for (let nextD = 0; nextD < 10; nextD++) {
      const count = fullMatrix[d][nextD];
      totalOccurrences += count;
      if (nextD % 2 === winningParity) {
        winningTransitions += count;
      }
    }

    // Bayesian Dirichlet/Laplace smoothing prior to avoid 0/0 or extreme sample distortion
    const priorWins = 2.5;
    const priorTotal = 5.0;
    const smoothedPWin = (winningTransitions + priorWins) / (totalOccurrences + priorTotal);
    const pWin = totalOccurrences > 0 ? winningTransitions / totalOccurrences : 0.5;
    const pWinLower = wilsonLowerBound(winningTransitions, totalOccurrences);
    const edgePp = (smoothedPWin - 0.5) * 100;

    // Older vs Newer stability check
    let olderWins = 0;
    let olderTotal = 0;
    let newerWins = 0;
    let newerTotal = 0;

    for (let nextD = 0; nextD < 10; nextD++) {
      if (nextD % 2 === winningParity) {
        olderWins += olderMatrix[d][nextD];
        newerWins += newerMatrix[d][nextD];
      }
      olderTotal += olderMatrix[d][nextD];
      newerTotal += newerMatrix[d][nextD];
    }

    let stability = 50;
    if (olderTotal >= 3 && newerTotal >= 3) {
      const pOlder = olderWins / olderTotal;
      const pNewer = newerWins / newerTotal;
      const drift = Math.abs(pOlder - pNewer);
      stability = Math.max(0, Math.min(100, Math.round(100 - drift * 250)));
    }

    // Mean gap calculation
    let lastSeenIndex = -1;
    let gapSum = 0;
    let gapCount = 0;
    for (let i = 0; i < n; i++) {
      if (cleanDigits[i] === d) {
        if (lastSeenIndex >= 0) {
          gapSum += i - lastSeenIndex;
          gapCount += 1;
        }
        lastSeenIndex = i;
      }
    }
    const expectedWaitTicks = gapCount > 0 ? Math.round((gapSum / gapCount) * 10) / 10 : 10;
    const sinceSeen = lastSeenIndex >= 0 ? n - 1 - lastSeenIndex : n;

    // Weight authority by sample size
    const sampleAuthority =
      totalOccurrences >= 50
        ? 1.0
        : totalOccurrences >= 25
          ? 0.85
          : totalOccurrences >= 10
            ? 0.65
            : totalOccurrences >= 5
              ? 0.4
              : 0.2;

    // Recent 30-tick micro momentum bonus for this digit
    const recent30 = cleanDigits.slice(-30);
    let recentOccurrences = 0;
    let recentWins = 0;
    for (let i = 0; i + 1 < recent30.length; i++) {
      if (recent30[i] === d) {
        recentOccurrences++;
        if (recent30[i + 1] % 2 === winningParity) recentWins++;
      }
    }
    const recentEdge = recentOccurrences > 0 ? (recentWins / recentOccurrences - 0.5) * 10 : 0;

    // Composite score (0..100)
    // Edge (45%), Wilson Lower (30%), Stability (15%), Recency / Waitability (10%)
    const rawScore =
      50 +
      edgePp * 2.2 * sampleAuthority +
      (pWinLower - 0.5) * 55 +
      (stability - 50) * 0.2 +
      recentEdge -
      (expectedWaitTicks > 18 ? 4 : 0);

    const score = Math.max(1, Math.min(99, Math.round(rawScore)));

    const rationale = `Whenever digit ${d} prints, the following tick lands on ${isEven ? "EVEN" : "ODD"} ${(smoothedPWin * 100).toFixed(1)}% of the time (empirical: ${(pWin * 100).toFixed(1)}%, 95% lower bound: ${(pWinLower * 100).toFixed(1)}%, sample N=${totalOccurrences}, stability ${stability}/100).`;

    scores.push({
      digit: d,
      score,
      pWin: smoothedPWin,
      pWinLower,
      n: totalOccurrences,
      edgePp,
      stability,
      expectedWaitTicks,
      sinceSeen,
      rationale,
    });
  }

  // Sort descending by score; if tied, sort by edge and recent appearances
  scores.sort((a, b) => b.score - a.score || b.edgePp - a.edgePp || a.sinceSeen - b.sinceSeen);

  const preferred = scores[0];
  const runnerUp = scores.length > 1 ? scores[1] : null;

  const isCurrentDigit = lastDigit === preferred.digit;
  const status = isCurrentDigit ? "ENTER_NOW" : "WAITING_FOR_DIGIT";

  // Strict Sentinel format: "Market 10 (1s), contract type ODD, entry: wait for digit 3 to appear then run ODD."
  const instructionHeadline = `Wait for digit ${preferred.digit} to appear, then run ${contractLabel}.`;
  const instructionDetail = isCurrentDigit
    ? `Digit ${preferred.digit} just appeared on the latest tick! Execute ${contractLabel} immediately (1 tick).`
    : `Monitor live stream. As soon as digit ${preferred.digit} appears as the last digit, enter ${contractLabel} for 1 tick duration.`;

  return {
    targetContract,
    contractLabel,
    symbol,
    marketName,
    entryDigit: preferred.digit,
    preferred,
    runnerUp,
    allScores: scores,
    instructionHeadline,
    instructionDetail,
    status,
    confidence: preferred.score,
    expectedWaitTicks: preferred.expectedWaitTicks,
  };
}
