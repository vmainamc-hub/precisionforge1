import { useEffect, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "./useDerivStream";
import { derivBus } from "@/lib/deriv/tick-bus";
import { overUnderStats, marketIntel, lastDigit, type Tick } from "@/lib/analytics";

const MAX_TICKS = 1000;
const MIN_TICKS = 1000;
// Cooldown lowered from 10 min → 45s. The 10-minute lockout was suppressing
// re-entries even after fresh setups fully re-qualified, degrading signal
// quality. 45s matches the OVER2/UNDER7 advanced scanner cadence.
const COOLDOWN_MS = 45_000;

const SCAN_SYMBOLS = DERIV_SYMBOLS.filter((s) => s.group === "Standard" || s.group === "1s");
const SCAN_SET = new Set(SCAN_SYMBOLS.map((s) => s.symbol));

export type BotGate = {
  streakOk: boolean;
  histPct: number;
  histOk: boolean;
  winPct: number;
  winOk: boolean;
  vetoOk: boolean;
  passed: boolean;
};

export type Under7Match = {
  symbol: string;
  name: string;
  pUnder: number;
  manipulation: number;
  p0: number;
  p1: number;
  p9: number;
  entryPrice: number;
  lastDigit: number;
  stakePct: number;
  conf: number;
  botGate: BotGate;
  ts: number;
};

export type Over2Match = {
  symbol: string;
  name: string;
  pOver: number;
  manipulation: number;
  p0: number;
  p1: number;
  p2: number;
  p7: number;
  p8: number;
  p9: number;
  freq: number[];
  entryPrice: number;
  lastDigit: number;
  conf: number;
  ts: number;
  botGate: BotGate;
};

// UNDER-direction bot gate (losing = digit >= pred, winning = digit < pred)
function evalBotGateUnder(
  ticks: Tick[],
  pred: number,
  streakLen: number,
  highMin: number,
  histWin: number,
  maxLossPct: number,
  probWin: number,
  minWinPct: number,
  vetoMax: number,
): BotGate {
  const digits = ticks.map((t) => lastDigit(t.price));
  const n = digits.length;
  let streakOk = n >= streakLen;
  for (let i = n - streakLen; i < n && streakOk; i++) if (digits[i] < highMin) streakOk = false;
  const hist = digits.slice(-histWin);
  const loseCnt = hist.filter((d) => d >= pred).length;
  const histPct = hist.length ? (loseCnt / hist.length) * 100 : 100;
  const histOk = histPct <= maxLossPct;
  const prob = digits.slice(-probWin);
  const winCnt = prob.filter((d) => d < pred).length;
  const winPct = prob.length ? (winCnt / prob.length) * 100 : 0;
  const winOk = winPct >= minWinPct;
  const vetoOk = n > 0 && digits[n - 1] <= vetoMax;
  return {
    streakOk,
    histPct,
    histOk,
    winPct,
    winOk,
    vetoOk,
    passed: streakOk && histOk && winOk && vetoOk,
  };
}

// OVER-direction bot gate (losing = digit <= pred, winning = digit > pred)
function evalBotGateOver(
  ticks: Tick[],
  pred: number,
  streakLen: number,
  lowMax: number,
  histWin: number,
  maxLossPct: number,
  probWin: number,
  minWinPct: number,
  vetoMin: number,
): BotGate {
  const digits = ticks.map((t) => lastDigit(t.price));
  const n = digits.length;
  // streak: last N digits all "low" — signalling suppression before mean-revert up
  let streakOk = n >= streakLen;
  for (let i = n - streakLen; i < n && streakOk; i++) if (digits[i] > lowMax) streakOk = false;
  const hist = digits.slice(-histWin);
  const loseCnt = hist.filter((d) => d <= pred).length;
  const histPct = hist.length ? (loseCnt / hist.length) * 100 : 100;
  const histOk = histPct <= maxLossPct;
  const prob = digits.slice(-probWin);
  const winCnt = prob.filter((d) => d > pred).length;
  const winPct = prob.length ? (winCnt / prob.length) * 100 : 0;
  const winOk = winPct >= minWinPct;
  const vetoOk = n > 0 && digits[n - 1] >= vetoMin;
  return {
    streakOk,
    histPct,
    histOk,
    winPct,
    winOk,
    vetoOk,
    passed: streakOk && histOk && winOk && vetoOk,
  };
}

export function useMultiVolatilityScan(enabled: boolean) {
  const [matches, setMatches] = useState<Under7Match[]>([]);
  const [over2Matches, setOver2Matches] = useState<Over2Match[]>([]);
  const [under7History, setUnder7History] = useState<Under7Match[]>([]);
  const [over2History, setOver2History] = useState<Over2Match[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const ticksRef = useRef<Record<string, Tick[]>>({});
  const u7CooldownRef = useRef<Record<string, number>>({});
  const o2CooldownRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled) {
      ticksRef.current = {};
      setMatches([]);
      setOver2Matches([]);
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    ticksRef.current = {};

    let raf: number | null = null;
    // LATENCY: this scan sweeps every symbol. Previously it re-ran on every
    // rAF, i.e. once per tick from ANY of the ~12 subscribed markets (>10 full
    // sweeps/sec), which starved the main thread and made the whole terminal
    // feel laggy. Coalesce to a fixed cadence instead — the underlying data
    // only advances ~1 tick/sec per market, so nothing is lost.
    const MIN_SCAN_MS = 400;
    let lastRun = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRecompute = () => {
      if (raf !== null || timer !== null) return;
      const wait = Math.max(0, MIN_SCAN_MS - (Date.now() - lastRun));
      if (wait > 0) {
        timer = setTimeout(() => {
          timer = null;
          scheduleRecompute();
        }, wait);
        return;
      }
      raf = requestAnimationFrame(() => {
        raf = null;
        lastRun = Date.now();
        const out: Under7Match[] = [];
        const o2Out: Over2Match[] = [];
        const newU7: Under7Match[] = [];
        const newO2: Over2Match[] = [];
        const now = Date.now();
        for (const s of SCAN_SYMBOLS) {
          const ticks = ticksRef.current[s.symbol];
          if (!ticks || ticks.length < MIN_TICKS) continue;
          const ou7 = overUnderStats(ticks, 7);
          const ou2 = overUnderStats(ticks, 2);
          const m = marketIntel(ticks);
          const total0 = Math.max(1, ticks.length);
          const pctNow = new Array(10).fill(0);
          for (const tk of ticks) pctNow[lastDigit(tk.price)]++;
          for (let i = 0; i < 10; i++) pctNow[i] = pctNow[i] / total0;
          let hotD = 0,
            coldD = 0;
          for (let i = 1; i < 10; i++) {
            if (pctNow[i] > pctNow[hotD]) hotD = i;
            if (pctNow[i] < pctNow[coldD]) coldD = i;
          }
          const manipOk = m.manipulation < 0.2;

          // ============ UNDER 7 ============
          {
            const hotOk = hotD === 3 || hotD === 5 || hotD === 7;
            const coldOk = coldD === 0 || coldD === 2 || coldD === 4;
            const p9High = pctNow[9] > 0.105;
            const lowsSuppressed = pctNow[0] < 0.095 && pctNow[1] < 0.095;
            const botGate = evalBotGateUnder(ticks, 7, 3, 5, 50, 25, 40, 75, 4);
            if (hotOk && coldOk && p9High && lowsSuppressed && manipOk) {
              const lastTick = ticks[ticks.length - 1];
              const entryPrice = lastTick?.price ?? 0;
              const stakePct = Math.min(
                5,
                Math.max(1, Math.round(((ou7.pUnder - 0.7) * 100) / 2 + 1)),
              );
              const conf = Math.min(98, Math.max(70, Math.round(ou7.pUnder * 100 + 18)));
              const lastTs = u7CooldownRef.current[s.symbol] ?? 0;
              const fresh = now - lastTs > COOLDOWN_MS;
              const match: Under7Match = {
                symbol: s.symbol,
                name: s.name,
                pUnder: ou7.pUnder,
                manipulation: m.manipulation,
                p0: pctNow[0],
                p1: pctNow[1],
                p9: pctNow[9],
                entryPrice,
                lastDigit: lastDigit(entryPrice),
                stakePct,
                conf,
                botGate,
                ts: now,
              };
              // Always surface the match while conditions hold; cooldown only
              // gates the *history* push so the current signal doesn't vanish
              // on the very next recompute like it used to.
              out.push(match);
              if (fresh && conf >= 70) {
                u7CooldownRef.current[s.symbol] = now;
                newU7.push(match);
              }
            }
          }

          // ============ OVER 2 ============
          {
            const hotOk = hotD === 2 || hotD === 4 || hotD === 6;
            const coldOk = coldD === 5 || coldD === 7 || coldD === 9;
            const p0High = pctNow[0] > 0.105;
            const highsSuppressed = pctNow[8] < 0.095 && pctNow[9] < 0.095;
            const botGate = evalBotGateOver(ticks, 2, 3, 4, 50, 25, 40, 75, 5);
            if (hotOk && coldOk && p0High && highsSuppressed && manipOk) {
              const lastTick = ticks[ticks.length - 1];
              const entryPrice = lastTick?.price ?? 0;
              const conf = Math.min(98, Math.max(70, Math.round(ou2.pOver * 100 + 18)));
              const lastTs = o2CooldownRef.current[s.symbol] ?? 0;
              const fresh = now - lastTs > COOLDOWN_MS;
              const match: Over2Match = {
                symbol: s.symbol,
                name: s.name,
                pOver: ou2.pOver,
                manipulation: m.manipulation,
                p0: pctNow[0],
                p1: pctNow[1],
                p2: pctNow[2],
                p7: pctNow[7],
                p8: pctNow[8],
                p9: pctNow[9],
                freq: ou2.freq,
                entryPrice,
                lastDigit: lastDigit(entryPrice),
                conf,
                ts: now,
                botGate,
              };
              o2Out.push(match);
              if (fresh && conf >= 70) {
                o2CooldownRef.current[s.symbol] = now;
                newO2.push(match);
              }
            }
          }
        }
        setMatches(out);
        setOver2Matches(o2Out);
        if (newU7.length) setUnder7History((prev) => [...newU7, ...prev].slice(0, 20));
        if (newO2.length) setOver2History((prev) => [...newO2, ...prev].slice(0, 20));
      });
    };

    const unsubStatus = derivBus.onStatus((s) =>
      setStatus(
        s === "live"
          ? "live"
          : s === "connecting"
            ? "connecting"
            : s === "error"
              ? "error"
              : "idle",
      ),
    );
    const unsubHistory = derivBus.onHistory((sym, ticks) => {
      if (!SCAN_SET.has(sym)) return;
      ticksRef.current[sym] = ticks.length > MAX_TICKS ? ticks.slice(-MAX_TICKS) : [...ticks];
      scheduleRecompute();
    });
    const unsubTick = derivBus.onTick((sym, tick) => {
      if (!SCAN_SET.has(sym)) return;
      const arr = ticksRef.current[sym] ?? [];
      arr.push(tick);
      if (arr.length > MAX_TICKS) arr.splice(0, arr.length - MAX_TICKS);
      ticksRef.current[sym] = arr;
      scheduleRecompute();
    });
    const unsubSym = derivBus.subscribe(SCAN_SYMBOLS.map((s) => s.symbol));

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      if (timer !== null) clearTimeout(timer);
      unsubTick();
      unsubHistory();
      unsubStatus();
      unsubSym();
    };
  }, [enabled]);

  return {
    matches,
    over2Matches,
    under7History,
    over2History,
    status,
    scannedCount: SCAN_SYMBOLS.length,
  };
}
