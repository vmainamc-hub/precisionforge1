// Precision Edge AI V2 — live market reasoning across every digit market.
// Streams Deriv ticks and runs the independent contract intelligence engines
// per market, then ranks by internal consistency filtered through the
// operator's gates. Emits ONE signal at a time and holds it for at least
// `minHoldSeconds` so it remains actionable.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "./useDerivStream";
import { derivBus } from "@/lib/deriv/tick-bus";
import { lastDigit, type Tick } from "@/lib/analytics";
import { analyseMarket } from "@/lib/precision-edge-v2/engine";
import type { ContractVerdict, MarketReasoning } from "@/lib/precision-edge-v2/types";
import { DEFAULT_SETTINGS, type PrecisionSettings } from "./usePrecisionSettings";

const DIGIT_GROUPS = new Set(["Standard", "1s", "Jump"]);
export const PE_SYMBOLS = DERIV_SYMBOLS.filter((s) => DIGIT_GROUPS.has(s.group));
const PE_SET = new Set(PE_SYMBOLS.map((s) => s.symbol));

export interface HeldSignal {
  market: string;
  name: string;
  verdict: ContractVerdict;
  psychology: MarketReasoning["psychology"];
  behaviour: MarketReasoning["behaviour"];
  createdAt: number;
  holdUntil: number;
}

export interface ReasoningState {
  markets: MarketReasoning[];
  best: MarketReasoning | null;
  held: HeldSignal | null; // sticky single-signal output
  status: "idle" | "connecting" | "live" | "error";
  latencyMs: number;
  feedsReady: number;
  feedsTotal: number;
  lastDigits: Record<string, number>;
  scanning: boolean;
  lastScanAt: number;
  scanNow: () => void;
}

/** Rescale weights so they sum to 1. */
function normWeights(w: PrecisionSettings["weights"]): PrecisionSettings["weights"] {
  const sum = Object.values(w).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const out = {} as PrecisionSettings["weights"];
  (Object.keys(w) as (keyof typeof w)[]).forEach((k) => (out[k] = Math.max(0, w[k]) / sum));
  return out;
}

/**
 * Weighted score for a verdict using the operator's engine weights.
 *
 * V4: the Digit Pressure / Scarcity reading is the dominant term. Engine
 * weights still shape the corroborating evidence, but a market whose pressure
 * field is flat or hostile can never outrank one with a live divergence.
 */
function weightedScore(v: ContractVerdict, psyHealth: number, w: PrecisionSettings["weights"]) {
  const n = normWeights(w);
  // Map gates → engine weights.
  const gateBy = Object.fromEntries(v.gates.map((g) => [g.name, g.ok ? 1 : 0]));
  const persistence = Math.min(1, v.persistenceTicks / 10);
  const health = Math.max(0, Math.min(1, psyHealth / 100));
  const parts =
    n.digitStatistics * (gateBy["Edge"] ?? 0) +
    n.barMomentum * (gateBy["Momentum"] ?? 0) +
    n.contrarian * (gateBy["Loser suppression"] ?? 0) +
    n.digitZones * (gateBy["Digit compatibility"] ?? 0) +
    n.psychology * (gateBy["Trader alignment"] ?? 0) +
    n.marketHealth * ((gateBy["Manipulation"] ?? 0) * 0.5 + health * 0.5) +
    n.persistence * persistence +
    n.recoveryFit * Math.max(0, Math.min(1, (v.edge + 0.05) / 0.1)) +
    n.botCompatibility * Math.max(0, Math.min(1, v.confidence / 100));
  const evidence = parts * 100; // 0..100

  // ── Pressure dominance ──────────────────────────────────────────────
  const p = v.pressure;
  if (!p) return evidence;
  const pressureScore =
    p.conviction + p.asymmetry * 45 + p.accelAsymmetry * 18 + (p.qualified ? 20 : 0);
  // 70% pressure / 30% corroborating evidence.
  return pressureScore * 0.7 + evidence * 0.3;
}

export function usePrecisionReasoning(
  settings: PrecisionSettings = DEFAULT_SETTINGS,
): ReasoningState {
  const [state, setState] = useState<Omit<ReasoningState, "scanNow">>({
    markets: [],
    best: null,
    held: null,
    status: "idle",
    latencyMs: 0,
    feedsReady: 0,
    feedsTotal: PE_SYMBOLS.length,
    lastDigits: {},
    scanning: false,
    lastScanAt: 0,
  });

  const ticksRef = useRef<Record<string, Tick[]>>({});
  const pingSentRef = useRef<number>(0);
  const latencyRef = useRef<number>(0);
  const heldRef = useRef<HeldSignal | null>(null);
  // Noise filter state: how many consecutive scans each setup has qualified for,
  // and when the last published signal expired (cooldown).
  const streakRef = useRef<Record<string, number>>({});
  const cooldownUntilRef = useRef<number>(0);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const maxTicks = useMemo(
    () => Math.max(300, Math.min(1000, settings.lookbackTicks)),
    [settings.lookbackTicks],
  );

  const runScan = useCallback(() => {
    const s = settingsRef.current;
    const markets: MarketReasoning[] = [];
    const lastDigits: Record<string, number> = {};
    let ready = 0;

    for (const sym of PE_SYMBOLS) {
      const ticks = (ticksRef.current[sym.symbol] ?? []).slice(-s.lookbackTicks);
      if (ticks.length) lastDigits[sym.symbol] = lastDigit(ticks[ticks.length - 1].price);
      if (ticks.length >= s.lookbackTicks) ready++;
      if (ticks.length < 60) continue;
      markets.push(analyseMarket(sym.symbol, sym.name, ticks));
    }

    // Gate every verdict against operator's minimums.
    type Candidate = { m: MarketReasoning; v: ContractVerdict; score: number };
    const candidates: Candidate[] = [];
    for (const m of markets) {
      for (const v of m.verdicts) {
        const p = v.pressure;
        // Digit Pressure is SUPPORTING EVIDENCE ONLY. It no longer opens a
        // qualification path of its own — it has already shaped the verdict's
        // confidence inside the engine. Every candidate must clear the full
        // operator checklist below.
        if (s.onlyEnabledBot && !s.enabledBots[v.id]) continue;

        // ── HARD GATES — always enforced, on every path ───────────────
        // Edge, manipulation and persistence are pass/fail. No pressure
        // divergence, momentum or confidence score can override them.
        // Thresholds stay operator-configurable in the settings drawer.
        if (v.state === "REJECTED" || v.state === "CONFLICT") continue;
        if (m.psychology.manipulation >= s.maxManipulation) continue; // GATE: manipulation
        if (v.edge * 100 < s.minEdgePct) continue; // GATE: edge
        if (v.persistenceTicks < s.minPersistenceTicks) continue; // GATE: persistence
        // The pressure field must not be actively against us, ever.
        if (p && p.bias === "AGAINST") continue;

        // ── Operator checklist — the ONLY qualification path ───────────
        // `s.threshold` is an absolute floor. Nothing lowers it.
        if (v.confidence < s.threshold) continue;
        if (m.psychology.health < s.minMarketHealth) continue;
        if (v.persistenceTicks * 10 < s.minPersistence) continue;
        if (v.consistency < s.minStability) continue;
        if (!v.quality || v.quality.tier === "NONE" || v.quality.tier === "DEVELOPING") continue;
        if (!v.dbotPrimed?.primed) continue;
        if (v.confidence < s.minBotCompatibility) continue;

        const score = weightedScore(v, m.psychology.health, s.weights);
        candidates.push({ m, v, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score);

    // ── Noise filter ──────────────────────────────────────────────────
    // 1. A setup must qualify on N consecutive scans before it is allowed to
    //    publish (kills one-scan flickers).
    // 2. Its fused score must clear the quality floor.
    // 3. A short cooldown follows an expired signal so the feed can settle.
    const nowTs = Date.now();
    const keyOf = (c: Candidate) => `${c.m.market}|${c.v.id}`;
    const nextStreaks: Record<string, number> = {};
    for (const c of candidates) {
      const k = keyOf(c);
      nextStreaks[k] = (streakRef.current[k] ?? 0) + 1;
    }
    streakRef.current = nextStreaks;

    const minStreak = Math.max(1, Math.round(s.confirmationScans));
    const publishable = candidates.filter(
      (c) => (nextStreaks[keyOf(c)] ?? 0) >= minStreak && c.score >= s.minSignalScore,
    );

    const top = publishable[0] ?? null;
    const now = nowTs;
    let held = heldRef.current;

    if (held && now < held.holdUntil) {
      // Sticky hold: only switch if a challenger clearly beats the incumbent.
      const heldStill = candidates.find(
        (c) => c.m.market === held!.market && c.v.id === held!.verdict.id,
      );
      if (heldStill) {
        held = {
          ...held,
          verdict: heldStill.v,
          psychology: heldStill.m.psychology,
          behaviour: heldStill.m.behaviour,
        };
      } else if (top) {
        const heldScore = heldStill ? (heldStill as Candidate).score : 0;
        if (top.score - heldScore < s.hysteresis) {
          // keep held signal even though it no longer qualifies — reasoning may be transient
        } else {
          held = null;
          cooldownUntilRef.current = now + s.signalCooldownSeconds * 1000;
        }
      }
    } else {
      if (held) cooldownUntilRef.current = now + s.signalCooldownSeconds * 1000;
      held = null;
    }

    if (!held && top && now >= cooldownUntilRef.current) {
      held = {
        market: top.m.market,
        name: top.m.name,
        verdict: top.v,
        psychology: top.m.psychology,
        behaviour: top.m.behaviour,
        createdAt: now,
        holdUntil: now + s.minHoldSeconds * 1000,
      };
    }
    heldRef.current = held;

    const best = top ? top.m : null;

    setState((prev) => ({
      ...prev,
      markets,
      best,
      held,
      lastDigits,
      feedsReady: ready,
      latencyMs: latencyRef.current,
      lastScanAt: now,
      scanning: true,
    }));
    window.setTimeout(() => setState((p) => ({ ...p, scanning: false })), 650);
  }, []);

  useEffect(() => {
    setState((p) => ({ ...p, status: "connecting" }));
    ticksRef.current = {};
    const unsubStatus = derivBus.onStatus((s) =>
      setState((p) => ({
        ...p,
        status:
          s === "live"
            ? "live"
            : s === "connecting"
              ? "connecting"
              : s === "error"
                ? "error"
                : "idle",
      })),
    );
    const unsubHistory = derivBus.onHistory((sym, ticks) => {
      if (!PE_SET.has(sym)) return;
      ticksRef.current[sym] = ticks.length > maxTicks ? ticks.slice(-maxTicks) : [...ticks];
    });
    const unsubTick = derivBus.onTick((sym, tick) => {
      if (!PE_SET.has(sym)) return;
      const arr = ticksRef.current[sym] ?? [];
      arr.push(tick);
      if (arr.length > maxTicks) arr.splice(0, arr.length - maxTicks);
      ticksRef.current[sym] = arr;
    });
    const unsubSym = derivBus.subscribe(PE_SYMBOLS.map((s) => s.symbol));
    return () => {
      unsubTick();
      unsubHistory();
      unsubStatus();
      unsubSym();
    };
  }, [maxTicks]);

  useEffect(() => {
    if (!settings.autoScan) return;
    const id = window.setInterval(runScan, Math.max(500, settings.refreshMs));
    const kick = window.setTimeout(runScan, 50);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(kick);
    };
  }, [runScan, settings.autoScan, settings.refreshMs]);

  return { ...state, scanNow: runScan };
}
