import { createFileRoute } from "@tanstack/react-router";
import { lastDigit } from "@/lib/analytics";
import { useStream } from "@/lib/stream-context";
import { Panel } from "@/components/Panel";
import { PriceChart } from "@/components/PriceChart";
import { SignalFeed } from "@/components/modules/SignalFeed";
import { PrecisionMultiMarketFeed } from "@/components/modules/PrecisionMultiMarketFeed";
import { DigitPercentages } from "@/components/modules/DigitPercentages";
import { DigitPressure } from "@/components/modules/DigitPressure";
import { MarketIntel } from "@/components/modules/MarketIntel";
import { Activity, Cpu, BarChart3, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Precision Edge" }] }),
  component: Dashboard,
});

function Dashboard() {
  const s = useStream();
  const last = s.view[s.view.length - 1];
  const prev = s.view[s.view.length - 2] ?? last;
  const change = last ? ((last.price - prev.price) / prev.price) * 100 : 0;
  const digit = last ? lastDigit(last.price) : 0;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Last price" value={last?.price.toFixed(4) ?? "—"} />
        <Metric
          label="Δ%"
          value={`${change >= 0 ? "+" : ""}${change.toFixed(3)}%`}
          tone={change >= 0 ? "bull" : "bear"}
        />
        <Metric label="Last digit" value={String(digit)} tone="neon" />
        <Metric label="Buffer" value={s.ticks.length.toLocaleString()} />
      </div>

      {s.view.length === 0 ? (
        <div className="glass rounded-lg p-10 text-center text-sm text-muted-foreground">
          <Radio size={18} className="inline mr-2 text-[var(--neon)] pulse-dot" />
          Connecting to Deriv · {s.symbol}…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel
                title="Live Market Stream"
                subtitle={`Deriv WS · ${s.symbols.find((x) => x.symbol === s.symbol)?.name ?? s.symbol}`}
                accent="cyan"
              >
                <PriceChart ticks={s.view} />
              </Panel>
            </div>
            <SignalFeed
              ticks={s.view}
              scanMatches={s.scan.matches}
              over2Matches={s.scan.over2Matches}
              over2History={s.scan.over2History}
              under7History={s.scan.under7History}
              scanStatus={s.scan.status}
              scannedCount={s.scan.scannedCount}
            />
          </div>

          <PrecisionMultiMarketFeed
            signals={s.precisionScan.activeSignals}
            nearMisses={s.precisionScan.nearMisses}
            history={s.precisionScan.history}
            winRates={s.precisionScan.winRates}
            status={s.precisionScan.status}
            scannedCount={s.precisionScan.scannedCount}
            contractCount={s.precisionScan.contractCount}
          />

          <DigitPercentages ticks={s.ticks} symbol={s.symbol} />
          <DigitPressure ticks={s.ticks} />
          <MarketIntel ticks={s.view} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <FooterStat
              icon={<Cpu size={14} />}
              label="Models active"
              value="6"
              hint="Markov · Bayes · MC · RSI · MACD · χ²"
            />
            <FooterStat
              icon={<BarChart3 size={14} />}
              label="Data points"
              value={s.ticks.length.toLocaleString()}
              hint="rolling buffer 1k"
            />
            <FooterStat
              icon={<Activity size={14} />}
              label="Session win-rate"
              value="—"
              hint="phase 2"
            />
            <FooterStat
              icon={<Radio size={14} />}
              label="Markets scanned"
              value={String(s.scan.scannedCount)}
              hint="live"
            />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear" | "neon";
}) {
  const color =
    tone === "bull"
      ? "text-[var(--bull)]"
      : tone === "bear"
        ? "text-[var(--bear)]"
        : tone === "neon"
          ? "text-[var(--neon)]"
          : "text-foreground";
  return (
    <div className="glass rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`tabular text-xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function FooterStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass rounded-lg px-3 py-2.5 flex items-center gap-3">
      <div className="text-[var(--neon)]">{icon}</div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="tabular text-sm font-semibold">{value}</div>
      </div>
      <div className="text-[10px] text-muted-foreground text-right max-w-[140px]">{hint}</div>
    </div>
  );
}
