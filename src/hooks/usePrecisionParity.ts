// Precision Parity AI — live streaming reasoning across every digit market.
import { useCallback, useEffect, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "./useDerivStream";
import { derivBus } from "@/lib/deriv/tick-bus";
import { type Tick } from "@/lib/analytics";
import {
  analyseMarketParity,
  DEFAULT_PARITY_SETTINGS,
  type ParitySettings,
} from "@/lib/precision-parity/engine";
import type {
  MarketParityReport,
  ParityContract,
  EmittedParityOpportunity,
} from "@/lib/precision-parity/types";
import { computeSpecificParityEntryDigit } from "@/lib/precision-parity/engines/specific-entry-digit";
import {
  recordPublishedFinalSignal,
  checkAndResolvePendingSignals,
} from "@/lib/precision-parity/journal";

const DIGIT_GROUPS = new Set(["Standard", "1s", "Jump"]);
export const PARITY_SYMBOLS = DERIV_SYMBOLS.filter((s) => DIGIT_GROUPS.has(s.group));
const PARITY_SET = new Set(PARITY_SYMBOLS.map((s) => s.symbol));

export interface HeldParitySignal {
  market: string;
  name: string;
  contract: ParityContract;
  confidence: number;
  reasoning: string[];
  createdAt: number;
  holdUntil: number;
  holdDurationMs: number;
}

export interface ParityState {
  markets: MarketParityReport[];
  best: MarketParityReport | null;
  held: HeldParitySignal | null;
  history: HeldParitySignal[];
  emittedOpportunities: EmittedParityOpportunity[];
  topOpportunity: EmittedParityOpportunity | null;
  opportunityJournal: EmittedParityOpportunity[];
  status: "idle" | "connecting" | "live" | "error";
  feedsReady: number;
  feedsTotal: number;
  scanning: boolean;
  lastScanAt: number;
  audioAlerts: boolean;
  toggleAudioAlerts: () => void;
  scanNow: () => void;
  releaseHold: () => void;
  getTicks: (symbol: string) => Tick[];
  getDigits: (symbol: string) => number[];
}

function playTriggerChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio context might be blocked by browser policy until interaction
  }
}

export function usePrecisionParity(
  settings: ParitySettings = DEFAULT_PARITY_SETTINGS,
): ParityState {
  const [state, setState] = useState<
    Omit<ParityState, "scanNow" | "releaseHold" | "getTicks" | "getDigits" | "toggleAudioAlerts">
  >({
    markets: [],
    best: null,
    held: null,
    history: [],
    emittedOpportunities: [],
    topOpportunity: null,
    opportunityJournal: [],
    status: "idle",
    feedsReady: 0,
    feedsTotal: PARITY_SYMBOLS.length,
    scanning: false,
    lastScanAt: 0,
    audioAlerts: true,
  });

  const [audioAlerts, setAudioAlerts] = useState<boolean>(true);
  const activeOppMapRef = useRef<Map<string, { createdAt: number; validUntil: number }>>(new Map());
  const journalRef = useRef<EmittedParityOpportunity[]>([]);
  const lastChimedOpportunityIdRef = useRef<string | null>(null);

  const ticksRef = useRef<Record<string, Tick[]>>({});
  const heldRef = useRef<HeldParitySignal | null>(null);
  const historyRef = useRef<HeldParitySignal[]>([]);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const toggleAudioAlerts = useCallback(() => {
    setAudioAlerts((prev) => !prev);
  }, []);

  const releaseHold = useCallback(() => {
    heldRef.current = null;
    setState((prev) => ({ ...prev, held: null }));
  }, []);

  const runScan = useCallback(() => {
    const s = settingsRef.current;
    const markets: MarketParityReport[] = [];
    let ready = 0;
    const now = Date.now();

    for (const sym of PARITY_SYMBOLS) {
      const ticks =
        ticksRef.current[sym.symbol] && ticksRef.current[sym.symbol].length > 0
          ? ticksRef.current[sym.symbol]
          : derivBus.getTicks(sym.symbol);
      const digits = derivBus.getDigits(sym.symbol);
      if (ticks.length >= s.minTicks) ready++;
      if (ticks.length < 15 && digits.length < 15) continue;
      markets.push(
        analyseMarketParity(
          sym.symbol,
          sym.name,
          ticks,
          s,
          digits.length >= 15 ? digits : undefined,
        ),
      );
    }

    // Process Emitted Multi-Market Opportunities
    const emittedList: EmittedParityOpportunity[] = [];

    for (const m of markets) {
      const rec = m.verdict.recommendation;
      if (rec === "NO_TRADE") continue;

      const digits = derivBus.getDigits(m.market);
      const lastDigit = digits.length > 0 ? digits[digits.length - 1] : 0;
      const targetContract = rec === "BUY_EVEN" ? "DIGITEVEN" : "DIGITODD";
      const entryDecision =
        m.signal?.specificEntryDigit ??
        computeSpecificParityEntryDigit(digits, targetContract, m.market, m.name);

      const triggerDigit = entryDecision.entryDigit;
      const oppKey = `${m.market}-${rec}-${triggerDigit}`;
      const isTriggerShowing = lastDigit === triggerDigit;

      // Track validity window: default 60 seconds (1 minute setup validity)
      const validityDurationMs = 60 * 1000;
      let oppTiming = activeOppMapRef.current.get(oppKey);
      if (!oppTiming || now >= oppTiming.validUntil) {
        oppTiming = {
          createdAt: now,
          validUntil: now + validityDurationMs,
        };
        activeOppMapRef.current.set(oppKey, oppTiming);
      }

      const remainingSec = Math.max(0, Math.ceil((oppTiming.validUntil - now) / 1000));
      const confidence = m.verdict.confidence;
      const ev = m.signal?.expectedValue ?? 0.12;
      const winRate = entryDecision.preferred.pWin || 0.64;

      let status: "ARMED" | "ENTER_NOW" | "PENDING_DIGIT" | "EXPIRED" = "ARMED";
      if (remainingSec === 0) {
        status = "EXPIRED";
      } else if (isTriggerShowing) {
        status = "ENTER_NOW";
      } else {
        status = "PENDING_DIGIT";
      }

      const headline = `${m.name} → ${rec.replace("_", " ")}: Entry digit ${triggerDigit}, setup valid for ${remainingSec}s`;

      const consensusEngines = m.signal?.supportingEngines?.map((e) => ({
        name: e.name,
        vote: e.vote,
        weight: e.weight,
      })) ?? [
        { name: "Markov Tensor", vote: `Digit ${triggerDigit} Transition`, weight: 1.5 },
        { name: "EV Gate", vote: `+${(ev * 100).toFixed(1)}% EV`, weight: 1.4 },
        { name: "Hazard Engine", vote: "Streak Exhaustion", weight: 1.2 },
      ];

      const opp: EmittedParityOpportunity = {
        id: `${m.market}-${oppTiming.createdAt}`,
        market: m.market,
        marketName: m.name,
        contract: rec,
        contractLabel: rec === "BUY_EVEN" ? "BUY EVEN" : "BUY ODD",
        entryDigit: triggerDigit,
        instructionHeadline: headline,
        validForSeconds: 60,
        validUntil: oppTiming.validUntil,
        remainingSeconds: remainingSec,
        confidence,
        expectedValue: ev,
        winRate,
        status,
        lastDigit,
        isTriggerDigitShowing: isTriggerShowing,
        streak: {
          count: m.verdict.hypotheses[0]?.persistenceTicks ?? 2,
          parity: rec === "BUY_EVEN" ? "EVEN" : "ODD",
        },
        consensusEngines,
        suggestedStake: m.signal?.stake?.suggested ?? 1.5,
        evPercentagePoints: ev * 100,
        reasoning: m.verdict.reasons,
        createdAt: oppTiming.createdAt,
      };

      emittedList.push(opp);

      // Record finalSignal to durable journal if available
      if (m.finalSignal && m.finalSignal.action !== "NO_TRADE" && m.finalSignal.confidence >= 65) {
        recordPublishedFinalSignal(m.finalSignal);
      }

      // Add to journal if new high-conviction opportunity
      if (confidence >= 65 && !journalRef.current.some((j) => j.id === opp.id)) {
        journalRef.current = [opp, ...journalRef.current].slice(0, 30);
      }

      // Audio notification if trigger digit just printed and audio alert is on
      if (
        audioAlerts &&
        isTriggerShowing &&
        confidence >= 68 &&
        lastChimedOpportunityIdRef.current !== `${opp.id}-${lastDigit}`
      ) {
        lastChimedOpportunityIdRef.current = `${opp.id}-${lastDigit}`;
        playTriggerChime();
      }
    }

    // Sort emitted opportunities by confidence and EV
    emittedList.sort(
      (a, b) => b.confidence * (1 + b.expectedValue) - a.confidence * (1 + a.expectedValue),
    );
    const topOpportunity = emittedList[0] ?? null;

    // Pick READY signals or high-conviction building signals
    const readyMarkets = markets.filter(
      (m) =>
        (m.verdict.state === "READY" ||
          (m.verdict.state === "BUILDING" && m.verdict.confidence >= s.minConfidence - 5)) &&
        m.verdict.recommendation !== "NO_TRADE",
    );
    readyMarkets.sort((a, b) => b.verdict.confidence - a.verdict.confidence);

    let held = heldRef.current;
    const top = readyMarkets[0];
    if (held && now >= held.holdUntil) held = null;

    const holdDurationMs = Math.max(120, s.minHoldSeconds) * 1000;
    if (!held && top && top.verdict.confidence >= 58) {
      held = {
        market: top.market,
        name: top.name,
        contract: top.verdict.recommendation as ParityContract,
        confidence: top.verdict.confidence,
        reasoning: top.verdict.reasons,
        createdAt: now,
        holdUntil: now + holdDurationMs,
        holdDurationMs,
      };
      historyRef.current = [held, ...historyRef.current].slice(0, 25);
    } else if (held && top && top.market === held.market) {
      held = { ...held, confidence: top.verdict.confidence, reasoning: top.verdict.reasons };
    }
    heldRef.current = held;

    // If held signal is active, keep 'best' locked on the held market to prevent screen flashing/jumping
    let best: MarketParityReport | null = null;
    if (held) {
      best = markets.find((m) => m.market === held?.market) ?? null;
    }
    if (!best) {
      best =
        readyMarkets[0] ??
        markets.sort((a, b) => b.verdict.confidence - a.verdict.confidence)[0] ??
        null;
    }

    setState((prev) => ({
      ...prev,
      markets,
      best,
      held,
      history: historyRef.current,
      emittedOpportunities: emittedList,
      topOpportunity,
      opportunityJournal: journalRef.current,
      feedsReady: ready,
      lastScanAt: now,
      scanning: true,
      audioAlerts,
    }));
    window.setTimeout(() => setState((p) => ({ ...p, scanning: false })), 400);
  }, [audioAlerts]);

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
      if (!PARITY_SET.has(sym)) return;
      ticksRef.current[sym] = ticks.length > 2000 ? ticks.slice(-2000) : [...ticks];
    });
    const unsubTick = derivBus.onTick((sym, tick) => {
      if (!PARITY_SET.has(sym)) return;
      const arr = ticksRef.current[sym] ?? [];
      arr.push(tick);
      if (arr.length > 2000) arr.splice(0, arr.length - 2000);
      ticksRef.current[sym] = arr;

      // Extract last digit and check/resolve pending journal signals
      const pip = derivBus.getPipSize(sym);
      const str = tick.price.toFixed(pip);
      const lastDigit = parseInt(str[str.length - 1], 10);
      if (!isNaN(lastDigit)) {
        checkAndResolvePendingSignals(sym, lastDigit);
      }
    });
    const unsubSym = derivBus.subscribe(PARITY_SYMBOLS.map((s) => s.symbol));
    return () => {
      unsubTick();
      unsubHistory();
      unsubStatus();
      unsubSym();
    };
  }, []);

  useEffect(() => {
    if (!settings.autoScan) return;
    const id = window.setInterval(runScan, Math.max(500, settings.refreshMs));
    const kick = window.setTimeout(runScan, 50);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(kick);
    };
  }, [runScan, settings.autoScan, settings.refreshMs]);

  const getTicks = useCallback((sym: string) => ticksRef.current[sym] ?? [], []);
  const getDigits = useCallback((sym: string) => derivBus.getDigits(sym), []);

  return { ...state, toggleAudioAlerts, scanNow: runScan, releaseHold, getTicks, getDigits };
}
