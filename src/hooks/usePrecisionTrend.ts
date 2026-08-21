// Precision Trend AI V3 — live streaming Market Mind Engine hook.
import { useCallback, useEffect, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "./useDerivStream";
import { derivBus } from "@/lib/deriv/tick-bus";
import { type Tick } from "@/lib/analytics";
import {
  analyseMarketTrend,
  DEFAULT_TREND_SETTINGS,
  type TrendSettings,
} from "@/lib/precision-trend/engine";
import type { MarketReport, TrendContract } from "@/lib/precision-trend/types";

// Precision Trend AI monitors ONLY Volatility (standard + 1s) and Jump indices.
// Boom/Crash markets are explicitly excluded per V4 spec.
const ALLOWED_TREND_SYMBOLS = new Set([
  "R_10",
  "R_25",
  "R_50",
  "R_75",
  "R_100",
  "1HZ10V",
  "1HZ25V",
  "1HZ50V",
  "1HZ75V",
  "1HZ100V",
  "JD10",
  "JD25",
  "JD50",
  "JD75",
  "JD100",
]);
export const TREND_SYMBOLS = DERIV_SYMBOLS.filter((s) => ALLOWED_TREND_SYMBOLS.has(s.symbol));
const TREND_SET = new Set(TREND_SYMBOLS.map((s) => s.symbol));

// Precision Trend is a signal EMITTER. When a new held recommendation appears
// we ping the browser so the trader does not have to stare at the UI. Users
// opt in with requestSignalPermission() from the page header.
export function requestSignalPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve("denied" as NotificationPermission);
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission();
}

function emitSignalNotification(signal: HeldTrendSignal) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const dir = signal.contract === "BUY_RISE" ? "BUY RISE" : "BUY FALL";
  try {
    new Notification(`Precision Trend · ${dir}`, {
      body: `${signal.name} · confidence ${signal.confidence.toFixed(0)}\n${signal.reasoning[0] ?? ""}`,
      tag: `precision-trend-${signal.market}`,
      silent: false,
    });
  } catch {
    /* ignore */
  }
}

export interface HeldTrendSignal {
  market: string;
  name: string;
  contract: TrendContract;
  confidence: number;
  reasoning: string[];
  createdAt: number;
  holdUntil: number;
}

export interface TrendState {
  markets: MarketReport[];
  best: MarketReport | null;
  held: HeldTrendSignal | null;
  history: HeldTrendSignal[];
  status: "idle" | "connecting" | "live" | "error";
  feedsReady: number;
  feedsTotal: number;
  scanning: boolean;
  lastScanAt: number;
  scanNow: () => void;
}

export function usePrecisionTrend(settings: TrendSettings = DEFAULT_TREND_SETTINGS): TrendState {
  const [state, setState] = useState<Omit<TrendState, "scanNow">>({
    markets: [],
    best: null,
    held: null,
    history: [],
    status: "idle",
    feedsReady: 0,
    feedsTotal: TREND_SYMBOLS.length,
    scanning: false,
    lastScanAt: 0,
  });
  const ticksRef = useRef<Record<string, Tick[]>>({});
  const heldRef = useRef<HeldTrendSignal | null>(null);
  const historyRef = useRef<HeldTrendSignal[]>([]);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const runScan = useCallback(() => {
    const s = settingsRef.current;
    const markets: MarketReport[] = [];
    let ready = 0;
    for (const sym of TREND_SYMBOLS) {
      const ticks = ticksRef.current[sym.symbol] ?? [];
      if (ticks.length >= s.minTicks) ready++;
      if (ticks.length < 60) continue;
      markets.push(analyseMarketTrend(sym.symbol, sym.name, ticks, s));
    }
    const actionable = markets
      .filter((m) => m.mind.recommendation !== "NO_TRADE" && m.mind.timing === "ENTER_NOW")
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
    const now = Date.now();
    let held = heldRef.current;
    const top = actionable[0];
    if (held && now >= held.holdUntil) held = null;
    if (!held && top) {
      const holdSecs = Math.max(10, top.mind.expectedPersistenceSeconds);
      held = {
        market: top.market,
        name: top.name,
        contract: top.mind.recommendation as TrendContract,
        confidence: top.mind.confidence,
        reasoning: [top.mind.analystNote],
        createdAt: now,
        holdUntil: now + holdSecs * 1000,
      };
      historyRef.current = [held, ...historyRef.current].slice(0, 25);
      emitSignalNotification(held);
    } else if (held && top && top.market === held.market) {
      held = { ...held, confidence: top.mind.confidence, reasoning: [top.mind.analystNote] };
    }
    heldRef.current = held;
    const best =
      actionable[0] ??
      markets.slice().sort((a, b) => b.opportunityScore - a.opportunityScore)[0] ??
      null;
    setState((prev) => ({
      ...prev,
      markets,
      best,
      held,
      history: historyRef.current,
      feedsReady: ready,
      lastScanAt: now,
      scanning: true,
    }));
    window.setTimeout(() => setState((p) => ({ ...p, scanning: false })), 400);
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
      if (!TREND_SET.has(sym)) return;
      ticksRef.current[sym] = ticks.length > 2000 ? ticks.slice(-2000) : [...ticks];
    });
    const unsubTick = derivBus.onTick((sym, tick) => {
      if (!TREND_SET.has(sym)) return;
      const arr = ticksRef.current[sym] ?? [];
      arr.push(tick);
      if (arr.length > 2000) arr.splice(0, arr.length - 2000);
      ticksRef.current[sym] = arr;
    });
    const unsubSym = derivBus.subscribe(TREND_SYMBOLS.map((s) => s.symbol));
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

  return { ...state, scanNow: runScan };
}
