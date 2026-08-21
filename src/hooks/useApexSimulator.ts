// Samples the continuous per-market contract simulator on a throttled cadence
// so a busy paper-trading ledger can never stall the terminal UI. The engine
// itself runs at application level — this hook is only a view of it.
import { useEffect, useMemo, useState } from "react";
import { apexSimulator } from "@/lib/apex/simulator";

const REFRESH_MS = 1000;

export function useApexSimulator(ledgerLimit = 40) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    apexSimulator.restore();
    const unsub = apexSimulator.subscribe(() => {});
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    setTick((t) => t + 1);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);

  return useMemo(
    () => ({
      config: apexSimulator.getConfig(),
      overall: apexSimulator.overall(),
      breakdown: apexSimulator.breakdown(),
      byMarket: apexSimulator.byMarket(),
      ledger: apexSimulator.getLedger(ledgerLimit),
      open: apexSimulator.getOpen(),
      /** Live simulator state for EVERY valid market, trading or not. */
      states: apexSimulator.getStates(),
      marketLedger: (symbol: string, limit = 100) => apexSimulator.getMarketLedger(symbol, limit),
      breakdownFor: (symbol: string) => apexSimulator.breakdown(symbol),
      reset: () => apexSimulator.reset(),
    }),
    [tick, ledgerLimit],
  );
}
