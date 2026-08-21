// Phase 10.6 — Cross-Market Ranking & Portfolio Exposure Engine
// Evaluates active markets, sorts top opportunities by EV-Low, and filters correlated risk exposure.

import type { DigitEntryPlan } from "./entry-arbiter";

export interface RankedMarketOpportunity {
  rank: number;
  plan: DigitEntryPlan;
  marketName: string;
  correlationCluster: string;
  isExposureBlocked: boolean;
}

export interface CrossMarketRankingReport {
  topOpportunity: RankedMarketOpportunity | null;
  rankedOpportunities: RankedMarketOpportunity[];
  activeMarketsCount: number;
  narrative: string;
}

// Market family mapping to prevent stacking correlated risk
const MARKET_CORRELATION_FAMILIES: Record<string, string> = {
  R_10: "VOLATILITY_LOW",
  R_25: "VOLATILITY_LOW",
  "1HZ10V": "VOLATILITY_LOW_1S",
  "1HZ25V": "VOLATILITY_LOW_1S",
  R_50: "VOLATILITY_MED",
  R_75: "VOLATILITY_MED",
  "1HZ50V": "VOLATILITY_MED_1S",
  "1HZ75V": "VOLATILITY_MED_1S",
  R_100: "VOLATILITY_HIGH",
  "1HZ100V": "VOLATILITY_HIGH_1S",
};

export function rankCrossMarketOpportunities(
  plans: DigitEntryPlan[],
  marketNames: Record<string, string> = {},
): CrossMarketRankingReport {
  if (plans.length === 0) {
    return {
      topOpportunity: null,
      rankedOpportunities: [],
      activeMarketsCount: 0,
      narrative: "No active market digit plans provided.",
    };
  }

  // Sort descending by EV Low
  const sorted = [...plans].sort((a, b) => b.evLow - a.evLow);

  const ranked: RankedMarketOpportunity[] = [];
  const selectedClusters = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const plan = sorted[i];
    const cluster = MARKET_CORRELATION_FAMILIES[plan.market] || `MARKET_${plan.market}`;
    const isExposureBlocked = selectedClusters.has(cluster);

    if (!isExposureBlocked) {
      selectedClusters.add(cluster);
    }

    ranked.push({
      rank: i + 1,
      plan,
      marketName: marketNames[plan.market] || plan.market,
      correlationCluster: cluster,
      isExposureBlocked,
    });
  }

  const eligible = ranked.filter((r) => !r.isExposureBlocked);
  const topOpportunity = eligible.length > 0 ? eligible[0] : ranked[0];

  const narrative = topOpportunity
    ? `Cross-market sweep screened ${plans.length} markets. Prime asset: ${topOpportunity.marketName} (${topOpportunity.plan.contract}${topOpportunity.plan.barrier !== null ? ` ${topOpportunity.plan.barrier}` : ""}, EV Low +${(topOpportunity.plan.evLow * 100).toFixed(2)}%). Correlation exposure guard filtered ${ranked.filter((r) => r.isExposureBlocked).length} co-linear setups.`
    : "No tradeable opportunities found across active markets.";

  return {
    topOpportunity,
    rankedOpportunities: ranked.slice(0, 10),
    activeMarketsCount: plans.length,
    narrative,
  };
}
