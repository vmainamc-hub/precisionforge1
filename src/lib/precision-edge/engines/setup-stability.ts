import type { Engine, EngineContext, EngineScore, SetupState } from "../types";
import { clamp, withVerdict } from "./bot-helpers";

interface SetupTracker {
  since: number;
  lastScore: number;
  history: number[];
  state: SetupState;
}

const trackers = new Map<string, SetupTracker>();

export function resetSetupTrackers() {
  trackers.clear();
}

export function trackerSnapshot(key: string) {
  const t = trackers.get(key);
  if (!t) return null;
  return { ...t, history: [...t.history] };
}

export function updateSetupState(
  key: string,
  edgeScore: number,
  now: number,
  persistenceMs: number,
  threshold: number,
): { state: SetupState; ageMs: number; trend: "up" | "down" | "flat" } {
  let t = trackers.get(key);
  if (!t) {
    t = { since: now, lastScore: edgeScore, history: [edgeScore], state: "emerging" };
    trackers.set(key, t);
  } else {
    t.history.push(edgeScore);
    if (t.history.length > 60) t.history.shift();
  }
  const ageMs = now - t.since;
  const rising = t.history.length >= 3 && edgeScore > t.history[t.history.length - 3];
  const falling = t.history.length >= 3 && edgeScore < t.history[t.history.length - 3];

  let state: SetupState;
  if (edgeScore < threshold * 0.6) state = "expired";
  else if (edgeScore < threshold * 0.85) state = "weakening";
  else if (edgeScore >= threshold && ageMs >= persistenceMs)
    state = rising ? "strengthening" : "confirmed";
  else if (edgeScore >= threshold * 0.9) state = "building";
  else state = "emerging";

  if (state === "expired") {
    trackers.delete(key);
  } else {
    t.state = state;
    t.lastScore = edgeScore;
  }
  return { state, ageMs, trend: rising ? "up" : falling ? "down" : "flat" };
}

export const setupStabilityEngine: Engine = {
  name: "setupStability",
  evaluate(ctx: EngineContext): EngineScore {
    // Persistence of a BOT-ARMED state: how long this market has been holding a
    // bot-ready condition, so a signal is never a one-tick flicker.
    const t = trackers.get(ctx.market);
    if (!t || t.history.length < 3) {
      return {
        name: "setupStability",
        score: 50,
        weight: ctx.config.engineWeights.setupStability ?? 0,
        features: withVerdict(
          { age: 0, samples: t?.history.length ?? 0 },
          { over: 0, under: 0, veto: 30 },
        ),
        reasons: ["Bot-ready state just emerged — not yet persistent"],
      };
    }
    const mean = t.history.reduce((a, b) => a + b, 0) / t.history.length;
    const variance = t.history.reduce((a, b) => a + (b - mean) ** 2, 0) / t.history.length;
    const stability = 1 / (1 + Math.sqrt(variance) / 20);
    const persistence = Math.min(1, (Date.now() - t.since) / (ctx.config.persistenceMs * 2));
    // Equilibrium residency counts too: a bot-armed state is only real while the
    // market has been sitting inside its band.
    const eq = ctx.bot?.equilibrium ?? null;
    const bandResidency = eq
      ? Math.min(1, eq.timeInBandMs / Math.max(1, ctx.config.persistenceMs * 2))
      : 0.5;
    const score = clamp(45 * stability + 30 * persistence + 25 * bandResidency);
    const armed = t.state === "confirmed" || t.state === "strengthening";
    return {
      name: "setupStability",
      score,
      weight: ctx.config.engineWeights.setupStability ?? 0,
      features: withVerdict(
        {
          state: t.state,
          botArmed: armed,
          age: Date.now() - t.since,
          meanScore: mean,
          variance,
          samples: t.history.length,
          bandResidencyMs: eq?.timeInBandMs ?? 0,
        },
        { over: armed ? score : 0, under: armed ? score : 0, veto: armed ? 0 : clamp(60 - score) },
      ),
      reasons: [
        `Bot-armed state ${t.state}, mean fitness ${mean.toFixed(1)} over ${t.history.length} samples`,
        eq
          ? `Equilibrium band held for ${(eq.timeInBandMs / 1000).toFixed(0)}s`
          : "Equilibrium residency unknown",
      ],
    };
  },
};
