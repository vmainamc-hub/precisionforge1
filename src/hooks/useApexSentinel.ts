// APEX SENTINEL — React binding to the continuous intelligence core.
// The core runs regardless of render cadence; this hook only samples it on a
// throttled interval so a busy engine can never stall the UI.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apexCore, APEX_UNIVERSE } from "@/lib/apex/core";
import {
  DEFAULT_SCAN_OPTIONS,
  globalDanger,
  rankOpportunities,
  scanNow,
  type ScanOptions,
} from "@/lib/apex/scan";
import type { MarketIntel, RankedOpportunity, ScanResult } from "@/lib/apex/types";
import { memoryStats } from "@/lib/apex/memory";

const UI_REFRESH_MS = 1000;

export interface ApexState {
  status: "idle" | "connecting" | "live" | "error";
  intels: MarketIntel[];
  ranked: RankedOpportunity[];
  online: number;
  total: number;
  globalDanger: number;
  globalDangerLabel: "CALM" | "ELEVATED" | "HOSTILE";
  memory: { states: number; observations: number; updatedAt: number };
  scan: ScanResult | null;
  scanning: boolean;
  runScan: () => ScanResult;
}

export function useApexSentinel(options: ScanOptions = DEFAULT_SCAN_OPTIONS): ApexState {
  const [tick, setTick] = useState(0);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const unsub = apexCore.subscribe(() => {});
    const id = setInterval(() => setTick((t) => t + 1), UI_REFRESH_MS);
    setTick((t) => t + 1);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);

  const intels = useMemo(() => apexCore.getAll(), [tick]);
  const ranked = useMemo(() => rankOpportunities(intels, optsRef.current).ranked, [intels]);
  const gd = useMemo(() => globalDanger(intels), [intels]);
  const memory = useMemo(() => memoryStats(), [tick]);

  const runScan = useCallback(() => {
    setScanning(true);
    const result = scanNow(apexCore.getAll(), optsRef.current);
    setScan(result);
    // Immediate by design: the state is already maintained continuously.
    setTimeout(() => setScanning(false), 220);
    return result;
  }, []);

  return {
    status:
      apexCore.getStatus() === "live"
        ? "live"
        : apexCore.getStatus() === "connecting"
          ? "connecting"
          : apexCore.getStatus() === "error"
            ? "error"
            : "idle",
    intels,
    ranked,
    online: intels.filter((i) => i.dataState === "OK").length,
    total: APEX_UNIVERSE.length,
    globalDanger: gd,
    globalDangerLabel: gd < 35 ? "CALM" : gd < 65 ? "ELEVATED" : "HOSTILE",
    memory,
    scan,
    scanning,
    runScan,
  };
}
