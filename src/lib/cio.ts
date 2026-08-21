// §60 Chief Investment Office (CIO).
//
// Consumes both Precision Edge and Precision Parity outputs, arbitrates
// between them, and surfaces one "house pick" per market. Never publishes two
// contradictory signals on the same market at the same time.
//
// Pure function suite. UI mounts a slim strip behind the `cio` feature flag.

import type { MarketReasoning, ContractVerdict } from "./precision-edge-v2/types";

export interface CIOParityInput {
  market: string;
  side: "EVEN" | "ODD";
  pWin: number; // 0..1
  quality: "premium" | "standard" | "developing" | "unknown";
  confidence: number; // 0..100
  narrative?: string;
}

export interface CIOEdgeInput {
  market: string;
  verdict: ContractVerdict;
  reasoning: MarketReasoning;
}

export type HouseSource = "edge" | "parity" | "abstain";

export interface HousePick {
  source: HouseSource;
  market: string;
  label: string;
  confidence: number;
  reason: string;
  conflict: boolean;
  /** Alternate source's competing pick, if any. */
  runnerUp: { source: HouseSource; label: string; confidence: number } | null;
}

/** Do the two picks on the same market contradict? */
function contradicts(edge: CIOEdgeInput, parity: CIOParityInput): boolean {
  // OVER + EVEN and UNDER + ODD share direction on high/low digits; treat
  // OVER x ODD and UNDER x EVEN as *aligned*. Only conflict when the digit
  // side vs parity side clearly disagree on the majority of qualifying digits.
  const v = edge.verdict;
  if (!v) return false;
  // Convert edge side to a "prefer high digits?" boolean.
  const preferHigh = v.side === "OVER";
  const parityWinnerHigh = parity.side === "ODD" ? true : false; // odd digits: 1,3,5,7,9 spans both zones
  // Simplistic contradiction rule: edge says READY OVER but parity strongly
  // favours EVEN (which biases 0,2,4,6,8) — they can co-exist unless parity
  // confidence is very high AND the edge barrier lies within the winning-set
  // conflict region.  Use quality as a proxy for "very high".
  if (v.state !== "READY") return false;
  if (parity.confidence < 65) return false;
  // If both point at high digits or both at low digits: aligned.
  return preferHigh !== parityWinnerHigh;
}

/**
 * Produce a single house pick per market.
 * `edges` and `parities` keyed by market.
 */
export function arbitrateHousePicks(
  edges: CIOEdgeInput[],
  parities: CIOParityInput[],
): HousePick[] {
  const byMarket = new Map<string, { edge?: CIOEdgeInput; parity?: CIOParityInput }>();
  for (const e of edges) {
    const entry = byMarket.get(e.market) ?? {};
    entry.edge = e;
    byMarket.set(e.market, entry);
  }
  for (const p of parities) {
    const entry = byMarket.get(p.market) ?? {};
    entry.parity = p;
    byMarket.set(p.market, entry);
  }

  const picks: HousePick[] = [];
  for (const [market, { edge, parity }] of byMarket) {
    if (!edge && !parity) continue;
    if (edge && !parity) {
      picks.push(fromEdge(market, edge, null));
      continue;
    }
    if (parity && !edge) {
      picks.push(fromParity(market, parity, null));
      continue;
    }
    // both exist
    const e = edge!;
    const p = parity!;
    const conflict = contradicts(e, p);
    const edgeStrength =
      e.verdict.state === "READY" ? e.verdict.confidence : e.verdict.confidence * 0.6;
    const parityStrength =
      p.confidence * (p.quality === "premium" ? 1.05 : p.quality === "developing" ? 0.85 : 1);
    if (conflict) {
      // Never publish contradictory signals; keep the stronger one only.
      if (Math.abs(edgeStrength - parityStrength) < 4) {
        picks.push({
          source: "abstain",
          market,
          label: "Abstain",
          confidence: 0,
          reason: `CIO abstains — Edge and Parity contradict (${edgeStrength.toFixed(0)} vs ${parityStrength.toFixed(0)}).`,
          conflict: true,
          runnerUp: null,
        });
      } else if (edgeStrength > parityStrength) {
        picks.push(
          fromEdge(market, e, {
            source: "parity",
            label: `${p.side} ${(p.pWin * 100).toFixed(0)}%`,
            confidence: p.confidence,
          }),
        );
      } else {
        picks.push(
          fromParity(market, p, {
            source: "edge",
            label: e.verdict.label,
            confidence: e.verdict.confidence,
          }),
        );
      }
      continue;
    }
    // Aligned — pick the stronger, keep the other as runner-up.
    if (edgeStrength >= parityStrength) {
      picks.push(
        fromEdge(market, e, {
          source: "parity",
          label: `${p.side} ${(p.pWin * 100).toFixed(0)}%`,
          confidence: p.confidence,
        }),
      );
    } else {
      picks.push(
        fromParity(market, p, {
          source: "edge",
          label: e.verdict.label,
          confidence: e.verdict.confidence,
        }),
      );
    }
  }
  // Sort by confidence desc.
  picks.sort((a, b) => b.confidence - a.confidence);
  return picks;
}

function fromEdge(market: string, e: CIOEdgeInput, runnerUp: HousePick["runnerUp"]): HousePick {
  return {
    source: "edge",
    market,
    label: e.verdict.label,
    confidence: e.verdict.confidence,
    reason: `Precision Edge — ${e.verdict.state} @ ${e.verdict.confidence.toFixed(0)}%`,
    conflict: false,
    runnerUp,
  };
}
function fromParity(market: string, p: CIOParityInput, runnerUp: HousePick["runnerUp"]): HousePick {
  return {
    source: "parity",
    market,
    label: `${p.side} ${(p.pWin * 100).toFixed(0)}%`,
    confidence: p.confidence,
    reason: `Precision Parity — ${p.quality} @ ${p.confidence.toFixed(0)}%${p.narrative ? ` — ${p.narrative}` : ""}`,
    conflict: false,
    runnerUp,
  };
}

/** Single top house pick or null. */
export function houseTopPick(picks: HousePick[]): HousePick | null {
  return picks.find((p) => p.source !== "abstain") ?? picks[0] ?? null;
}
