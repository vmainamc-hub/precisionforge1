import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SYMBOLS } from "@/lib/deriv-ws";
import { useDerivTicks } from "@/hooks/useDerivTicks";
import { TickChart } from "@/components/TickChart";
import { DigitStats } from "@/components/DigitStats";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "PrecisionEdge — Live Deriv Tick Terminal" },
      {
        name: "description",
        content:
          "Live Deriv WebSocket tick streaming for volatility indices with real-time price action, digit distribution and market stats.",
      },
      { property: "og:title", content: "PrecisionEdge — Live Deriv Tick Terminal" },
      {
        property: "og:description",
        content:
          "Stream real-time Deriv ticks, track digit distribution and volatility stats in one precision terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terminal,
});

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting",
  open: "Live",
  closed: "Reconnecting",
  error: "Connection error",
};

function Terminal() {
  const [symbol, setSymbol] = useState<string>(SYMBOLS[0].symbol);
  const { ticks, status, pipSize, error } = useDerivTicks(symbol);

  const latest = ticks[ticks.length - 1];
  const prev = ticks[ticks.length - 2];
  const delta = latest && prev ? latest.quote - prev.quote : 0;
  const up = delta >= 0;

  const stats = useMemo(() => {
    if (ticks.length < 2) return null;
    const q = ticks.map((t) => t.quote);
    const first = q[0]!;
    const last = q[q.length - 1]!;
    const changes = q.slice(1).map((v, i) => v - q[i]!);
    const upCount = changes.filter((c) => c > 0).length;
    const mean = q.reduce((a, b) => a + b, 0) / q.length;
    const sd = Math.sqrt(q.reduce((a, b) => a + (b - mean) ** 2, 0) / q.length);
    return {
      changePct: ((last - first) / first) * 100,
      high: Math.max(...q),
      low: Math.min(...q),
      upRatio: (upCount / changes.length) * 100,
      volatility: (sd / mean) * 100,
      count: q.length,
    };
  }, [ticks]);

  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const lastEpoch = useRef<number | null>(null);
  useEffect(() => {
    if (!latest || latest.epoch === lastEpoch.current) return;
    lastEpoch.current = latest.epoch;
    setFlash(up ? "up" : "down");
    const id = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(id);
  }, [latest, up]);

  const active = SYMBOLS.find((s) => s.symbol === symbol);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            Precision<span className="text-primary">Edge</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Live tick terminal streaming directly from the Deriv WebSocket API
          </p>
        </div>
        <div className="panel flex items-center gap-2 px-3 py-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              status === "open"
                ? "animate-pulse-dot bg-success"
                : status === "error"
                  ? "bg-danger"
                  : "bg-warning"
            }`}
          />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {STATUS_LABEL[status]}
          </span>
        </div>
      </header>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {SYMBOLS.map((s) => (
          <button
            key={s.symbol}
            onClick={() => setSymbol(s.symbol)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              s.symbol === symbol
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.name}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="panel p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">{active?.name}</h2>
              <div
                className={`tabular mt-1 rounded-md px-2 text-3xl font-bold sm:text-4xl ${
                  up ? "text-success" : "text-danger"
                } ${flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : ""}`}
              >
                {latest ? latest.quote.toFixed(pipSize) : "—"}
              </div>
            </div>
            <div className="tabular text-right text-sm">
              <div className={up ? "text-success" : "text-danger"}>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(pipSize)}
              </div>
              <div className="text-muted-foreground">
                {latest ? new Date(latest.epoch * 1000).toLocaleTimeString() : "--:--:--"}
              </div>
            </div>
          </div>
          <TickChart ticks={ticks} pipSize={pipSize} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Stat
            label="Session change"
            value={stats ? `${stats.changePct.toFixed(3)}%` : "—"}
            tone={stats && stats.changePct >= 0 ? "up" : "down"}
          />
          <Stat
            label="High / Low"
            value={stats ? `${stats.high.toFixed(pipSize)} / ${stats.low.toFixed(pipSize)}` : "—"}
          />
          <Stat label="Rise ratio" value={stats ? `${stats.upRatio.toFixed(1)}%` : "—"} />
          <Stat label="Volatility (σ)" value={stats ? `${stats.volatility.toFixed(4)}%` : "—"} />
          <Stat label="Ticks buffered" value={stats ? String(stats.count) : "0"} />
        </div>
      </section>

      <section className="panel mt-4 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Last-digit distribution · last {ticks.length} ticks
        </h2>
        <DigitStats ticks={ticks} pipSize={pipSize} />
      </section>

      <section className="panel mt-4 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tick stream</h2>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Time</th>
                <th className="py-2 font-medium">Quote</th>
                <th className="py-2 text-right font-medium">Move</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...ticks]
                .slice(-40)
                .reverse()
                .map((t, i, arr) => {
                  const p = arr[i + 1];
                  const d = p ? t.quote - p.quote : 0;
                  return (
                    <tr key={`${t.epoch}-${i}`} className="border-t border-border/60">
                      <td className="py-1.5 text-muted-foreground">
                        {new Date(t.epoch * 1000).toLocaleTimeString()}
                      </td>
                      <td className="py-1.5">{t.quote.toFixed(pipSize)}</td>
                      <td
                        className={`py-1.5 text-right ${d >= 0 ? "text-success" : "text-danger"}`}
                      >
                        {d >= 0 ? "+" : ""}
                        {d.toFixed(pipSize)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {ticks.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Awaiting tick data…</p>
          )}
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Market data streamed live from Deriv (api.derivws.com). For informational purposes only.
      </footer>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="panel p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`tabular mt-1 text-lg font-semibold ${
          tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
