// RECOVERY — MARTINGALE SURVIVAL ENGINE.
// Given CountLoss = 0..N at the bot's 1.5 factor, simulate the recovery ladder
// against the current regime: can Over 3 / Under 6 realistically recover from
// here? Publishes max survivable loss streak and a recovery-safety score.
import type {
  CandidateContract,
  Engine,
  EngineContext,
  EngineScore,
  RecoveryPlan,
  Tick,
} from "../types";
import { contractWinProb } from "../probability";
import { digit } from "../rolling-store";
import { BOT_SPEC, barrierFor } from "../bot/spec";
import { martingaleSurvival } from "../bot/simulator";
import { clamp, shareOf, withVerdict } from "./bot-helpers";

// The bot's own fresh → recovery relationships. This is the ONLY recovery map:
// fresh OVER 2 recovers on OVER 3, fresh UNDER 7 recovers on UNDER 6.
const RECOVERY_MAP: Array<{ primary: CandidateContract; recovery: CandidateContract }> = [
  {
    primary: { type: "OVER", barrier: 2, label: "Over 2" },
    recovery: { type: "OVER", barrier: 3, label: "Over 3" },
  },
  {
    primary: { type: "UNDER", barrier: 7, label: "Under 7" },
    recovery: { type: "UNDER", barrier: 6, label: "Under 6" },
  },
];

export function findRecovery(primary: CandidateContract, ticks: Tick[]): RecoveryPlan | null {
  const match = RECOVERY_MAP.find(
    (r) => r.primary.type === primary.type && r.primary.barrier === primary.barrier,
  );
  if (!match) return null;
  const pProb = contractWinProb(ticks, match.primary);
  const rProb = contractWinProb(ticks, match.recovery);
  const theory = BOT_SPEC.theory[match.recovery.barrier as 3 | 6];
  // Compatibility: how well the recovery contract holds its theoretical rate.
  const compatibility = clamp(100 - Math.abs(rProb - theory) * 600);
  const quality = clamp(50 + (rProb - theory) * 500);
  return {
    primary: match.primary,
    recovery: match.recovery,
    compatibility,
    probability: rProb,
    quality: clamp(quality * 0.6 + pProb * 40),
  };
}

export const recoveryEngine: Engine = {
  name: "recovery",
  evaluate(ctx: EngineContext): EngineScore {
    if (!ctx.config.features.recoveryCompatibility) {
      return {
        name: "recovery",
        score: 50,
        weight: ctx.config.engineWeights.recovery ?? 0,
        features: withVerdict({}, { over: 0, under: 0, veto: 0 }),
        reasons: ["disabled"],
      };
    }
    const cfg = ctx.config.bot;
    const ticks = ctx.windows[cfg.canonicalWindow] ?? ctx.windows[500] ?? ctx.features.ticks;
    const digits = ticks.map((t) => digit(t.price));
    const countLoss = ctx.bot?.state.countLoss ?? 0;

    // Empirical recovery-leg win rates (Over 3 / Under 6).
    const pOver3 = shareOf(digits, (d) => d > 3);
    const pUnder6 = shareOf(digits, (d) => d < 6);

    // Ladder maths: from CountLoss, how many further losses can the trader fund,
    // and what is the probability of surviving that many at the measured rate?
    const remaining = Math.max(0, cfg.martingaleDepth - countLoss);
    const worstLeg = Math.min(pOver3, pUnder6);
    const ruinProb = Math.pow(1 - worstLeg, Math.max(1, remaining));
    const maxSurvivableStreak = remaining;
    const requiredStake = Math.pow(BOT_SPEC.martingaleFactor, countLoss + remaining);

    const sim = ctx.bot?.canonicalSim ?? null;
    const survival = sim ? martingaleSurvival(sim, countLoss, cfg.martingaleDepth) : null;

    const ladderScore = clamp(100 - ruinProb * 100 * 3);
    const legScore = clamp(50 + (worstLeg - BOT_SPEC.theory[3]) * 600);
    const simScore = survival ? survival.score : 50;
    const score = clamp(0.4 * ladderScore + 0.3 * legScore + 0.3 * simScore);

    const over = clamp(50 + (pOver3 - BOT_SPEC.theory[3]) * 600);
    const under = clamp(50 + (pUnder6 - BOT_SPEC.theory[6]) * 600);
    const veto = survival && !survival.survivable ? 100 : clamp(ruinProb * 300);

    const legBarrier = barrierFor(
      over >= under ? "OVER" : "UNDER",
      countLoss === 0 ? "fresh" : "recovery",
    );

    return {
      name: "recovery",
      score,
      weight: ctx.config.engineWeights.recovery ?? 0,
      features: withVerdict(
        {
          countLoss,
          leg: countLoss === 0 ? "fresh" : "recovery",
          nextBarrier: legBarrier,
          over3WinRate: pOver3,
          under6WinRate: pUnder6,
          maxSurvivableStreak,
          ruinProbability: ruinProb,
          requiredStake,
          stakeMultiple: Math.pow(BOT_SPEC.martingaleFactor, countLoss),
          simulatedLongestLossStreak: sim?.longestLossStreak ?? 0,
          ladderHeadroom: survival?.headroom ?? 0,
          survivable: survival ? survival.survivable : true,
          compatibility: legScore,
        },
        { over, under, veto },
      ),
      reasons: [
        `CountLoss ${countLoss} → ${countLoss === 0 ? "fresh (Over 2 / Under 7)" : "recovery (Over 3 / Under 6)"} at ${Math.pow(BOT_SPEC.martingaleFactor, countLoss).toFixed(2)}× stake`,
        `Recovery legs measured: Over 3 ${(pOver3 * 100).toFixed(1)}% · Under 6 ${(pUnder6 * 100).toFixed(1)}% (theory 60%)`,
        `Ladder depth ${cfg.martingaleDepth}: ${maxSurvivableStreak} further losses funded, ruin risk ${(ruinProb * 100).toFixed(2)}%, worst-case stake ${requiredStake.toFixed(1)}×`,
        ...(sim
          ? [`Simulated worst streak ${sim.longestLossStreak}, headroom ${survival?.headroom ?? 0}`]
          : []),
      ],
      warnings:
        survival && !survival.survivable
          ? ["Martingale ladder cannot survive the measured loss streak"]
          : undefined,
    };
  },
};
