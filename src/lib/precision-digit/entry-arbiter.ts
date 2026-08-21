// Phase 10.5 — Precision Digit Entry Arbiter
// Prescribes exact actionable entry conditions, triggers, Kelly stake sizing, and abort protocols.

import type { CandidateLedger, SimulationUniverseReport } from "./digit-simulation-loop";
import type { DigitDistributionReport } from "./transition-tensor";
import type { DigitHazardReport } from "./hazard";
import type { HMMReport } from "../precision-parity/hmm";
import type { DriftReport } from "../precision-parity/drift";
import type { ConformalReport } from "../precision-parity/conformal";

export interface DigitEntryPlan {
  market: string;
  contract: string;
  barrier: number | null;
  entryMode: "IMMEDIATE" | "WAIT_FOR_TRIGGER";
  trigger: {
    kind: "AFTER_DIGIT" | "ABSENCE_PERCENTILE" | "PARITY_RUN" | "NONE";
    digit?: number;
    threshold?: number;
    description: string;
  };
  recommendedRuns: number; // derived from HMM dwell time ∩ particle survival curve
  stakeFraction: number; // quarter-Kelly percentage (e.g. 0.0125 = 1.25%)
  expirySeconds: number;
  expiryTicks: number;
  abortConditions: string[]; // drift MAJOR, weight collapse, barrier flip
  evLow: number;
  conformalInterval: [number, number];
  effectiveVotes: number;
  grade: "A" | "B" | "C" | "D";
  reasoning: string[];
}

export function arbitrateDigitEntry(args: {
  market: string;
  simReport: SimulationUniverseReport;
  tensorReport: DigitDistributionReport;
  hazardReport: DigitHazardReport;
  hmmReport: HMMReport;
  driftReport: DriftReport;
  conformalReport: ConformalReport;
  effectiveVotes: number;
  digits: number[];
}): DigitEntryPlan {
  const top = args.simReport.topCandidate;
  const lastDigit = args.digits.length > 0 ? args.digits[args.digits.length - 1] : 0;

  // Derive trigger logic
  let entryMode: "IMMEDIATE" | "WAIT_FOR_TRIGGER" = "IMMEDIATE";
  let trigger: DigitEntryPlan["trigger"] = {
    kind: "NONE",
    description: "Execute immediately on current market tick state.",
  };

  const reasoning: string[] = [];

  // Check 1: Significant Transition Trigger (e.g. After digit X prints)
  if (args.tensorReport.dominantTransitions.length > 0) {
    const bestTrans = args.tensorReport.dominantTransitions[0];
    if (lastDigit === bestTrans.from) {
      entryMode = "IMMEDIATE";
      trigger = {
        kind: "AFTER_DIGIT",
        digit: bestTrans.from,
        description: `Immediate execution: Trigger digit ${bestTrans.from} just printed (P(next=${bestTrans.to})=${(bestTrans.prob * 100).toFixed(1)}%).`,
      };
      reasoning.push(
        `Trigger condition satisfied: Active tick is digit ${bestTrans.from}, yielding transition edge to ${bestTrans.to}.`,
      );
    } else {
      entryMode = "WAIT_FOR_TRIGGER";
      trigger = {
        kind: "AFTER_DIGIT",
        digit: bestTrans.from,
        description: `Arm bot and execute on the tick immediately following digit ${bestTrans.from} print.`,
      };
      reasoning.push(
        `Tactical trigger armed: Waiting for digit ${bestTrans.from} to print before firing.`,
      );
    }
  } else if (args.hazardReport.mostOverdue.gapPercentile >= 80) {
    // Check 2: Absence percentile trigger
    const overdue = args.hazardReport.mostOverdue;
    entryMode = "WAIT_FOR_TRIGGER";
    trigger = {
      kind: "ABSENCE_PERCENTILE",
      digit: overdue.digit,
      threshold: 80,
      description: `Enter DIFFERS ${overdue.digit} or wait until digit ${overdue.digit} absence percentile reaches ${overdue.gapPercentile}%.`,
    };
    reasoning.push(
      `Hazard anomaly: Digit ${overdue.digit} is in the ${overdue.gapPercentile}th percentile of gap length (${overdue.currentGap} ticks without appearing).`,
    );
  }

  // Derive recommended runs from min(HMM expected dwell, survival threshold)
  const hmmDwell = Math.max(1, Math.min(5, args.hmmReport.expectedDwellTicks));
  const survivalSteps = top.survivalByEntry.filter((p) => p >= 0.5128).length;
  let recommendedRuns = Math.max(1, Math.min(hmmDwell, Math.max(1, survivalSteps)));

  // Conformal uncertainty check: If conformal width > 0.18, cap runs at 1
  if (args.conformalReport.downgraded) {
    recommendedRuns = 1;
    reasoning.push(`Conformal interval wide (> 18%): Recommended runs strictly capped at 1.`);
  }

  // Quarter-Kelly stake calculation
  const payout =
    top.contract === "DIGITEVEN" || top.contract === "DIGITODD"
      ? 0.95
      : top.contract === "DIGITOVER" || top.contract === "DIGITUNDER"
        ? (top.evPoint + 1 - top.simWinRate) / top.simWinRate
        : 0.95;
  const rawKelly = (top.simWinRate * (1 + payout) - 1) / Math.max(0.01, payout);
  const quarterKelly = Math.max(0.005, Math.min(0.03, rawKelly * 0.25));

  // Determine intelligence grade
  let grade: "A" | "B" | "C" | "D" = "C";
  if (top.evLow >= 0.05 && args.effectiveVotes >= 4 && !args.conformalReport.downgraded) {
    grade = "A";
  } else if (top.evLow >= 0.02 && args.effectiveVotes >= 2.5) {
    grade = "B";
  } else if (top.evLow >= 0) {
    grade = "C";
  } else {
    grade = "D";
  }

  const abortConditions: string[] = [
    "Two-sided CUSUM / Page-Hinkley drift escalates to MAJOR",
    "SMC Particle filter ESS falls below 10% (Weight collapse)",
    "Digit transition matrix loses FDR significance (q > 0.05)",
    "Broker payout rate shifts below break-even threshold",
  ];

  reasoning.push(
    `Universe simulation confirmed ${top.contract}${top.barrier !== null ? ` ${top.barrier}` : ""} with +${(top.evLow * 100).toFixed(2)}% EV Low across 5,000 forward paths.`,
  );
  reasoning.push(
    `HMM regime: ${args.hmmReport.currentState} (expected state dwell: ${args.hmmReport.expectedDwellTicks} ticks).`,
  );

  return {
    market: args.market,
    contract: top.contract,
    barrier: top.barrier,
    entryMode,
    trigger,
    recommendedRuns,
    stakeFraction: Math.round(quarterKelly * 10000) / 10000,
    expirySeconds: 90,
    expiryTicks: 15,
    abortConditions,
    evLow: top.evLow,
    conformalInterval: [args.conformalReport.intervalLow, args.conformalReport.intervalHigh],
    effectiveVotes: args.effectiveVotes,
    grade,
    reasoning,
  };
}
