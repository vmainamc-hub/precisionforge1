// §51 Cross-Market Ranking Engine.
//
// Pure ranking function lifted out of the scan hooks. Consumes a bag of
// per-market reasoning outputs, applies a quality-weighted composite score,
// and returns the top-N accepted list plus an explicit rejected list with
// numeric deltas so the UI can explain WHY market X ranked above market Y.

import type { MarketReasoning } from "./types";

export interface RankedMarket {
  market: string;
  name: string;
  score: number;
  qualityMultiplier: number;
  confidence: number;
  edge: number;
  consistency: number;
  reasoning: MarketReasoning;
}

export interface RejectedMarket extends RankedMarket {
  vs: string;
  deltaScore: number;
  reason: string;
}

export interface CrossMarketRanking {
  accepted: RankedMarket[];
  rejected: RejectedMarket[];
  topN: number;
}

const QUALITY_MULT: Record<string, number> = {
  PREMIUM: 1.15,
  STANDARD: 1.0,
  DEVELOPING: 0.75,
  NONE: 0.55,
};

/** Composite quality-weighted score for a single market. */
export function scoreMarket(r: MarketReasoning): {
  score: number;
  qualityMultiplier: number;
} {
  const headline = r.best ?? r.headline;
  const q = headline?.quality?.tier ?? "NONE";
  const mult = QUALITY_MULT[q] ?? 0.55;
  const conf = headline?.confidence ?? 0;
  const consistency = headline?.consistency ?? 0;
  const edge = Math.max(0, headline?.edge ?? 0) * 100;
  const health = r.psychology?.health ?? 0;
  // Weighted composite. 55% confidence, 20% consistency, 15% edge, 10% health.
  const raw = 0.55 * conf + 0.2 * consistency + 0.15 * edge + 0.1 * health;
  return { score: raw * mult, qualityMultiplier: mult };
}

export function rankMarkets(markets: MarketReasoning[], topN = 3): CrossMarketRanking {
  const scored: RankedMarket[] = markets.map((r) => {
    const { score, qualityMultiplier } = scoreMarket(r);
    const headline = r.best ?? r.headline;
    return {
      market: r.market,
      name: r.name,
      score,
      qualityMultiplier,
      confidence: headline?.confidence ?? 0,
      edge: headline?.edge ?? 0,
      consistency: headline?.consistency ?? 0,
      reasoning: r,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const accepted = scored.slice(0, topN);
  const winner = accepted[0];
  const rejected: RejectedMarket[] = scored.slice(topN).map((m) => ({
    ...m,
    vs: winner?.market ?? "",
    deltaScore: (winner?.score ?? 0) - m.score,
    reason: winner
      ? `${winner.market} beats ${m.market} by ${(winner.score - m.score).toFixed(1)} (quality ×${winner.qualityMultiplier.toFixed(2)} vs ×${m.qualityMultiplier.toFixed(2)}).`
      : "no winner",
  }));
  return { accepted, rejected, topN };
}
