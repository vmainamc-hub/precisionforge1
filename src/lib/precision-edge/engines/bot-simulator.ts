// BOT SIMULATOR ENGINE — the centrepiece. Score is measured on the bot itself:
// replay its exact rules over the configured windows and grade the result.
import type { Engine, EngineContext, EngineScore } from "../types";
import { martingaleSurvival } from "../bot/simulator";
import { clamp, neutralScore, withVerdict } from "./bot-helpers";

export const botSimulatorEngine: Engine = {
  name: "botSimulator",
  evaluate(ctx: EngineContext): EngineScore {
    const ev = ctx.bot;
    if (!ev) return neutralScore("botSimulator", ctx, "No bot evidence — simulation unavailable");
    const cfg = ctx.config.bot;
    const sim = ev.canonicalSim;
    if (!sim || sim.trades < 3) {
      return {
        name: "botSimulator",
        score: 40,
        weight: ctx.config.engineWeights.botSimulator ?? 0,
        features: withVerdict({ trades: sim?.trades ?? 0 }, { over: 0, under: 0, veto: 40 }),
        reasons: ["Too few simulated trades to judge the bot yet"],
      };
    }

    // Win rate vs the configured minimum, expectancy, and ladder headroom.
    const winRateScore = clamp(50 + (sim.winRate - cfg.minSimWinRate) * 400);
    const expectancyScore = clamp(50 + sim.expectancy * 250);
    const survival = martingaleSurvival(sim, ev.state.countLoss, cfg.martingaleDepth);
    const streakScore = clamp(100 - sim.longestLossStreak * 12);
    const drawdownScore = clamp(100 - sim.maxDrawdownStakes * 6);

    const score = clamp(
      0.34 * winRateScore +
        0.26 * expectancyScore +
        0.18 * survival.score +
        0.12 * streakScore +
        0.1 * drawdownScore,
    );

    // Directional read: which side actually paid in the replay.
    const overShare = sim.trades ? sim.overTrades / sim.trades : 0.5;
    const over = clamp(40 + overShare * 60 * (sim.winRate * 2));
    const under = clamp(40 + (1 - overShare) * 60 * (sim.winRate * 2));
    const veto = survival.survivable ? clamp((cfg.minSimWinRate - sim.winRate) * 400) : 100;

    return {
      name: "botSimulator",
      score,
      weight: ctx.config.engineWeights.botSimulator ?? 0,
      features: withVerdict(
        {
          window: sim.window,
          trades: sim.trades,
          winRate: sim.winRate,
          expectancy: sim.expectancy,
          pnl: sim.pnl,
          longestLossStreak: sim.longestLossStreak,
          maxDrawdownStakes: sim.maxDrawdownStakes,
          peakStake: sim.peakStake,
          freshWinRate: sim.freshWinRate,
          recoveryWinRate: sim.recoveryWinRate,
          ladderHeadroom: survival.headroom,
          survivable: survival.survivable,
        },
        { over, under, veto },
      ),
      reasons: [
        `Bot replay over ${sim.window} ticks: ${sim.trades} trades, ${(sim.winRate * 100).toFixed(1)}% win rate, expectancy ${sim.expectancy >= 0 ? "+" : ""}${sim.expectancy.toFixed(3)} stakes`,
        `Worst loss streak ${sim.longestLossStreak}, peak stake ${sim.peakStake.toFixed(1)}×, ladder headroom ${survival.headroom}`,
        ...ev.sims
          .filter((s) => s.window !== sim.window)
          .map((s) => `${s.window}t: ${(s.winRate * 100).toFixed(1)}% over ${s.trades} trades`),
      ],
      warnings: survival.survivable
        ? undefined
        : ["Simulated loss streak exceeds your martingale depth"],
    };
  },
};
