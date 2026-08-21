// Bot-aligned signal feed — the AUTHORITATIVE pipeline for tradeable signals.
//
// Runs one PrecisionEdgeEngine per digit market (every engine bot-retargeted)
// and publishes the best qualifying market across the WHOLE watchlist. There is
// no privileged symbol: the bot's trading rules (barriers, martingale legs) are
// symbol-agnostic, so any market that passes the Equilibrium Doctrine gate can
// host it.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { derivBus } from "@/lib/deriv/tick-bus";
import { PrecisionEdgeEngine } from "@/lib/precision-edge/orchestrator";
import type { Tick } from "@/lib/precision-edge/types";
import { getBotConfig, subscribeBotConfig } from "@/lib/precision-edge/bot/store";
import type { BotSignalConfig } from "@/lib/precision-edge/bot/config";
import type { BotSignal } from "@/lib/precision-edge/bot/types";
import { subscribeBotState, type BotState } from "@/lib/precision-edge/bot/state-tracker";
import { PE_SYMBOLS } from "./usePrecisionEdgeScan";
import { DEFAULT_SETTINGS, type PrecisionSettings } from "./usePrecisionSettings";
import {
  botConfigFromSettings,
  engineWeightsFromSettings,
} from "@/lib/precision-edge/bot/settings-bridge";
import { mergeBotConfig } from "@/lib/precision-edge/bot/config";

const MAX_TICKS = 1000;
const SCAN_MS = 1500;

export interface BotSignalRow {
  symbol: string;
  name: string;
  ticks: number;
  signal: BotSignal;
}

export interface BotScanState {
  /** Every market, ranked: ready first, then by fitness. */
  rows: BotSignalRow[];
  /** Every market whose verdict is BOT_ON right now (can be more than one). */
  readyRows: BotSignalRow[];
  /**
   * The authoritative signal for the page: the best BOT_ON market, or — when
   * nothing is ready — the closest-to-ready market as diagnostic info only.
   */
  best: BotSignalRow | null;
  /** Closest-to-ready market while nothing is BOT_ON (diagnostic only). */
  closest: BotSignalRow | null;
  status: "idle" | "connecting" | "live" | "error";
  config: BotSignalConfig;
  /** Store config merged with the operator's Settings-drawer values. */
  effectiveConfig: BotSignalConfig;
  botState: BotState;
  lastScanAt: number;
  scanNow: () => void;
}

export function useBotSignal(settings: PrecisionSettings = DEFAULT_SETTINGS): BotScanState {
  const [rows, setRows] = useState<BotSignalRow[]>([]);
  const [status, setStatus] = useState<BotScanState["status"]>("idle");
  const [config, setConfig] = useState<BotSignalConfig>(() => getBotConfig());
  const [botState, setBotState] = useState<BotState>(() => ({
    countLoss: 0,
    leg: "fresh",
    stakeMultiple: 1,
    sessionPnl: 0,
    wins: 0,
    losses: 0,
    updatedAt: Date.now(),
  }));
  const [lastScanAt, setLastScanAt] = useState(0);

  const settingsRef = useRef<PrecisionSettings>(settings);
  settingsRef.current = settings;
  /** Consecutive scans each market has held a BOT_ON verdict. */
  const holdRef = useRef<Record<string, { key: string; count: number }>>({});
  /** Timestamp of the last published BOT_ON per market (cooldown source). */
  const publishedRef = useRef<Record<string, number>>({});

  const ticksRef = useRef<Record<string, Tick[]>>({});
  const enginesRef = useRef<Record<string, PrecisionEdgeEngine>>({});
  const configRef = useRef<BotSignalConfig>(config);

  useEffect(() => subscribeBotConfig(setConfig), []);
  useEffect(() => subscribeBotState(setBotState), []);

  // Push config changes into every engine — thresholds stay runtime-editable.
  useEffect(() => {
    const merged = mergeBotConfig(config, botConfigFromSettings(settings));
    configRef.current = merged;
    for (const eng of Object.values(enginesRef.current)) {
      eng.updateConfig({
        bot: merged,
        recommendationThreshold: merged.recommendationThreshold,
        engineWeights: engineWeightsFromSettings(settings),
        rollingWindows: [20, 50, 100, 200, 500, merged.canonicalWindow],
      });
    }
  }, [config, settings]);

  const scanNow = useCallback(() => {
    const next: BotSignalRow[] = [];
    for (const s of PE_SYMBOLS) {
      const ticks = ticksRef.current[s.symbol] ?? [];
      if (ticks.length < 60) continue;
      const out = enginesRef.current[s.symbol]?.evaluate();
      if (!out?.botSignal) continue;
      const signal = applyNoiseFilter(
        s.symbol,
        out.botSignal,
        settingsRef.current,
        holdRef.current,
        publishedRef.current,
      );
      next.push({ symbol: s.symbol, name: s.name, ticks: ticks.length, signal });
    }
    next.sort((a, b) => b.signal.fitness - a.signal.fitness);
    setRows(next);
    setLastScanAt(Date.now());
  }, []);

  useEffect(() => {
    setStatus("connecting");
    ticksRef.current = {};
    enginesRef.current = {};
    for (const s of PE_SYMBOLS) {
      enginesRef.current[s.symbol] = new PrecisionEdgeEngine({
        market: s.symbol,
        marketName: s.name,
        config: {
          bot: configRef.current,
          recommendationThreshold: configRef.current.recommendationThreshold,
          engineWeights: engineWeightsFromSettings(settingsRef.current),
        },
      });
    }

    const unsubStatus = derivBus.onStatus((st) => setStatus(st));
    const unsubHistory = derivBus.onHistory((sym, ticks) => {
      if (!enginesRef.current[sym]) return;
      const arr = (ticks.length > MAX_TICKS ? ticks.slice(-MAX_TICKS) : [...ticks]) as Tick[];
      ticksRef.current[sym] = arr;
      enginesRef.current[sym].seed(arr);
    });
    const unsubTick = derivBus.onTick((sym, tick) => {
      if (!enginesRef.current[sym]) return;
      const arr = ticksRef.current[sym] ?? [];
      arr.push(tick);
      if (arr.length > MAX_TICKS) arr.splice(0, arr.length - MAX_TICKS);
      ticksRef.current[sym] = arr;
      enginesRef.current[sym].push(tick);
    });
    const unsubSym = derivBus.subscribe(PE_SYMBOLS.map((s) => s.symbol));

    return () => {
      unsubTick();
      unsubHistory();
      unsubStatus();
      unsubSym();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(scanNow, Math.max(500, settings.refreshMs || SCAN_MS));
    const kick = window.setTimeout(scanNow, 200);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(kick);
    };
  }, [scanNow, settings.refreshMs]);

  // ── Selection: best qualifying market across the ENTIRE watchlist ────────
  // No hardcoded symbol. Ready markets always win; when nothing is ready the
  // closest-to-ready market is surfaced as diagnostic/waiting info only.
  const { readyRows, closest, best } = useMemo(() => {
    const ready = rows
      .filter((r) => r.signal.verdict === "BOT_ON")
      .sort(
        (a, b) =>
          b.signal.fitness - a.signal.fitness ||
          b.signal.confidence - a.signal.confidence ||
          a.signal.equilibrium.error - b.signal.equilibrium.error,
      );
    // Closeness: full window first, then smallest equilibrium gap, then fitness.
    const near = [...rows].sort(
      (a, b) =>
        b.signal.readiness.windowProgress - a.signal.readiness.windowProgress ||
        a.signal.readiness.equilibriumGapPp - b.signal.readiness.equilibriumGapPp ||
        b.signal.fitness - a.signal.fitness,
    );
    const closestRow = ready.length ? null : (near[0] ?? null);
    return { readyRows: ready, closest: closestRow, best: ready[0] ?? closestRow };
  }, [rows]);

  const ranked = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(b.signal.verdict === "BOT_ON") - Number(a.signal.verdict === "BOT_ON") ||
          b.signal.fitness - a.signal.fitness,
      ),
    [rows],
  );

  const effectiveConfig = useMemo(
    () => mergeBotConfig(config, botConfigFromSettings(settings)),
    [config, settings],
  );

  return {
    rows: ranked,
    readyRows,
    best,
    closest,
    status,
    config,
    effectiveConfig,
    botState,
    lastScanAt,
    scanNow,
  };
}

/**
 * Noise filter — the operator-visible controls (confirmation scans, minimum
 * fused score, cooldown) applied to the bot verdict before it is published.
 * A setup must survive N consecutive scans, clear the score floor and respect
 * the cooldown after the last published BOT_ON, otherwise it is downgraded to
 * BOT_STANDBY instead of flickering ON/OFF.
 *
 * Cooldown/confirmation state is keyed per market, so one market's cooldown can
 * never suppress a genuinely different ready market elsewhere.
 */
function applyNoiseFilter(
  symbol: string,
  signal: BotSignal,
  s: PrecisionSettings,
  hold: Record<string, { key: string; count: number }>,
  published: Record<string, number>,
): BotSignal {
  if (signal.verdict !== "BOT_ON") {
    delete hold[symbol];
    return signal;
  }
  const key = `${signal.direction}:${signal.barrier}`;
  const prev = hold[symbol];
  const count = prev && prev.key === key ? prev.count + 1 : 1;
  hold[symbol] = { key, count };

  const now = Date.now();
  const last = published[symbol] ?? 0;
  const cooldownLeft = Math.max(0, s.signalCooldownSeconds * 1000 - (now - last));

  const downgrade = (why: string): BotSignal => ({
    ...signal,
    verdict: "BOT_STANDBY",
    // Readiness must agree with the published verdict — a downgraded signal is
    // not ready, and it explains itself with the noise-filter reason.
    readiness: {
      ...signal.readiness,
      ready: false,
      blockers: [why, ...signal.readiness.blockers],
      primaryBlocker: why,
    },
    instructions: { ...signal.instructions, action: why },
    narrative: { ...signal.narrative, action: why },
  });

  if (signal.fitness < s.minSignalScore) {
    return downgrade(
      `Fused score ${signal.fitness.toFixed(0)} is below your ${s.minSignalScore} floor — holding.`,
    );
  }
  if (count < s.confirmationScans) {
    return downgrade(
      `Setup confirmed ${count}/${s.confirmationScans} scans — waiting for confirmation.`,
    );
  }
  if (cooldownLeft > 0) {
    return downgrade(
      `Cooldown active — ${Math.ceil(cooldownLeft / 1000)}s before the next signal.`,
    );
  }
  published[symbol] = now;
  return signal;
}
