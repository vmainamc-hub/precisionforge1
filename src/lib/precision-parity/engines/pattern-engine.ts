// Precision Parity AI — Sequence & Motif Mining Engine.
// Discovers recurring n-grams of parities (length 3, 4, 5) and empirical next-step continuations with Wilson bounds.

import { wilsonScoreInterval } from "./wilson";

export interface PatternMotif {
  ngram: string; // e.g. "EEO", "OEOE"
  length: number;
  occurrences: number;
  followedByEven: number;
  followedByOdd: number;
  pEven: number;
  pOdd: number;
  wilsonEven: { lower: number; upper: number };
  favouredSide: "EVEN" | "ODD" | "NEUTRAL";
  edgePp: number;
}

export interface ParityPatternEngineResult {
  matchedMotifs: PatternMotif[];
  topMotif: PatternMotif | null;
  favouredSide: "EVEN" | "ODD" | "NEUTRAL";
  pointEstimatePWin: number;
  lowerBoundPWin: number;
  sampleSize: number;
  summary: string;
}

export function runParityPatternEngine(digits: number[]): ParityPatternEngineResult {
  const parities = digits.map((d) => (d % 2 === 0 ? "E" : "O"));
  const n = parities.length;
  if (n < 6) {
    return {
      matchedMotifs: [],
      topMotif: null,
      favouredSide: "NEUTRAL",
      pointEstimatePWin: 0.5,
      lowerBoundPWin: 0.5,
      sampleSize: 0,
      summary: "Insufficient ticks for pattern mining",
    };
  }

  // Active suffixes of length 3, 4, 5
  const suffix3 = parities.slice(-3).join("");
  const suffix4 = parities.length >= 4 ? parities.slice(-4).join("") : "";
  const suffix5 = parities.length >= 5 ? parities.slice(-5).join("") : "";

  function mineNgram(target: string, len: number): PatternMotif | null {
    if (!target || target.length !== len) return null;
    let occ = 0;
    let nextE = 0;
    let nextO = 0;

    // Search across history (do not leak the current tick)
    for (let i = 0; i <= n - len - 1; i++) {
      let match = true;
      for (let j = 0; j < len; j++) {
        if (parities[i + j] !== target[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        occ++;
        const next = parities[i + len];
        if (next === "E") nextE++;
        else nextO++;
      }
    }

    if (occ === 0) return null;

    const pEven = nextE / occ;
    const pOdd = nextO / occ;
    const w = wilsonScoreInterval(nextE, occ, 0.95);

    let favouredSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
    let edgePp = 0;
    if (pEven >= 0.54 && occ >= 8) {
      favouredSide = "EVEN";
      edgePp = (pEven - 0.5) * 100;
    } else if (pOdd >= 0.54 && occ >= 8) {
      favouredSide = "ODD";
      edgePp = (pOdd - 0.5) * 100;
    }

    return {
      ngram: target,
      length: len,
      occurrences: occ,
      followedByEven: nextE,
      followedByOdd: nextO,
      pEven,
      pOdd,
      wilsonEven: { lower: w.lower, upper: w.upper },
      favouredSide,
      edgePp,
    };
  }

  const motifs: PatternMotif[] = [];
  const m5 = mineNgram(suffix5, 5);
  const m4 = mineNgram(suffix4, 4);
  const m3 = mineNgram(suffix3, 3);

  if (m5 && m5.occurrences >= 6) motifs.push(m5);
  if (m4 && m4.occurrences >= 10) motifs.push(m4);
  if (m3 && m3.occurrences >= 15) motifs.push(m3);

  // Pick top motif prioritizing statistical edge and sample size
  let topMotif: PatternMotif | null = null;
  if (motifs.length > 0) {
    motifs.sort((a, b) => {
      const edgeA = Math.abs(a.pEven - 0.5) * Math.sqrt(a.occurrences);
      const edgeB = Math.abs(b.pEven - 0.5) * Math.sqrt(b.occurrences);
      return edgeB - edgeA;
    });
    topMotif = motifs[0];
  }

  let favouredSide: "EVEN" | "ODD" | "NEUTRAL" = "NEUTRAL";
  let pointEstimatePWin = 0.5;
  let lowerBoundPWin = 0.5;
  let sampleSize = 0;

  if (topMotif) {
    favouredSide = topMotif.favouredSide;
    sampleSize = topMotif.occurrences;
    if (favouredSide === "EVEN") {
      pointEstimatePWin = topMotif.pEven;
      lowerBoundPWin = topMotif.wilsonEven.lower;
    } else if (favouredSide === "ODD") {
      pointEstimatePWin = topMotif.pOdd;
      lowerBoundPWin = 1 - topMotif.wilsonEven.upper;
    }
  }

  const summary = topMotif
    ? `Motif [${topMotif.ngram}] -> ${favouredSide} ${(pointEstimatePWin * 100).toFixed(1)}% (N=${sampleSize}, Wilson LB ${(lowerBoundPWin * 100).toFixed(1)}%)`
    : "No high-confidence motif matched";

  return {
    matchedMotifs: motifs,
    topMotif,
    favouredSide,
    pointEstimatePWin,
    lowerBoundPWin,
    sampleSize,
    summary,
  };
}
