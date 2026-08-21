import { createFileRoute } from "@tanstack/react-router";
import { useStream } from "@/lib/stream-context";
import { AdvancedScannerFeed } from "@/components/modules/AdvancedScannerFeed";

export const Route = createFileRoute("/_authenticated/app/scanner/volatility")({
  component: VolatilityPage,
});

function VolatilityPage() {
  const s = useStream();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AdvancedScannerFeed
        type="OVER2"
        signals={s.advScan.over2Signals}
        history={s.advScan.over2History}
        winRate={s.advScan.over2WinRate}
        status={s.advScan.status}
        scannedCount={s.advScan.scannedCount}
      />
      <AdvancedScannerFeed
        type="UNDER7"
        signals={s.advScan.under7Signals}
        history={s.advScan.under7History}
        winRate={s.advScan.under7WinRate}
        status={s.advScan.status}
        scannedCount={s.advScan.scannedCount}
      />
    </div>
  );
}
