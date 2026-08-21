// Bot-aware narrative: explains the verdict in the trader's own terms —
// equilibrium first, then the bot's own trigger, simulation and risks.
import type { BotSignal } from "./types";
import { BOT_SPEC } from "./spec";

export function botNarrative(s: BotSignal, marketName: string): BotSignal["narrative"] {
  const eq = s.equilibrium;
  const why: string[] = [];
  const risk: string[] = [];

  const headline =
    s.verdict === "BOT_ON"
      ? `Run the bot on ${marketName} — ${s.instructions.contractLabel} conditions are aligned`
      : s.verdict === "BOT_STANDBY"
        ? `${marketName} is close: hold the bot ready, don't start yet`
        : `Do not run the bot on ${marketName} right now`;

  why.push(
    `Over 4 is at ${eq.over4Pct.toFixed(2)}% and Under 5 at ${eq.under5Pct.toFixed(2)}% over ${eq.samples} ticks — deviation ${eq.error.toFixed(2)}pp, band ${eq.band} (equilibrium score ${eq.score.toFixed(0)}/100).`,
  );
  why.push(
    `Balance ${eq.driftSide === "STABLE" ? "is holding still" : `is drifting towards ${eq.driftSide}`} at ${eq.driftVelocity >= 0 ? "+" : ""}${eq.driftVelocity.toFixed(2)}pp per 100 ticks; it has held the ${eq.band} band for ${(eq.timeInBandMs / 1000).toFixed(0)}s.`,
  );
  why.push(
    `Multi-window agreement ${eq.stability.toFixed(0)}%: ${eq.windows.map((w) => `${w.window}t ${w.over4Pct.toFixed(1)}%`).join(" · ")}.`,
  );

  if (s.canonicalSim) {
    const sim = s.canonicalSim;
    why.push(
      `Replaying your bot's exact rules (${BOT_SPEC.ticksAnalyzed}-tick window, ${BOT_SPEC.highPctThreshold}% trigger, ${BOT_SPEC.martingaleFactor}× martingale) over the last ${sim.window} ticks: ${sim.trades} trades, ${(sim.winRate * 100).toFixed(1)}% win rate, expectancy ${sim.expectancy >= 0 ? "+" : ""}${sim.expectancy.toFixed(3)} stakes/trade, worst loss streak ${sim.longestLossStreak}.`,
    );
  }

  why.push(
    s.burst.ticksToFire === 0
      ? `The bot's trigger is live now on ${s.burst.side} (${s.burst.currentHighPct.toFixed(0)}% high digits in the last ${BOT_SPEC.ticksAnalyzed}).`
      : `No trigger yet; the burst forecaster puts a ${s.burst.side} fire ${s.burst.ticksToFire} tick(s) away at ${(s.burst.probability * 100).toFixed(0)}% probability.`,
  );

  why.push(
    `Bot leg: ${s.leg.toUpperCase()} (CountLoss ${s.state.countLoss}) → barrier ${s.barrier ?? "—"} at ${s.state.stakeMultiple.toFixed(2)}× base stake.`,
  );

  const barrierLine = Object.entries(s.barrierEmpirical)
    .map(([b, p]) => `${b}: ${(p * 100).toFixed(1)}%`)
    .join(" · ");
  why.push(`Live barrier win rates — ${barrierLine}.`);

  for (const v of s.vetoes) {
    risk.push(`${v.severity === "BLOCK" ? "BLOCK" : "WARN"} — ${v.title}: ${v.detail}`);
  }
  if (s.calibration < 0.4) {
    risk.push(
      `Confidence is only ${(s.calibration * 100).toFixed(0)}% calibrated — log outcomes to make it trustworthy.`,
    );
  }
  if (!risk.length)
    risk.push("No vetoes armed. Equilibrium, simulation and ladder headroom all clear.");

  return { headline, why, risk, action: s.instructions.action };
}
