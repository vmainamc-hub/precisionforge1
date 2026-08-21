import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Wifi,
  Activity,
  Radar,
  Settings as SettingsIcon,
  ShieldOff,
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  AlertTriangle,
  Clock,
  Bell,
  BellOff,
  Scale,
} from "lucide-react";
import { usePrecisionTrend, requestSignalPermission } from "@/hooks/usePrecisionTrend";
import { useAlertSound } from "@/hooks/useAlertSound";
import { DEFAULT_TREND_SETTINGS, type TrendSettings } from "@/lib/precision-trend/engine";
import type { MarketReport, ReasoningModule } from "@/lib/precision-trend/types";
import { Panel, Bar } from "@/components/Panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/precision-trend")({
  head: () => ({
    meta: [
      { title: "Precision Trend AI — Market Mind Engine" },
      {
        name: "description",
        content:
          "An AI market analyst that reasons across state, trend, momentum, volatility, psychology and forward scenarios before recommending Rise or Fall.",
      },
    ],
  }),
  component: PrecisionTrend,
});

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toISOString().slice(0, 19).replace("T", " ");
}

const STORAGE_KEY = "precision-trend-settings-v3";
function loadSettings(): TrendSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TREND_SETTINGS;
    return { ...DEFAULT_TREND_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TREND_SETTINGS;
  }
}

function PrecisionTrend() {
  const [settings, setSettings] = useState<TrendSettings>(() =>
    typeof window === "undefined" ? DEFAULT_TREND_SETTINGS : loadSettings(),
  );
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  const patch = (p: Partial<TrendSettings>) => setSettings((s) => ({ ...s, ...p }));

  const scan = usePrecisionTrend(settings);
  const clock = useClock();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const live = scan.status === "live";
  const held = scan.held;
  useAlertSound(held ? `pt:${held.market}:${held.contract}:${held.createdAt}` : "");

  return (
    <div className="min-h-screen grid-bg text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/40 glass">
        <div className="max-w-[1800px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/app/precision-parity"
              className="grid place-items-center w-9 h-9 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="grid place-items-center w-11 h-11 rounded-xl bg-[var(--neon)]/15 border border-[var(--neon)]/30 text-[var(--neon)]">
              <Brain className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Precision Trend AI · V3
              </div>
              <h1 className="text-lg font-semibold text-foreground leading-tight truncate">
                Market Mind Engine
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">API</span>
              <span
                className={`flex items-center gap-1 font-semibold ${live ? "text-[var(--bull)]" : "text-warn"}`}
              >
                <Wifi className={`w-3.5 h-3.5 ${live ? "pulse-dot" : ""}`} />
                {live ? "LIVE" : scan.status.toUpperCase()}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs tabular text-muted-foreground">
              <Activity className="w-3.5 h-3.5" /> {scan.feedsReady}/{scan.feedsTotal}
            </div>
            <div className="hidden lg:block rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs tabular text-muted-foreground">
              {clock} UTC
            </div>
            <button
              onClick={scan.scanNow}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-[var(--neon)]/40 bg-[var(--neon)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--neon)] hover:bg-[var(--neon)]/20 transition-colors",
                scan.scanning && "neon-border",
              )}
            >
              <Radar className={cn("w-3.5 h-3.5", scan.scanning && "animate-spin")} /> Scan
            </button>
            <AlertsButton />
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-5 py-5 space-y-5">
        {held && scan.best ? (
          <RecommendationCard held={held} report={scan.best} />
        ) : (
          <NoTradeBanner scan={scan} settings={settings} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MarketRanking scan={scan} />
          <SignalHistory history={scan.history} />
        </div>

        {scan.best && <DebatePanel report={scan.best} />}
        {scan.best && <ReasoningGrid report={scan.best} />}
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        patch={patch}
        reset={() => setSettings(DEFAULT_TREND_SETTINGS)}
      />
    </div>
  );
}

// ─── Recommendation card ────────────────────────────────────────────────
function RecommendationCard({
  held,
  report,
}: {
  held: NonNullable<ReturnType<typeof usePrecisionTrend>["held"]>;
  report: MarketReport;
}) {
  const isRise = held.contract === "BUY_RISE";
  const tone = isRise ? "var(--bull)" : "var(--bear)";
  const m = report.mind;
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: `color-mix(in oklab, ${tone} 40%, transparent)`,
        background: `color-mix(in oklab, ${tone} 8%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Market Mind recommendation
          </div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <span
              className="text-3xl font-bold tabular flex items-center gap-2"
              style={{ color: tone }}
            >
              {isRise ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              {isRise ? "BUY RISE" : "BUY FALL"}
            </span>
            <span className="text-sm text-muted-foreground">on {held.name}</span>
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Confidence
            </div>
            <div className="text-3xl font-bold tabular" style={{ color: tone }}>
              {held.confidence.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              DBot entries
            </div>
            <div className="text-3xl font-bold tabular">~{m.suggestedConsecutiveEntries}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Metric label="State" value={m.state.replaceAll("_", " ")} />
        <Metric label="Timing" value={m.timing.replaceAll("_", " ")} />
        <Metric label="Persistence" value={`~${m.expectedPersistenceSeconds}s`} />
        <Metric label="Ranking score" value={m.score.toFixed(0)} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--neon)]">
            <Brain className="w-3 h-3" /> Analyst note
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{m.analystNote}</p>
          {m.caution && (
            <div className="mt-3 flex items-start gap-2 text-xs text-warn">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{m.caution}</span>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--neon)]">
            <Zap className="w-3 h-3" /> DBot execution
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {m.timing === "ENTER_NOW" ? "Enter now" : m.timing.replaceAll("_", " ").toLowerCase()}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Ideal window ~{Math.round(m.expectedPersistenceSeconds / 2)}s, expected persistence ~
            {m.expectedPersistenceSeconds}s.
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <MiniStat label="Consecutive" value={`≤ ${m.suggestedConsecutiveEntries}`} />
            <MiniStat label="Walk-forward" value={`${m.telemetry.virtualWinRate.toFixed(0)}%`} />
            <MiniStat
              label="Continuation"
              value={`${m.telemetry.continuationProbability.toFixed(0)}%`}
            />
            <MiniStat label="Reversal" value={`${m.telemetry.reversalProbability.toFixed(0)}%`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold capitalize">{value.toString().toLowerCase()}</div>
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded border border-border/30 bg-secondary/20 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  );
}

// ─── No-trade banner ────────────────────────────────────────────────────
function NoTradeBanner({
  scan,
  settings,
}: {
  scan: ReturnType<typeof usePrecisionTrend>;
  settings: TrendSettings;
}) {
  const reasons = new Map<string, number>();
  for (const m of scan.markets) reasons.set(m.mind.reason, (reasons.get(m.mind.reason) ?? 0) + 1);
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/[0.05] p-4">
      <div className="flex items-center gap-2 text-warn">
        <ShieldOff className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.25em]">
          Market Mind is waiting
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground leading-relaxed">
        The Market Mind Engine is currently monitoring every market but hasn't found a setup where
        state, trend, momentum, volatility and psychology all align with high enough confidence.
        Waiting is the correct decision.
      </p>
      {top.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Why the mind is waiting
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {top.map(([r, n], i) => (
              <li key={i}>
                • {r} <span className="text-muted-foreground/60">({n} markets)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        Strictness: {settings.strictness.toLowerCase()} · Confidence gate ≥ {settings.minConfidence}{" "}
        · Persistence ≥ {settings.minPersistenceSeconds}s.
      </div>
    </div>
  );
}

// ─── Market ranking ────────────────────────────────────────────────────
function MarketRanking({ scan }: { scan: ReturnType<typeof usePrecisionTrend> }) {
  const ranked = [...scan.markets].sort((a, b) => b.opportunityScore - a.opportunityScore);
  return (
    <Panel title="Market ranking" subtitle="Strongest opportunities first" accent="cyan">
      <div className="max-h-[480px] overflow-y-auto -mx-4">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-left px-4 py-2">Market</th>
              <th className="text-left px-2 py-2">State</th>
              <th className="text-right px-2 py-2">Score</th>
              <th className="text-right px-2 py-2">Grade</th>
              <th className="text-right px-4 py-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((m) => {
              const rec = m.mind.recommendation;
              const isRise = rec === "BUY_RISE";
              const isFall = rec === "BUY_FALL";
              const grade =
                m.opportunityScore >= 88
                  ? "Excellent"
                  : m.opportunityScore >= 80
                    ? "Very good"
                    : m.opportunityScore >= 70
                      ? "Good"
                      : m.opportunityScore >= 55
                        ? "Average"
                        : "Weak";
              return (
                <tr key={m.market} className="border-b border-border/20">
                  <td className="px-4 py-2 font-medium truncate max-w-[180px]">{m.name}</td>
                  <td className="px-2 py-2 text-muted-foreground capitalize">
                    {m.mind.state.replaceAll("_", " ").toLowerCase()}
                  </td>
                  <td className="px-2 py-2 text-right tabular font-semibold">
                    {m.opportunityScore.toFixed(0)}
                  </td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{grade}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                        isRise &&
                          m.mind.timing === "ENTER_NOW" &&
                          "bg-[var(--bull)]/15 text-[var(--bull)]",
                        isFall && m.mind.timing === "ENTER_NOW" && "bg-bear/15 text-bear",
                        rec === "NO_TRADE" && "bg-secondary text-muted-foreground",
                        rec !== "NO_TRADE" &&
                          m.mind.timing !== "ENTER_NOW" &&
                          "bg-warn/15 text-warn",
                      )}
                    >
                      {rec === "NO_TRADE"
                        ? "WAIT"
                        : m.mind.timing !== "ENTER_NOW"
                          ? m.mind.timing.split("_")[0]
                          : isRise
                            ? "RISE"
                            : "FALL"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Buffering ticks…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SignalHistory({ history }: { history: ReturnType<typeof usePrecisionTrend>["history"] }) {
  return (
    <Panel title="Signal history" subtitle="Executed recommendations (session)" accent="magenta">
      <div className="max-h-[480px] overflow-y-auto space-y-2">
        {history.length === 0 && (
          <div className="text-xs text-muted-foreground">No signals fired yet in this session.</div>
        )}
        {history.map((h, i) => {
          const isRise = h.contract === "BUY_RISE";
          return (
            <div key={i} className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1",
                      isRise ? "bg-[var(--bull)]/15 text-[var(--bull)]" : "bg-bear/15 text-bear",
                    )}
                  >
                    {isRise ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {isRise ? "RISE" : "FALL"}
                  </span>
                  <span className="font-medium">{h.name}</span>
                </div>
                <span className="tabular text-muted-foreground">
                  {h.confidence.toFixed(0)} · {new Date(h.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Reasoning grid ────────────────────────────────────────────────────
function ReasoningGrid({ report }: { report: MarketReport }) {
  const m = report.mind;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ModuleCard mod={m.modules.state} />
        <ModuleCard mod={m.modules.trend} />
        <ModuleCard mod={m.modules.momentum} />
        <ModuleCard mod={m.modules.volatility} />
        <ModuleCard mod={m.modules.psychology} />
        <ModuleCard mod={m.modules.scenario} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Scenario simulator" subtitle="Possible futures" accent="cyan">
          <div className="space-y-3 text-xs">
            {m.scenarios.scenarios.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold">{s.label}</span>
                  <span className="tabular font-semibold">{s.probability}%</span>
                </div>
                <Bar
                  value={s.probability}
                  tone={
                    s.favours === "BUY_RISE" ? "bull" : s.favours === "BUY_FALL" ? "bear" : "warn"
                  }
                />
                <p className="mt-1 text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Pressure & flow" subtitle="Who controls the market" accent="magenta">
          <div className="space-y-3 text-xs">
            <BarRow label="Buying pressure" value={m.telemetry.buyingPressure} tone="bull" />
            <BarRow label="Selling pressure" value={m.telemetry.sellingPressure} tone="bear" />
            <BarRow label="Continuation" value={m.telemetry.continuationProbability} tone="bull" />
            <BarRow label="Reversal" value={m.telemetry.reversalProbability} tone="bear" />
            <BarRow label="Environment quality" value={m.telemetry.volatilityQuality} tone="warn" />
            <BarRow label="Walk-forward win-rate" value={m.telemetry.virtualWinRate} tone="warn" />
          </div>
        </Panel>

        <Panel title="Contradictions" subtitle="Where the evidence disagrees" accent="amber">
          <div className="space-y-2 text-xs">
            {m.contradictions.length === 0 && (
              <div className="text-muted-foreground">
                No contradictions detected — the evidence points the same way.
              </div>
            )}
            {m.contradictions.map((c, i) => (
              <div key={i} className="rounded border border-border/30 bg-secondary/20 p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      "w-3.5 h-3.5",
                      c.severity === "SEVERE"
                        ? "text-bear"
                        : c.severity === "MODERATE"
                          ? "text-warn"
                          : "text-muted-foreground",
                    )}
                  />
                  <span className="font-semibold">{c.headline}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{c.resolution}</div>
              </div>
            ))}
            <div className="pt-2 flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3 h-3" /> Timing verdict:{" "}
              <span className="font-semibold text-foreground">
                {m.timing.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ModuleCard({ mod }: { mod: ReasoningModule }) {
  const tone =
    mod.verdict === "BULLISH"
      ? "var(--bull)"
      : mod.verdict === "BEARISH"
        ? "var(--bear)"
        : mod.verdict === "BLOCK"
          ? "var(--warn, hsl(38 92% 55%))"
          : "hsl(var(--muted-foreground))";
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          {mod.name}
        </div>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: `color-mix(in oklab, ${tone} 15%, transparent)`, color: tone }}
        >
          {mod.verdict.toLowerCase()}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{mod.headline}</div>
      <div className="mt-2">
        <Bar
          value={mod.strength}
          tone={mod.verdict === "BULLISH" ? "bull" : mod.verdict === "BEARISH" ? "bear" : "warn"}
        />
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {mod.notes.map((n, i) => (
          <li key={i}>• {n}</li>
        ))}
        {mod.notes.length === 0 && <li>No observations.</li>}
      </ul>
    </div>
  );
}

function BarRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "bull" | "bear" | "warn";
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-semibold">{value.toFixed(0)}%</span>
      </div>
      <Bar value={value} tone={tone} />
    </div>
  );
}

// ─── Settings drawer ────────────────────────────────────────────────────
function SettingsDrawer({
  open,
  onOpenChange,
  settings,
  patch,
  reset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: TrendSettings;
  patch: (p: Partial<TrendSettings>) => void;
  reset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Market Mind settings</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-5 text-sm">
          <SwitchRow
            label="Auto scan"
            value={settings.autoScan}
            onChange={(v) => patch({ autoScan: v })}
          />

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Strictness</div>
            <div className="flex gap-2">
              {(["AGGRESSIVE", "BALANCED", "STRICT"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => patch({ strictness: lvl })}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold",
                    settings.strictness === lvl
                      ? "border-[var(--neon)]/50 bg-[var(--neon)]/10 text-[var(--neon)]"
                      : "border-border/40 bg-secondary/20 text-muted-foreground",
                  )}
                >
                  {lvl.toLowerCase()}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Strict = fewer, higher-quality signals. Aggressive = more signals but lower quality.
            </div>
          </div>

          <SliderRow
            label="Min confidence"
            value={settings.minConfidence}
            min={50}
            max={95}
            onChange={(v) => patch({ minConfidence: v })}
          />
          <SliderRow
            label="Min persistence"
            value={settings.minPersistenceSeconds}
            min={5}
            max={120}
            onChange={(v) => patch({ minPersistenceSeconds: v })}
            suffix="s"
          />
          <SliderRow
            label="Refresh (ms)"
            value={settings.refreshMs}
            min={500}
            max={5000}
            step={100}
            onChange={(v) => patch({ refreshMs: v })}
            suffix="ms"
          />
          <SliderRow
            label="Minimum ticks"
            value={settings.minTicks}
            min={100}
            max={1000}
            step={50}
            onChange={(v) => patch({ minTicks: v })}
            suffix="t"
          />
          <button
            onClick={reset}
            className="w-full rounded-lg border border-border/50 bg-secondary/30 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Reset to defaults
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
      <span className="text-xs">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-semibold">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

// ─── Alerts button ─────────────────────────────────────────────────────
function AlertsButton() {
  const [perm, setPerm] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return Notification.permission;
  });
  const enabled = perm === "granted";
  const disabled = perm === "denied";
  const label = enabled ? "Alerts on" : disabled ? "Alerts blocked" : "Enable alerts";
  return (
    <button
      onClick={async () => setPerm(await requestSignalPermission())}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
        enabled
          ? "border-[var(--bull)]/40 bg-[var(--bull)]/10 text-[var(--bull)]"
          : disabled
            ? "border-border/40 bg-secondary/20 text-muted-foreground opacity-60 cursor-not-allowed"
            : "border-[var(--neon)]/40 bg-[var(--neon)]/10 text-[var(--neon)] hover:bg-[var(--neon)]/20",
      )}
      title={
        disabled
          ? "Notifications blocked in browser settings"
          : "Get pinged when a new signal fires"
      }
    >
      {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />} {label}
    </button>
  );
}

// ─── Debate panel ──────────────────────────────────────────────────────
function DebatePanel({ report }: { report: MarketReport }) {
  const d = report.mind.debate;
  const winner = d.winner;
  const tone =
    winner === "BUY_RISE" ? "var(--bull)" : winner === "BUY_FALL" ? "var(--bear)" : "var(--warn)";
  return (
    <Panel title="Internal debate" subtitle="Two hypotheses, cross-examined" accent="magenta">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="text-muted-foreground">Verdict:</span>{" "}
            <span className="font-semibold tabular" style={{ color: tone }}>
              {winner === "NEITHER"
                ? "No committed side"
                : winner === "BUY_RISE"
                  ? "BUY RISE"
                  : "BUY FALL"}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground tabular">Edge {d.edge}/100</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DebateSide title="Case for RISE" tone="var(--bull)" points={d.risePoints} />
        <DebateSide title="Case for FALL" tone="var(--bear)" points={d.fallPoints} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Why the loser was set aside
          </div>
          <div className="text-foreground/90 leading-relaxed">{d.rejection}</div>
        </div>
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Synthesis
          </div>
          <div className="text-foreground/90 leading-relaxed">{d.synthesis}</div>
        </div>
      </div>
    </Panel>
  );
}

function DebateSide({
  title,
  tone,
  points,
}: {
  title: string;
  tone: string;
  points: { point: string; weight: number }[];
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold" style={{ color: tone }}>
          {title}
        </div>
        <div className="text-[10px] tabular text-muted-foreground">
          {points.reduce((a, b) => a + b.weight, 0)} pts
        </div>
      </div>
      {points.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          No arguments survived cross-examination.
        </div>
      ) : (
        <ul className="space-y-2">
          {points.map((p, i) => (
            <li key={i} className="text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-foreground/90 leading-snug">{p.point}</span>
                <span className="tabular text-muted-foreground shrink-0">{p.weight}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-secondary/50 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, p.weight)}%`, background: tone }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
