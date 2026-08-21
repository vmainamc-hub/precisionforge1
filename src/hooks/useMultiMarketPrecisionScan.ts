// Multimarket Precision Scanner — all volatility markets × six contracts,
// gated by the five non-negotiable precision gates (see lib/precision-scanner),
// then scored on Manipulation / Edge / Persistence and locked for a minimum hold.
import { useEffect, useRef, useState } from "react";
import { DERIV_SYMBOLS } from "./useDerivStream";
import { derivBus } from "@/lib/deriv/tick-bus";
import { lastDigit, marketIntel, type Tick } from "@/lib/analytics";
import {
  computePressureField,
  readPressure,
  PRESSURE_SUB,
  PRESSURE_WINDOW,
  type PressureState,
} from "@/lib/precision-edge-v2/pressure-engine";
import {
  CONTRACT_DEFS,
  PRECISION_CONTRACTS,
  isWinningDigit,
  type PrecisionContractId,
} from "@/lib/precision-scanner/contracts";
import { evaluateGates, type GateDetail, type GateResults } from "@/lib/precision-scanner/gates";
import {
  computeEdge,
  computeFinalScore,
  computeManipulation,
  computePersistence,
  type EdgeScore,
  type ManipulationScore,
  type PersistenceScore,
} from "@/lib/precision-scanner/scoring";
import { getScannerSettings, useScannerSettings } from "./useScannerSettings";

const MAX_TICKS = PRESSURE_WINDOW;
const MIN_SCAN_MS = 100;
const COOLDOWN_MS = 15_000;
const HISTORY_MAX = 25;
const RESOLUTION_TICKS = 5;

const SCAN_SYMBOLS = DERIV_SYMBOLS.filter((s) => s.group === "Standard" || s.group === "1s");
const SCAN_SET = new Set(SCAN_SYMBOLS.map((s) => s.symbol));

export type PrecisionScanSignal = {
  id: string;
  contractType: PrecisionContractId;
  label: string;
  side: "OVER" | "UNDER";
  symbol: string;
  name: string;
  ts: number;
  confidence: number;
  digitPct: number[];
  digitTemp: ("hot" | "cold" | "neutral")[];
  digitTrend: ("rising" | "falling" | "stable")[];
  pressureStates: PressureState[];
  pressureMomentum: number[];
  gateResults: GateResults;
  gateDetails: GateDetail[];
  winnerDigits: number[];
  keyWinnerDigits: number[];
  loserDigits: number[];
  gateDigit: number;
  gateDigitPct: number;
  gateDigitMomentum: number;
  manipulation: number;
  entryPrice: number;
  // scoring
  manipulationScore: ManipulationScore;
  edge: EdgeScore;
  persistence: PersistenceScore;
  pressureConviction: number;
  finalScore: number;
  // lock
  lockedUntil: number;
  lockExpired: boolean;
  stillValid: boolean;
};

export type ResolvedPrecisionSignal = PrecisionScanSignal & {
  outcome: "WIN" | "LOSS" | "PENDING";
  resolvedAt?: number;
};

export type PrecisionNearMiss = {
  key: string;
  symbol: string;
  name: string;
  label: string;
  contractType: PrecisionContractId;
  blockedBy: string[];
  buildingInWinners: number[];
  buildingOutsideWinners: number[];
  finalScore: number;
};

export type PrecisionWinRates = Record<PrecisionContractId, { wins: number; losses: number }>;

function emptyWinRates(): PrecisionWinRates {
  return PRECISION_CONTRACTS.reduce((acc, c) => {
    acc[c] = { wins: 0, losses: 0 };
    return acc;
  }, {} as PrecisionWinRates);
}

export function useMultiMarketPrecisionScan(enabled: boolean) {
  const settings = useScannerSettings();
  const [activeSignals, setActiveSignals] = useState<PrecisionScanSignal[]>([]);
  const [history, setHistory] = useState<ResolvedPrecisionSignal[]>([]);
  const [winRates, setWinRates] = useState<PrecisionWinRates>(emptyWinRates);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [nearMisses, setNearMisses] = useState<PrecisionNearMiss[]>([]);

  const ticksRef = useRef<Record<string, Tick[]>>({});
  const digitsRef = useRef<Record<string, number[]>>({});
  const cooldownRef = useRef<Record<string, number>>({});
  const lockedRef = useRef<Map<string, PrecisionScanSignal>>(new Map());
  const pendingRef = useRef<{ sig: ResolvedPrecisionSignal; remaining: number; hadWin: boolean }[]>(
    [],
  );

  useEffect(() => {
    if (!enabled) {
      ticksRef.current = {};
      digitsRef.current = {};
      pendingRef.current = [];
      lockedRef.current.clear();
      setActiveSignals([]);
      setNearMisses([]);
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    ticksRef.current = {};
    digitsRef.current = {};
    cooldownRef.current = {};
    pendingRef.current = [];
    lockedRef.current.clear();

    let raf: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;

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
        const now = Date.now();
        const cfg = getScannerSettings();
        const fresh: ResolvedPrecisionSignal[] = [];
        const near: PrecisionNearMiss[] = [];
        const seenKeys = new Set<string>();

        for (const s of SCAN_SYMBOLS) {
          const ticks = ticksRef.current[s.symbol];
          const digits = digitsRef.current[s.symbol];
          if (!ticks || !digits || digits.length < PRESSURE_WINDOW) continue;

          const field = computePressureField(digits, PRESSURE_WINDOW, PRESSURE_SUB);
          const intel = marketIntel(ticks);
          const entryPrice = ticks[ticks.length - 1].price;

          const digitPct = field.digits.map((d) => d.share);
          const digitTemp = field.digits.map((d) =>
            d.share > 0.105 ? "hot" : d.share < 0.095 ? "cold" : "neutral",
          ) as PrecisionScanSignal["digitTemp"];
          const digitTrend = field.digits.map((d) =>
            d.momentum > 0.003 ? "rising" : d.momentum < -0.003 ? "falling" : "stable",
          ) as PrecisionScanSignal["digitTrend"];
          const pressureStates = field.digits.map((d) => d.state);
          const pressureMomentum = field.digits.map((d) => d.momentum);
          const manipulationScore = computeManipulation(digitPct);

          // The distribution decides WHICH contract this market is offering.
          // Only the contract whose winning zone holds the strongest share
          // advantage may fire — no contradictory Over/Under pairs.
          let bestContract: PrecisionContractId | null = null;
          let bestEdge = -Infinity;
          for (const c of PRECISION_CONTRACTS) {
            if (!cfg.enabledContracts[c]) continue;
            const w = CONTRACT_DEFS[c].fullWinners;
            const e = w.reduce((a, d) => a + digitPct[d], 0) - w.length / 10;
            if (e > bestEdge) {
              bestEdge = e;
              bestContract = c;
            }
          }

          for (const contractType of PRECISION_CONTRACTS) {
            if (!cfg.enabledContracts[contractType]) continue;
            const key = `${s.symbol}:${contractType}`;
            const evaluation = evaluateGates(contractType, field, {
              minBuildingWinners: cfg.minBuildingWinners,
              minEdgePct: cfg.minEdgePct,
            });
            const def = CONTRACT_DEFS[contractType];

            const edge = computeEdge(field, def.fullWinners);
            const persistence = computePersistence(digits, def.fullWinners);
            const verdict = readPressure(field, def.fullWinners);

            const finalScore = computeFinalScore(
              manipulationScore.value,
              edge.edgeScore,
              persistence.persistenceScore,
              verdict.conviction,
              cfg.weights,
            );

            const isBestByDistribution = contractType === bestContract;
            const scoreOk =
              manipulationScore.value <= cfg.maxManipulation &&
              edge.rawEdge * 100 >= cfg.minEdgePct &&
              persistence.persistenceScore >= cfg.minPersistence &&
              finalScore >= cfg.minFinalScore;

            const valid = evaluation.passed && scoreOk && isBestByDistribution;

            if (!valid) {
              const blockedBy = [...evaluation.blockedBy];
              if (evaluation.passed && !scoreOk) {
                if (manipulationScore.value > cfg.maxManipulation) blockedBy.push("Manipulation");
                if (edge.rawEdge * 100 < cfg.minEdgePct) blockedBy.push("Edge");
                if (persistence.persistenceScore < cfg.minPersistence)
                  blockedBy.push("Persistence");
                if (finalScore < cfg.minFinalScore) blockedBy.push("Final score");
              }
              if (evaluation.passed && scoreOk && !isBestByDistribution) {
                blockedBy.push("Weaker zone than best contract");
              }
              if (blockedBy.length === 1 && evaluation.buildingOutsideWinners.length === 0) {
                near.push({
                  key,
                  symbol: s.symbol,
                  name: s.name,
                  label: def.label,
                  contractType,
                  blockedBy,
                  buildingInWinners: evaluation.buildingInWinners,
                  buildingOutsideWinners: evaluation.buildingOutsideWinners,
                  finalScore,
                });
              }
            }

            const existing = lockedRef.current.get(key);
            if (existing) {
              seenKeys.add(key);
              const lockExpired = now >= existing.lockedUntil;
              if (lockExpired && !valid) {
                lockedRef.current.delete(key);
                seenKeys.delete(key);
              } else {
                lockedRef.current.set(key, {
                  ...existing,
                  // live-refresh the readings while the card stays pinned
                  digitPct,
                  digitTemp,
                  digitTrend,
                  pressureStates,
                  pressureMomentum,
                  gateResults: evaluation.gateResults,
                  gateDetails: evaluation.details,
                  gateDigitPct: evaluation.gateDigitShare,
                  gateDigitMomentum: evaluation.gateDigitMomentum,
                  manipulationScore,
                  edge,
                  persistence,
                  pressureConviction: Math.round(verdict.conviction),
                  finalScore,
                  lockExpired,
                  stillValid: valid,
                });
              }
              continue;
            }

            if (!valid) continue;
            if (now - (cooldownRef.current[key] ?? 0) <= COOLDOWN_MS) continue;
            cooldownRef.current[key] = now;

            const sig: PrecisionScanSignal = {
              id: `${contractType}-${s.symbol}-${now}`,
              contractType,
              label: def.label,
              side: def.side,
              symbol: s.symbol,
              name: s.name,
              ts: now,
              confidence: evaluation.confidence,
              digitPct,
              digitTemp,
              digitTrend,
              pressureStates,
              pressureMomentum,
              gateResults: evaluation.gateResults,
              gateDetails: evaluation.details,
              winnerDigits: def.fullWinners,
              keyWinnerDigits: def.keyWinners,
              loserDigits: def.losers,
              gateDigit: def.gateDigit,
              gateDigitPct: evaluation.gateDigitShare,
              gateDigitMomentum: evaluation.gateDigitMomentum,
              manipulation: intel.manipulation,
              entryPrice,
              manipulationScore,
              edge,
              persistence,
              pressureConviction: Math.round(verdict.conviction),
              finalScore,
              lockedUntil: now + cfg.lockDurationMs,
              lockExpired: false,
              stillValid: true,
            };
            lockedRef.current.set(key, sig);
            seenKeys.add(key);

            const resolved: ResolvedPrecisionSignal = { ...sig, outcome: "PENDING" };
            fresh.push(resolved);
            pendingRef.current.push({ sig: resolved, remaining: RESOLUTION_TICKS, hadWin: false });
          }
        }

        // Drop locked signals whose market went quiet, once their lock expired.
        for (const [key, sig] of lockedRef.current) {
          if (!seenKeys.has(key) && now >= sig.lockedUntil) lockedRef.current.delete(key);
        }

        const next = [...lockedRef.current.values()].sort((a, b) => b.finalScore - a.finalScore);
        setActiveSignals(next);
        setNearMisses(near.sort((a, b) => b.finalScore - a.finalScore).slice(0, 6));
        if (fresh.length) setHistory((prev) => [...fresh, ...prev].slice(0, HISTORY_MAX * 2));
      });
    };

    const resolvePending = (sym: string, price: number) => {
      if (!pendingRef.current.length) return;
      const d = lastDigit(price);
      const remaining: typeof pendingRef.current = [];
      const finalised: ResolvedPrecisionSignal[] = [];
      for (const p of pendingRef.current) {
        if (p.sig.symbol !== sym) {
          remaining.push(p);
          continue;
        }
        if (isWinningDigit(p.sig.contractType, d)) p.hadWin = true;
        p.remaining -= 1;
        if (p.remaining <= 0) {
          finalised.push({
            ...p.sig,
            outcome: p.hadWin ? "WIN" : "LOSS",
            resolvedAt: Date.now(),
          });
        } else {
          remaining.push(p);
        }
      }
      pendingRef.current = remaining;
      if (!finalised.length) return;

      setHistory((prev) => {
        const map = new Map(prev.map((h) => [h.id, h]));
        for (const f of finalised) map.set(f.id, f);
        return [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, HISTORY_MAX * 2);
      });
      setWinRates((prev) => {
        const nextRates: PrecisionWinRates = { ...prev };
        for (const f of finalised) {
          const cur = nextRates[f.contractType];
          nextRates[f.contractType] = {
            wins: cur.wins + (f.outcome === "WIN" ? 1 : 0),
            losses: cur.losses + (f.outcome === "LOSS" ? 1 : 0),
          };
        }
        return nextRates;
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
      const arr = ticks.length > MAX_TICKS ? ticks.slice(-MAX_TICKS) : [...ticks];
      ticksRef.current[sym] = arr;
      digitsRef.current[sym] = arr.map((t) => lastDigit(t.price));
      scheduleRecompute();
    });
    const unsubTick = derivBus.onTick((sym, tick) => {
      if (!SCAN_SET.has(sym)) return;
      const arr = ticksRef.current[sym] ?? [];
      arr.push(tick);
      if (arr.length > MAX_TICKS) arr.splice(0, arr.length - MAX_TICKS);
      ticksRef.current[sym] = arr;
      const dArr = digitsRef.current[sym] ?? [];
      dArr.push(lastDigit(tick.price));
      if (dArr.length > MAX_TICKS) dArr.splice(0, dArr.length - MAX_TICKS);
      digitsRef.current[sym] = dArr;
      resolvePending(sym, tick.price);
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
    activeSignals,
    nearMisses,
    history,
    winRates,
    status,
    settings,
    scannedCount: SCAN_SYMBOLS.length,
    contractCount: PRECISION_CONTRACTS.filter((c) => settings.enabledContracts[c]).length,
  };
}
