import {
  marketIntel,
  riseFallStats,
  evenOddStats,
  overUnderStats,
  type Tick,
} from "@/lib/analytics";
import { Panel } from "../Panel";
import {
  Sparkles,
  AlertTriangle,
  Activity,
  Target,
  TrendingDown,
  TrendingUp,
  Crosshair,
  Radar,
  Volume2,
  ShieldCheck,
} from "lucide-react";

function ManipGate({ manipulation }: { manipulation: number }) {
  const mp = manipulation * 100;
  const pass = mp < 20;
  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${pass ? "bg-[var(--bull)]/15 text-[var(--bull)]" : "bg-[var(--bear)]/15 text-[var(--bear)]"}`}
    >
      <ShieldCheck size={9} /> manip gate {pass ? "PASS" : "FAIL"} · {mp.toFixed(1)}%/20%
    </span>
  );
}
import { useAlertSound } from "@/hooks/useAlertSound";
import type { Under7Match, Over2Match, BotGate } from "@/hooks/useMultiVolatilityScan";

function BotGateBadges({
  g,
  pred,
  dir = "UNDER",
}: {
  g: BotGate;
  pred: number;
  dir?: "UNDER" | "OVER";
}) {
  const Item = ({ ok, label }: { ok: boolean; label: string }) => (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] tabular ${
        ok ? "bg-[var(--bull)]/15 text-[var(--bull)]" : "bg-[var(--bear)]/15 text-[var(--bear)]"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
  const isOver = dir === "OVER";
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--accent)]/15 text-[var(--accent)] uppercase tracking-wider">
        Bot {dir === "OVER" ? "O" : "U"}
        {pred} Gates {isOver ? "(secondary)" : ""}
      </span>
      <Item ok={g.streakOk} label={`streak ${isOver ? "≤4" : `≥${pred === 7 ? 5 : 6}`}`} />
      <Item
        ok={g.histOk}
        label={`hist50 ${g.histPct.toFixed(0)}%≤${pred === 7 ? 25 : pred === 6 ? 20 : 25}%`}
      />
      <Item
        ok={g.winOk}
        label={`prob40 ${g.winPct.toFixed(0)}%≥${pred === 7 ? 75 : pred === 6 ? 78 : 75}%`}
      />
      <Item ok={g.vetoOk} label={`veto last${isOver ? "≥5" : `≤${pred === 7 ? 4 : 3}`}`} />
    </div>
  );
}

export function SignalFeed({
  ticks,
  scanMatches = [],
  over2Matches = [],
  over2History = [],
  under7History = [],
  scanStatus,
  scannedCount = 0,
}: {
  ticks: Tick[];
  scanMatches?: Under7Match[];
  over2Matches?: Over2Match[];
  over2History?: Over2Match[];
  under7History?: Under7Match[];
  scanStatus?: string;
  scannedCount?: number;
}) {
  const matchKey = scanMatches
    .map((m) => m.symbol)
    .sort()
    .join(",");
  const o2MatchKey = over2Matches
    .map((m) => m.symbol)
    .sort()
    .join(",");
  useAlertSound(matchKey ? `u7:${matchKey}` : "");
  useAlertSound(o2MatchKey ? `o2:${o2MatchKey}` : "");

  const m = marketIntel(ticks);
  const rf = riseFallStats(ticks);
  const eo = evenOddStats(ticks);
  const ou7 = overUnderStats(ticks, 7);

  const signals: {
    icon: any;
    title: string;
    desc: string;
    tone: string;
    conf: number;
    entry?: {
      contract: string;
      price: number;
      lastDigit: number;
      ticks: number;
      stakePct: number;
      payout: number;
    };
  }[] = [];
  if (ou7.pUnder > 0.7 && m.manipulation < 0.2) {
    const total = Math.max(1, ticks.length);
    const p0 = ou7.freq[0] / total;
    const p1 = ou7.freq[1] / total;
    const p9 = ou7.freq[9] / total;
    if (p0 < 0.095 && p1 < 0.095 && p9 >= 0.105) {
      const lastTick = ticks[ticks.length - 1];
      const entryPrice = lastTick?.price ?? 0;
      const lastDigit = Math.abs(Math.round(entryPrice * 100)) % 10;
      const ticksWindow = 5;
      const stakePct = Math.min(5, Math.max(1, Math.round(((ou7.pUnder - 0.7) * 100) / 2 + 1)));
      signals.push({
        icon: TrendingDown,
        title: "Under 7 Edge Detected",
        desc: `Under ${(ou7.pUnder * 100).toFixed(1)}% · manipulation ${(m.manipulation * 100).toFixed(0)}% · digit 0 ${(p0 * 100).toFixed(1)}% · digit 1 ${(p1 * 100).toFixed(1)}% · digit 9 ${(p9 * 100).toFixed(1)}%. Strong statistical edge.`,
        tone: "bull",
        conf: Math.min(98, Math.round(ou7.pUnder * 100 + 18)),
        entry: {
          contract: "DIGITUNDER 7",
          price: entryPrice,
          lastDigit,
          ticks: ticksWindow,
          stakePct,
          payout: 1.45,
        },
      });
    }
  }
  if (m.edgeScore > 55)
    signals.push({
      icon: Target,
      title: "High-Probability Setup",
      desc: `Edge score ${m.edgeScore}/100 with aligned momentum.`,
      tone: "bull",
      conf: Math.min(98, m.edgeScore + 10),
    });
  if (m.reversalZone)
    signals.push({
      icon: AlertTriangle,
      title: "Reversal Zone Active",
      desc: `RSI ${rf.rsi.toFixed(0)} + ${eo.streak}-streak ${eo.streakType}. Counter-trend opportunity.`,
      tone: "bear",
      conf: 78,
    });
  if (rf.acceleration)
    signals.push({
      icon: Activity,
      title: "Momentum Acceleration",
      desc: `MACD histogram expanding ${rf.macd.hist > 0 ? "bullish" : "bearish"}.`,
      tone: rf.macd.hist > 0 ? "bull" : "bear",
      conf: 71,
    });
  if (eo.streak >= 5)
    signals.push({
      icon: Sparkles,
      title: `${eo.streakType.toUpperCase()} Cluster`,
      desc: `${eo.streak} consecutive ${eo.streakType}. Continuation ${(eo.continuation * 100).toFixed(0)}%.`,
      tone: "warn",
      conf: Math.round(eo.continuation * 100),
    });
  if (m.manipulation > 0.5)
    signals.push({
      icon: AlertTriangle,
      title: "Anomalous Distribution",
      desc: "Digit frequency deviating from uniform — possible smart-money flow.",
      tone: "warn",
      conf: Math.round(m.manipulation * 100),
    });
  if (!signals.length)
    signals.push({
      icon: Activity,
      title: "Market Neutral",
      desc: "No high-conviction setups. Stand aside.",
      tone: "neon",
      conf: 50,
    });

  return (
    <Panel
      title="AI Signal Feed"
      subtitle="Real-time edge detection · 1000-tick window"
      accent="cyan"
    >
      <div className="mb-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/8 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Radar size={14} className={scanStatus === "live" ? "pulse-dot" : ""} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Under 7 · Multi-Market Scanner
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider opacity-70 flex items-center gap-1">
            <Volume2 size={11} /> {scanStatus ?? "idle"} · {scannedCount} markets
          </span>
        </div>
        {scanMatches.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-foreground/60">
            No volatility currently meets all Under 7 conditions. Scanning…
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {scanMatches.map((m) => (
              <li
                key={m.symbol}
                className="rounded-md border border-[var(--bull)]/40 bg-[var(--bull)]/8 px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--bull)]">{m.name}</span>
                  <span className="tabular text-[10px] opacity-80">
                    {m.conf}% conf · stake {m.stakePct}%
                  </span>
                </div>
                <div className="mt-0.5 grid grid-cols-2 gap-x-3 text-[10px] tabular text-foreground/75">
                  <span>Under {(m.pUnder * 100).toFixed(1)}%</span>
                  <span>Manip {(m.manipulation * 100).toFixed(0)}%</span>
                  <span>
                    d0 {(m.p0 * 100).toFixed(1)}% · d1 {(m.p1 * 100).toFixed(1)}%
                  </span>
                  <span>d9 {(m.p9 * 100).toFixed(1)}%</span>
                  <span>Entry {m.entryPrice.toFixed(4)}</span>
                  <span>Last digit {m.lastDigit}</span>
                </div>
                <ManipGate manipulation={m.manipulation} />
                <BotGateBadges g={m.botGate} pred={7} />
              </li>
            ))}
          </ul>
        )}

        {under7History.length > 0 && (
          <div className="mt-2 border-t border-[var(--accent)]/20 pt-2">
            <div className="text-[9px] uppercase tracking-wider opacity-60 mb-1">
              Recent signal history
            </div>
            <ul className="space-y-0.5 max-h-24 overflow-y-auto">
              {under7History.slice(0, 8).map((h, i) => (
                <li
                  key={`${h.symbol}-${h.ts}-${i}`}
                  className="flex items-center justify-between text-[10px] tabular opacity-80"
                >
                  <span>
                    {new Date(h.ts).toLocaleTimeString()} · {h.name}
                  </span>
                  <span className="text-[var(--accent)]">UNDER 7 · {h.conf}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Under 6 recovery scanner removed per user request */}

      {/* OVER 2 Strategy Scanner (mirror of UNDER 7) */}
      <div className="mb-3 rounded-lg border border-[var(--bull)]/40 bg-[var(--bull)]/8 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[var(--bull)]">
            <TrendingUp size={14} className={scanStatus === "live" ? "pulse-dot" : ""} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Over 2 · Strategy Scanner
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider opacity-70 flex items-center gap-1">
            <Volume2 size={11} /> {scanStatus ?? "idle"} · mirror of Under 7 · manip&lt;20%
          </span>
        </div>

        {over2Matches.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-foreground/60">
            No volatility currently meets Over 2 conditions. Scanning…
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {over2Matches.map((m) => {
              const maxF = Math.max(...m.freq, 1);
              return (
                <li
                  key={m.symbol}
                  className="rounded-md border border-[var(--bull)]/40 bg-[var(--bull)]/8 px-2.5 py-1.5 anim-pop"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--bull)]">{m.name} · OVER 2</span>
                    <span className="tabular text-[10px] opacity-80">
                      {m.conf}% conf · {new Date(m.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-0.5 grid grid-cols-2 gap-x-3 text-[10px] tabular text-foreground/75">
                    <span>Over 2 {(m.pOver * 100).toFixed(1)}%</span>
                    <span>Manip {(m.manipulation * 100).toFixed(1)}%</span>
                    <span>
                      d0 {(m.p0 * 100).toFixed(1)}% · d1 {(m.p1 * 100).toFixed(1)}% · d2{" "}
                      {(m.p2 * 100).toFixed(1)}%
                    </span>
                    <span>
                      d7 {(m.p7 * 100).toFixed(1)}% · d8 {(m.p8 * 100).toFixed(1)}% · d9{" "}
                      {(m.p9 * 100).toFixed(1)}%
                    </span>
                    <span>Entry {m.entryPrice.toFixed(4)}</span>
                    <span>Last digit {m.lastDigit}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-10 gap-0.5">
                    {m.freq.map((f, d) => (
                      <div key={d} className="text-center">
                        <div className="h-6 flex items-end justify-center">
                          <div
                            className={`w-full rounded-sm ${d <= 2 ? "bg-[var(--bull)]/70" : d >= 7 ? "bg-[var(--bear)]/60" : "bg-foreground/20"}`}
                            style={{ height: `${(f / maxF) * 100}%` }}
                          />
                        </div>
                        <div className="text-[8px] tabular opacity-70">{d}</div>
                      </div>
                    ))}
                  </div>
                  <ManipGate manipulation={m.manipulation} />
                  <BotGateBadges g={m.botGate} pred={2} dir="OVER" />
                </li>
              );
            })}
          </ul>
        )}

        {over2History.length > 0 && (
          <div className="mt-2 border-t border-[var(--bull)]/20 pt-2">
            <div className="text-[9px] uppercase tracking-wider opacity-60 mb-1">
              Recent signal history
            </div>
            <ul className="space-y-0.5 max-h-24 overflow-y-auto">
              {over2History.slice(0, 8).map((h, i) => (
                <li
                  key={`${h.symbol}-${h.ts}-${i}`}
                  className="flex items-center justify-between text-[10px] tabular opacity-80"
                >
                  <span>
                    {new Date(h.ts).toLocaleTimeString()} · {h.name}
                  </span>
                  <span className="text-[var(--bull)]">OVER 2 · {h.conf}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {signals.map((s, i) => {
          const Icon = s.icon;
          const color =
            s.tone === "bull"
              ? "text-[var(--bull)] border-[var(--bull)]/40 bg-[var(--bull)]/8"
              : s.tone === "bear"
                ? "text-[var(--bear)] border-[var(--bear)]/40 bg-[var(--bear)]/8"
                : s.tone === "warn"
                  ? "text-[var(--warn)] border-[var(--warn)]/40 bg-[var(--warn)]/8"
                  : "text-[var(--neon)] border-[var(--neon)]/40 bg-[var(--neon)]/8";
          return (
            <li key={i} className={`rounded-lg border px-3 py-2.5 ${color}`}>
              <div className="flex items-start gap-3">
                <Icon size={16} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{s.title}</span>
                    <span className="text-[10px] uppercase tracking-wider tabular opacity-80">
                      {s.conf}% conf
                    </span>
                  </div>
                  <p className="text-xs text-foreground/70 mt-0.5">{s.desc}</p>
                  {s.entry && (
                    <div className="mt-2 rounded-md border border-[var(--bull)]/30 bg-[var(--bull)]/5 p-2">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold opacity-90">
                        <Crosshair size={11} /> Entry Point Confirmed
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular">
                        <div className="flex justify-between">
                          <span className="opacity-70">Contract</span>
                          <span className="font-semibold">{s.entry.contract}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Duration</span>
                          <span className="font-semibold">{s.entry.ticks} ticks</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Entry</span>
                          <span className="font-semibold">{s.entry.price.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Last digit</span>
                          <span className="font-semibold">{s.entry.lastDigit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Stake</span>
                          <span className="font-semibold">{s.entry.stakePct}% bal</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-70">Payout</span>
                          <span className="font-semibold">×{s.entry.payout.toFixed(2)}</span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] opacity-75">
                        Enter NOW on next tick · exit after {s.entry.ticks} ticks · abort if a digit
                        ≥ 7 prints.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
