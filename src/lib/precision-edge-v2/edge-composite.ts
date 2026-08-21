// Edge Composite — Edge is not a single number, it's structural advantage.
// Splits into 7 independent sub-edges; multiple must agree for strength.

import type { DigitStatistics, MarketPsychology } from "./types";
import type { MarketMemory } from "./memory";
import { historicalAgreement } from "./memory";

export interface EdgePart {
  name: string;
  value: number; // -1..1 signed advantage
  pass: boolean; // meets minimum
  detail: string;
}

export interface EdgeComposite {
  parts: EdgePart[];
  strong: boolean;
  passing: number;
  score: number; // 0..100
}

const MIN = 0.05;

export function computeEdge(opts: {
  empWinRate: number;
  theoretical: number;
  recentWinRate: number;
  persistenceTicks: number;
  psy: MarketPsychology;
  mem: MarketMemory;
  stats: DigitStatistics;
  fluctuation: number;
  minSubEdges: number;
}): EdgeComposite {
  const {
    empWinRate,
    theoretical,
    recentWinRate,
    persistenceTicks,
    psy,
    mem,
    fluctuation,
    minSubEdges,
  } = opts;

  const statistical = empWinRate - theoretical;
  const psychological = (100 - psy.manipulation - psy.crowding * 0.4) / 100 - 0.5;
  const timing = recentWinRate - empWinRate;
  const recovery = Math.min(1, persistenceTicks / 5) - 0.4;
  const stability = 1 - fluctuation - 0.35;
  const historical = historicalAgreement(mem) - 0.55;
  const execution = psy.health / 100 - 0.6;

  const parts: EdgePart[] = [
    {
      name: "Statistical",
      value: statistical,
      pass: statistical >= MIN * 0.3,
      detail: `+${(statistical * 100).toFixed(1)} pts over fair`,
    },
    {
      name: "Psychological",
      value: psychological,
      pass: psychological >= 0,
      detail: `manipulation ${psy.manipulation.toFixed(0)} · crowding ${psy.crowding.toFixed(0)}`,
    },
    {
      name: "Timing",
      value: timing,
      pass: timing >= -0.005,
      detail: `recent flow ${(timing * 100).toFixed(1)} pts`,
    },
    {
      name: "Recovery",
      value: recovery,
      pass: recovery >= 0,
      detail: `${persistenceTicks} winning ticks`,
    },
    {
      name: "Stability",
      value: stability,
      pass: stability >= 0,
      detail: `fluctuation ${(fluctuation * 100).toFixed(0)}%`,
    },
    {
      name: "Historical",
      value: historical,
      pass: historical >= 0,
      detail: `100/1000-tick agreement ${((historical + 0.55) * 100).toFixed(0)}%`,
    },
    {
      name: "Execution",
      value: execution,
      pass: execution >= 0,
      detail: `health ${psy.health.toFixed(0)}`,
    },
  ];

  const passing = parts.filter((p) => p.pass).length;
  const strong = passing >= minSubEdges;
  const score = Math.max(0, Math.min(100, 50 + parts.reduce((a, p) => a + p.value, 0) * 60));
  return { parts, strong, passing, score };
}
