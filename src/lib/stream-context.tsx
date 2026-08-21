// Shared live market stream + scanner context used by every /app/* page.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useDerivStream, DERIV_SYMBOLS, type DerivSymbol } from "@/hooks/useDerivStream";
import { useMultiVolatilityScan } from "@/hooks/useMultiVolatilityScan";
import { useAdvancedOverUnderScan } from "@/hooks/useAdvancedOverUnderScan";
import { useMultiMarketPrecisionScan } from "@/hooks/useMultiMarketPrecisionScan";
import type { Tick } from "@/lib/analytics";

type Ctx = {
  symbol: string;
  setSymbol: (s: string) => void;
  running: boolean;
  setRunning: (r: boolean) => void;
  windowSize: number;
  setWindowSize: (n: number) => void;
  threshold: number;
  setThreshold: (n: number) => void;
  ticks: Tick[];
  view: Tick[];
  status: string;
  error: string | null;
  scan: ReturnType<typeof useMultiVolatilityScan>;
  advScan: ReturnType<typeof useAdvancedOverUnderScan>;
  precisionScan: ReturnType<typeof useMultiMarketPrecisionScan>;
  symbols: DerivSymbol[];
};

const StreamCtx = createContext<Ctx | null>(null);

// Routes that actually render scanner output. Everywhere else the three
// universe-wide scanners are pure CPU burn — they used to run on /journal,
// /news, /settings, /admin and /history too.
const SCANNER_ROUTES = [
  "/app/dashboard",
  "/app/scanner",
  "/app/signals",
  "/app/trading",
  "/app/auto-trading",
  "/app/bot-builder",
  "/app/analytics",
];

export function StreamProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState("R_100");
  const [running, setRunning] = useState(true);
  const [windowSize, setWindowSize] = useState(1000);
  const [threshold, setThreshold] = useState(5);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scannersEnabled =
    running && SCANNER_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const deriv = useDerivStream(symbol, running);
  const scan = useMultiVolatilityScan(scannersEnabled);
  const advScan = useAdvancedOverUnderScan(scannersEnabled);
  const precisionScan = useMultiMarketPrecisionScan(scannersEnabled);
  // Avoid a second 1000-element clone per tick: when the window covers the
  // whole buffer, reuse the same array reference.
  const view = useMemo(
    () => (deriv.ticks.length <= windowSize ? deriv.ticks : deriv.ticks.slice(-windowSize)),
    [deriv.ticks, windowSize],
  );

  // CRITICAL: without useMemo this object is a new identity on every render,
  // so every /app/* consumer re-rendered on every tick of every market.
  const value = useMemo<Ctx>(
    () => ({
      symbol,
      setSymbol,
      running,
      setRunning,
      windowSize,
      setWindowSize,
      threshold,
      setThreshold,
      ticks: deriv.ticks,
      view,
      status: deriv.status,
      error: deriv.error,
      scan,
      advScan,
      precisionScan,
      symbols: DERIV_SYMBOLS,
    }),
    [
      symbol,
      running,
      windowSize,
      threshold,
      deriv.ticks,
      view,
      deriv.status,
      deriv.error,
      scan,
      advScan,
      precisionScan,
    ],
  );
  return <StreamCtx.Provider value={value}>{children}</StreamCtx.Provider>;
}

export function useStream() {
  const v = useContext(StreamCtx);
  if (!v) throw new Error("useStream must be used inside StreamProvider");
  return v;
}
