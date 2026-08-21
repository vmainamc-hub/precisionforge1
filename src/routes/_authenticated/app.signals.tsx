import { createFileRoute } from "@tanstack/react-router";
import { useStream } from "@/lib/stream-context";
import { SignalFeed } from "@/components/modules/SignalFeed";
import { AdvancedScannerFeed } from "@/components/modules/AdvancedScannerFeed";

export const Route = createFileRoute("/_authenticated/app/signals")({
  head: () => ({ meta: [{ title: "Signals — Precision Edge" }] }),
  component: SignalsPage,
});

function SignalsPage() {
  const s = useStream();
  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold neon-text">Live Signal Feed</h1>
        <p className="text-sm text-muted-foreground">
          High-confidence trade signals from the AI engine
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <SignalFeed
            ticks={s.view}
            scanMatches={s.scan.matches}
            over2Matches={s.scan.over2Matches}
            over2History={s.scan.over2History}
            scanStatus={s.scan.status}
            scannedCount={s.scan.scannedCount}
          />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
