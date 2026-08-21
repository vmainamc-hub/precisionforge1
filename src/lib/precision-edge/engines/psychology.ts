// PSYCHOLOGY — streak psychology and digit fatigue ahead of the bot's burst.
// Grades whether the current high/low run is EXHAUSTING (bad — the bot would
// buy the end of the move) or FRESH (good).
import type { Engine, EngineContext, EngineScore } from "../types";
import { clamp, shareOf, withVerdict } from "./bot-helpers";

export const psychologyEngine: Engine = {
  name: "psychology",
  evaluate(ctx: EngineContext): EngineScore {
    if (!ctx.config.features.crowdingHeuristic) {
      return {
        name: "psychology",
        score: 50,
        weight: ctx.config.engineWeights.psychology ?? 0,
        features: withVerdict({}, { over: 0, under: 0, veto: 0 }),
        reasons: ["disabled"],
      };
    }
    const d = ctx.features.digits;

    // Current zone run (high vs low), and the longest run in the window.
    let run = 1;
    const lastHigh = (d[d.length - 1] ?? 0) >= 5;
    for (let i = d.length - 2; i >= 0; i--) {
      if (d[i] >= 5 === lastHigh) run++;
      else break;
    }
    let longest = 1;
    let cur = 1;
    for (let i = 1; i < d.length; i++) {
      if (d[i] >= 5 === d[i - 1] >= 5) cur++;
      else {
        longest = Math.max(longest, cur);
        cur = 1;
      }
    }
    longest = Math.max(longest, cur);

    // Alternation health: a random regime flips zone about half the time.
    let flips = 0;
    for (let i = 1; i < d.length; i++) if (d[i] >= 5 !== d[i - 1] >= 5) flips++;
    const alternation = flips / Math.max(1, d.length - 1);
    const alternationCollapse = clamp((0.5 - alternation) * 400) / 100; // 0..1

    // Digit fatigue: how stretched the recent 20 ticks are versus the window.
    const recentHigh = shareOf(d.slice(-20), (x) => x >= 5);
    const baseHigh = shareOf(d, (x) => x >= 5);
    const fatigue = clamp(Math.abs(recentHigh - baseHigh) * 300) / 100; // 0..1

    const exhaustion = clamp((run / 8) * 50 + alternationCollapse * 30 + fatigue * 30) / 100;
    const score = clamp(100 - exhaustion * 100);

    // An exhausted HIGH run threatens a fresh OVER entry, and vice versa.
    const over = lastHigh ? clamp(60 - exhaustion * 60) : clamp(50 + (1 - exhaustion) * 20);
    const under = !lastHigh ? clamp(60 - exhaustion * 60) : clamp(50 + (1 - exhaustion) * 20);

    return {
      name: "psychology",
      score,
      weight: ctx.config.engineWeights.psychology ?? 0,
      features: withVerdict(
        {
          currentRun: run,
          currentRunSide: lastHigh ? "HIGH" : "LOW",
          longestRun: longest,
          alternation,
          alternationCollapse,
          fatigue,
          exhaustion,
          recentHighShare: recentHigh,
          baselineHighShare: baseHigh,
        },
        { over, under, veto: clamp(exhaustion * 100 - 40) },
      ),
      reasons: [
        `Current ${lastHigh ? "HIGH" : "LOW"} run of ${run} (longest ${longest} in window)`,
        `Zone alternation ${(alternation * 100).toFixed(0)}% — ${alternationCollapse > 0.3 ? "collapsing (clustered)" : "healthy"}`,
        `Burst is ${exhaustion > 0.6 ? "EXHAUSTING" : exhaustion > 0.35 ? "maturing" : "FRESH"} (fatigue ${(fatigue * 100).toFixed(0)}%)`,
      ],
    };
  },
};
