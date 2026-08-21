import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Wifi,
  Activity,
  Radar,
  Settings as SettingsIcon,
  ShieldOff,
  Sparkles,
  TrendingUp,
  Layers,
  GitBranch,
  Target,
  BarChart3,
  Bot,
  History,
  ListOrdered,
  Zap,
  Clock,
  Unlock,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { usePrecisionParity } from "@/hooks/usePrecisionParity";
import { useAlertSound } from "@/hooks/useAlertSound";
import { DBotEntryCard } from "@/components/precision-edge/DBotEntryCard";
import { DEFAULT_PARITY_SETTINGS, type ParitySettings } from "@/lib/precision-parity/engine";
import type { MarketParityReport } from "@/lib/precision-parity/types";
import { Panel, Bar } from "@/components/Panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { FinalParityOutput } from "@/components/precision-parity/FinalParityOutput";
import { InstitutionalSignalCard } from "@/components/precision-parity/InstitutionalSignalCard";
import { ParityEntryExecutionCard } from "@/components/precision-parity/ParityEntryExecutionCard";
import { ParitySentinelOpportunityCard } from "@/components/precision-parity/ParitySentinelOpportunityCard";
import { CalibrationCurvePanel } from "@/components/precision-parity/CalibrationCurvePanel";
import { RunHazardVisualizer } from "@/components/precision-parity/RunHazardVisualizer";
import { MarkovTransitionMatrix } from "@/components/precision-parity/MarkovTransitionMatrix";
import { MultiWindowStatsTable } from "@/components/precision-parity/MultiWindowStatsTable";
import { AdversarialThreatMonitor } from "@/components/precision-parity/AdversarialThreatMonitor";
import { ShadowBacktestPanel } from "@/components/precision-parity/ShadowBacktestPanel";
import { PrecisionAnalyticSuiteCard } from "@/components/precision-parity/PrecisionAnalyticSuiteCard";
import { LiveMarketTickerStrip } from "@/components/precision-parity/LiveMarketTickerStrip";
import { PrecisionDigitIntelligenceCard } from "@/components/precision-parity/PrecisionDigitIntelligenceCard";
import { MultiMarketSignalRadar } from "@/components/precision-parity/MultiMarketSignalRadar";
import { EngineConfluenceArchitecture } from "@/components/precision-parity/EngineConfluenceArchitecture";
import { ParitySignalCard } from "@/components/precision-parity/ParitySignalCard";
import { buildPrecisionParitySignal } from "@/lib/precision-parity/engines/signal-builder";
import { CIOStrip } from "@/components/cio/CIOStrip";
import { DEFAULT_FEATURE_FLAGS } from "@/lib/precision-edge/terminal";

export const Route = createFileRoute("/_authenticated/app/precision-parity")({
  component: PrecisionParity,
});

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toISOString().slice(0, 19).replace("T", " ");
}

const STORAGE_KEY = "precision-parity-settings-v1";
function loadSettings(): ParitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PARITY_SETTINGS;
    return { ...DEFAULT_PARITY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PARITY_SETTINGS;
  }
}

function PrecisionParity() {
  const [settings, setSettings] = useState<ParitySettings>(() =>
    typeof window === "undefined" ? DEFAULT_PARITY_SETTINGS : loadSettings(),
  );
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  const patch = (p: Partial<ParitySettings>) => setSettings((s) => ({ ...s, ...p }));

  const scan = usePrecisionParity(settings);
  const clock = useClock();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("opportunity");
  const [selectedMarket, setSelectedMarket] = useState<string>("R_100");
  const live = scan.status === "live";
  const held = scan.held;
  useAlertSound(held ? `pp:${held.market}:${held.contract}:${held.createdAt}` : "");

  const activeMarket = held?.market || selectedMarket || scan.best?.market || "R_100";
  const activeTicks = scan.getTicks(activeMarket);
  const activeDigits = scan.getDigits(activeMarket);

  // Find current market report or fallback to best report or first available
  const currentReport =
    scan.markets.find((m) => m.market === activeMarket) ?? scan.best ?? scan.markets[0] ?? null;

  const targetContract = held?.contract ?? currentReport?.verdict.recommendation;
  const diagnostic =
    activeDigits.length >= 10 || activeTicks.length >= 10
      ? buildPrecisionParitySignal(
          activeTicks,
          activeMarket,
          0.95,
          0,
          targetContract,
          activeDigits.length > 0 ? activeDigits : undefined,
        )
      : null;
  const activeSignal = diagnostic?.signal ?? currentReport?.signal;

  return (
    <div className="min-h-screen grid-bg text-foreground">
      {/* Sticky Header with Sentinel Aesthetics */}
      <header className="sticky top-0 z-20 border-b border-border/40 glass">
        <div className="max-w-[1800px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/app/precision-edge"
              className="grid place-items-center w-9 h-9 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Precision Parity AI
              </div>
              <h1 className="text-lg font-semibold text-foreground leading-tight truncate">
                Institutional Even / Odd Terminal
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
            <div
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs tabular text-[var(--accent)]"
              title="Required edge (margin between winning and losing hypothesis)"
            >
              <TrendingUp className="w-3.5 h-3.5" /> EDGE {settings.minEdge.toFixed(1)}
            </div>
            <div className="hidden lg:block rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs tabular text-muted-foreground">
              {clock} UTC
            </div>
            <button
              onClick={scan.scanNow}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors",
                scan.scanning && "neon-border",
              )}
            >
              <Radar className={cn("w-3.5 h-3.5", scan.scanning && "animate-spin")} /> Scan
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area Structured with Sentinel Navigation Tabs */}
      <main className="max-w-[1800px] mx-auto px-5 py-5 space-y-5">
        {/* Live Real-Time Market Ticker & Digit Stream Strip */}
        <LiveMarketTickerStrip
          selectedMarket={activeMarket}
          onSelectMarket={(sym) => setSelectedMarket(sym)}
          ticks={activeTicks}
          digits={activeDigits}
          heldMarket={held?.market}
        />

        {/* CIO Strip if enabled */}
        {DEFAULT_FEATURE_FLAGS.cio && currentReport && (
          <CIOStrip
            parities={[
              {
                market: currentReport.market,
                side: currentReport.verdict.recommendation === "BUY_EVEN" ? "EVEN" : "ODD",
                pWin: (currentReport.verdict.confidence ?? 0) / 100,
                quality:
                  currentReport.verdict.state === "READY"
                    ? "premium"
                    : currentReport.verdict.state === "BUILDING"
                      ? "developing"
                      : "unknown",
                confidence: currentReport.verdict.confidence,
              },
            ]}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-5">
          {/* Sentinel-Style Clean Tab Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <TabsList className="bg-secondary/40 border border-border/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
              <TabsTrigger
                value="opportunity"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
              >
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                Opportunity
              </TabsTrigger>
              <TabsTrigger
                value="entry-lab"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Entry Lab
              </TabsTrigger>
              <TabsTrigger
                value="ranking"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
              >
                <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
                Ranking
              </TabsTrigger>
              <TabsTrigger
                value="intelligence"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                Intelligence
              </TabsTrigger>
              <TabsTrigger
                value="dbot"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
              >
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                DBot &amp; Execution
              </TabsTrigger>
              <TabsTrigger
                value="journal"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium"
              >
                <History className="w-3.5 h-3.5 text-slate-400" />
                Journal &amp; History
              </TabsTrigger>
            </TabsList>

            {/* Quick Status Pill */}
            {held && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Locked: <strong>{held.name}</strong> ({held.contract})
                </span>
              </div>
            )}
          </div>

          {/* TAB 1: OPPORTUNITY (Real-Time Multi-Market Signal Radar & Deep Analytical Engines) */}
          <TabsContent value="opportunity" className="space-y-6 focus-visible:outline-none">
            {/* 1. Primary Canonical Institutional Signal Card for Current Active Market */}
            {currentReport?.finalSignal ? (
              <ParitySignalCard signal={currentReport.finalSignal} className="shadow-2xl" />
            ) : currentReport ? (
              <ParitySentinelOpportunityCard
                report={currentReport}
                signal={activeSignal}
                digits={
                  activeDigits.length > 0 ? activeDigits : scan.getDigits(currentReport.market)
                }
              />
            ) : (
              <NoTradeBanner scan={scan} settings={settings} />
            )}

            {/* 2. Multi-Market Real-Time Opportunity Radar (All Volatilities Scanned Simultaneously) */}
            <MultiMarketSignalRadar
              opportunities={scan.emittedOpportunities}
              topOpportunity={scan.topOpportunity}
              markets={scan.markets}
              selectedMarket={activeMarket}
              onSelectMarket={(sym) => setSelectedMarket(sym)}
              audioAlerts={scan.audioAlerts}
              onToggleAudioAlerts={scan.toggleAudioAlerts}
              onScanNow={scan.scanNow}
              scanning={scan.scanning}
              journal={scan.opportunityJournal}
            />

            {/* 3. Comprehensive 18-Engine Confluence Architecture & Role Assignment Breakdown */}
            <EngineConfluenceArchitecture
              topOpportunity={scan.topOpportunity}
              report={currentReport}
            />

            {/* Hidden Statistical Depth Accordions (Sentinel Paradigm) */}
            {diagnostic && (
              <div className="pt-2">
                <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Deep Quantitative Engine Diagnostics
                </div>

                <Accordion type="multiple" defaultValue={[]} className="space-y-3">
                  {/* Accordion 1: Variable-Order & Transition Matrix */}
                  <AccordionItem
                    value="markov"
                    className="glass rounded-xl border border-border/50 px-4 transition-all"
                  >
                    <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground hover:no-underline py-3.5">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-[var(--accent)]" />
                        <span>1. Markov Transition Matrix &amp; High-Order Memory</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1">
                      <MarkovTransitionMatrix markov={diagnostic.markov} />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Accordion 2: Run Hazard & Streak Exhaustion */}
                  <AccordionItem
                    value="runs"
                    className="glass rounded-xl border border-border/50 px-4 transition-all"
                  >
                    <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground hover:no-underline py-3.5">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span>2. Run Hazard &amp; Streak Exhaustion Engine</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1">
                      <RunHazardVisualizer runs={diagnostic.runs} />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Accordion 3: Multi-Window Wilson Score & Calibration */}
                  <AccordionItem
                    value="stats"
                    className="glass rounded-xl border border-border/50 px-4 transition-all"
                  >
                    <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground hover:no-underline py-3.5">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                        <span>3. Multi-Window Wilson Score &amp; Calibration Curve</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1 space-y-4">
                      <MultiWindowStatsTable stats={diagnostic.stats} />
                      <CalibrationCurvePanel />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Accordion 4: Adversarial Threat & Veto Safeguards */}
                  <AccordionItem
                    value="threats"
                    className="glass rounded-xl border border-border/50 px-4 transition-all"
                  >
                    <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground hover:no-underline py-3.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-rose-400" />
                        <span>4. Adversarial Threat Monitor &amp; Veto Clearance</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1">
                      <AdversarialThreatMonitor danger={diagnostic.danger} />
                    </AccordionContent>
                  </AccordionItem>

                  {/* Accordion 5: Shadow Backtest & Paper Ledger */}
                  <AccordionItem
                    value="shadow"
                    className="glass rounded-xl border border-border/50 px-4 transition-all"
                  >
                    <AccordionTrigger className="font-mono text-xs uppercase tracking-wider text-foreground hover:no-underline py-3.5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>5. Real-Time Paper Trading &amp; Shadow Ledger</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1">
                      <ShadowBacktestPanel />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: ENTRY LAB (Dedicated Markov & Entry Engine Workspace) */}
          <TabsContent value="entry-lab" className="space-y-5 focus-visible:outline-none">
            {currentReport ? (
              <ParityEntryExecutionCard
                report={currentReport}
                signal={activeSignal}
                heldSignal={scan.held}
                onReleaseHold={scan.releaseHold}
              />
            ) : (
              <NoTradeBanner scan={scan} settings={settings} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {diagnostic && <MarkovTransitionMatrix markov={diagnostic.markov} />}
              {diagnostic && <RunHazardVisualizer runs={diagnostic.runs} />}
            </div>

            {held && <RecommendationCard held={held} />}
          </TabsContent>

          {/* TAB 3: CROSS-MARKET RANKING */}
          <TabsContent value="ranking" className="space-y-5 focus-visible:outline-none">
            <MarketList
              scan={scan}
              selectedMarket={activeMarket}
              onSelectMarket={(sym) => setSelectedMarket(sym)}
            />
          </TabsContent>

          {/* TAB 4: MARKET INTELLIGENCE & FORECASTING */}
          <TabsContent value="intelligence" className="space-y-5 focus-visible:outline-none">
            <PrecisionDigitIntelligenceCard
              digits={activeDigits}
              marketName={currentReport?.name ?? activeMarket}
            />
            {currentReport?.forecast && <ForecastPanel report={currentReport} />}
            {currentReport && <AnalystPanel report={currentReport} />}
            {currentReport?.verdict.panel && <IntelligencePanelView report={currentReport} />}
            {currentReport && <ReasoningPanel report={currentReport} />}
          </TabsContent>

          {/* TAB 5: DBOT & SIMULATOR */}
          <TabsContent value="dbot" className="space-y-5 focus-visible:outline-none">
            {held ? (
              <DBotEntryCard
                entry={{
                  market: held.market,
                  marketName: held.name,
                  contractType: held.contract === "BUY_EVEN" ? "DIGITEVEN" : "DIGITODD",
                  contractLabel: held.contract === "BUY_EVEN" ? "Even" : "Odd",
                  durationTicks: 1,
                  entry: "Immediate",
                  entryTrigger: `enter on next tick while ${held.contract === "BUY_EVEN" ? "even" : "odd"} pressure holds`,
                }}
              />
            ) : (
              <div className="rounded-xl border border-border/40 p-6 glass text-center space-y-2">
                <Bot className="w-8 h-8 text-muted-foreground mx-auto" />
                <h3 className="font-semibold text-foreground">DBot Entry Automation Ready</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  When a verified parity signal is held, exact DBot XML configuration and parameter
                  payloads will generate here.
                </p>
              </div>
            )}

            {currentReport && <FinalParityOutput report={currentReport} />}
          </TabsContent>

          {/* TAB 6: JOURNAL & HISTORY */}
          <TabsContent value="journal" className="space-y-5 focus-visible:outline-none">
            <SignalHistory history={scan.history} />
          </TabsContent>
        </Tabs>
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        patch={patch}
        reset={() => setSettings(DEFAULT_PARITY_SETTINGS)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function RecommendationCard({
  held,
}: {
  held: NonNullable<ReturnType<typeof usePrecisionParity>["held"]>;
}) {
  const isEven = held.contract === "BUY_EVEN";
  const tone = isEven ? "var(--bull)" : "var(--accent)";
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: `color-mix(in oklab, ${tone} 40%, transparent)`,
        background: `color-mix(in oklab, ${tone} 8%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Active recommendation
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className="text-3xl font-bold tabular"
              style={{ color: `hsl(var(--foreground))` }}
            >
              {isEven ? "BUY EVEN" : "BUY ODD"}
            </span>
            <span className="text-sm text-muted-foreground">on {held.name}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Confidence
          </div>
          <div className="text-3xl font-bold tabular" style={{ color: tone }}>
            {held.confidence.toFixed(0)}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-1">
          Reasoning
        </div>
        <ul className="space-y-1 text-sm text-foreground/90">
          {(held.reasoning ?? []).slice(0, 8).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NoTradeBanner({
  scan,
  settings,
}: {
  scan: ReturnType<typeof usePrecisionParity>;
  settings: ParitySettings;
}) {
  const reasons = new Map<string, number>();
  for (const m of scan.markets)
    for (const r of m.verdict.reasons) reasons.set(r, (reasons.get(r) ?? 0) + 1);
  const top = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([r]) => r);
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/[0.05] p-4">
      <div className="flex items-center gap-2 text-warn">
        <ShieldOff className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.25em]">No trade</span>
      </div>
      <p className="mt-2 text-sm text-foreground leading-relaxed">
        No parity hypothesis currently survives the required evidence review. The engine prefers
        waiting — decision quality over signal frequency.
      </p>
      {top.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Most common reason across markets
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {top.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        Waiting for: confidence ≥ {settings.minConfidence}, manipulation &lt;{" "}
        {settings.maxManipulation}%, contradiction &lt; {settings.maxContradiction}%, persistence ≥{" "}
        {settings.minPersistenceTicks} ticks.
      </div>
    </div>
  );
}

function MarketList({
  scan,
  selectedMarket,
  onSelectMarket,
}: {
  scan: ReturnType<typeof usePrecisionParity>;
  selectedMarket?: string;
  onSelectMarket?: (market: string) => void;
}) {
  const ranked = [...scan.markets].sort((a, b) => b.verdict.confidence - a.verdict.confidence);
  return (
    <Panel title="Market list" subtitle="Live parity monitor (Click row to inspect)" accent="cyan">
      <div className="max-h-[480px] overflow-y-auto -mx-4">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-left px-4 py-2">Market</th>
              <th className="text-left px-2 py-2">Regime</th>
              <th className="text-right px-2 py-2">Even%</th>
              <th className="text-right px-2 py-2">Conf</th>
              <th className="text-right px-4 py-2">State</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((m) => {
              const ev = (m.windows[100]?.evenPct ?? 0.5) * 100;
              const isEven = m.verdict.recommendation === "BUY_EVEN";
              const isOdd = m.verdict.recommendation === "BUY_ODD";
              const isSelected = selectedMarket === m.market;
              return (
                <tr
                  key={m.market}
                  onClick={() => onSelectMarket?.(m.market)}
                  className={cn(
                    "border-b border-border/20 cursor-pointer transition-colors hover:bg-white/[0.04]",
                    isSelected && "bg-cyan-500/10 border-cyan-500/30",
                  )}
                >
                  <td className="px-4 py-2 font-medium truncate max-w-[180px] flex items-center gap-2">
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                    {m.name}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{m.regime}</td>
                  <td className="px-2 py-2 text-right tabular">{ev.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right tabular font-semibold">
                    {m.verdict.confidence.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                        m.verdict.state === "READY" &&
                          isEven &&
                          "bg-[var(--bull)]/15 text-[var(--bull)]",
                        m.verdict.state === "READY" &&
                          isOdd &&
                          "bg-[var(--accent)]/15 text-[var(--accent)]",
                        m.verdict.state === "BUILDING" && "bg-warn/15 text-warn",
                        m.verdict.state === "MONITORING" && "bg-secondary text-muted-foreground",
                        m.verdict.state === "REJECTED" && "bg-bear/15 text-bear",
                      )}
                    >
                      {m.verdict.state === "READY" ? (isEven ? "EVEN" : "ODD") : m.verdict.state}
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

function SignalHistory({ history }: { history: ReturnType<typeof usePrecisionParity>["history"] }) {
  return (
    <Panel title="Signal history" subtitle="Historical recommendations (session)" accent="magenta">
      <div className="max-h-[420px] overflow-y-auto space-y-2">
        {history.length === 0 && (
          <div className="text-xs text-muted-foreground">No signals fired yet in this session.</div>
        )}
        {history.map((h, i) => {
          const isEven = h.contract === "BUY_EVEN";
          return (
            <div key={i} className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                      isEven
                        ? "bg-[var(--bull)]/15 text-[var(--bull)]"
                        : "bg-[var(--accent)]/15 text-[var(--accent)]",
                    )}
                  >
                    {isEven ? "EVEN" : "ODD"}
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

function ReasoningPanel({ report }: { report: MarketParityReport }) {
  const tr = report.transitions.find((t) => t.window === 100) ?? report.transitions[0];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Panel title="Regime" subtitle={`${report.name}`} accent="cyan">
        <div className="space-y-2 text-xs">
          <Row label="Market regime" value={report.regime} />
          <Row label="Hidden regime" value={report.hiddenRegime} />
          <Row label="Manipulation" value={`${report.manipulation.toFixed(0)}%`} />
          <Row label="Fluctuation" value={`${report.fluctuation.toFixed(0)}%`} />
          <Row label="Crowding" value={`${report.crowding.toFixed(0)}%`} />
          <Row
            label="Historical similarity"
            value={`${(report.historicalSimilarity * 100).toFixed(0)}%`}
          />
        </div>
      </Panel>

      <Panel title="Transition matrix" subtitle="First-order Markov · 100t" accent="magenta">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Trans label="P(E→E)" v={tr.pEE} />
          <Trans label="P(E→O)" v={tr.pEO} />
          <Trans label="P(O→E)" v={tr.pOE} />
          <Trans label="P(O→O)" v={tr.pOO} />
        </div>
        <div className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Second-order P(next=Even)
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          {(["EE", "EO", "OE", "OO"] as const).map((k) => (
            <div
              key={k}
              className="rounded-md border border-border/40 bg-secondary/20 p-2 text-center"
            >
              <div className="text-[10px] text-muted-foreground">{k}</div>
              <div className="tabular font-semibold">
                {(report.secondOrder.pEvenAfter[k] * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Bar dashboard" subtitle="Green / Red digit intelligence" accent="amber">
        <div className="space-y-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Green bar
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tabular text-[var(--bull)]">
                d{report.greenBar.digit}
              </span>
              <span className="text-muted-foreground">
                {report.greenBar.parity} · {report.greenBar.zone}
              </span>
              <span className="ml-auto tabular">{(report.greenBar.pct * 100).toFixed(1)}%</span>
            </div>
            <Bar value={report.greenBar.pct * 100 * 6} tone="bull" />
            <div className="text-[10px] text-muted-foreground mt-1">
              persistence {report.greenBar.persistence}t · velocity{" "}
              {(report.greenBar.velocity * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Red bar
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tabular text-bear">d{report.redBar.digit}</span>
              <span className="text-muted-foreground">
                {report.redBar.parity} · {report.redBar.zone}
              </span>
              <span className="ml-auto tabular">{(report.redBar.pct * 100).toFixed(1)}%</span>
            </div>
            <Bar value={report.redBar.pct * 100 * 6} tone="bear" />
          </div>
        </div>
      </Panel>

      <Panel
        title="Rolling parity windows"
        subtitle="20 · 50 · 100 · 200 · 500 · 1000"
        accent="cyan"
        className="lg:col-span-2"
      >
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {[20, 50, 100, 200, 500, 1000].map((w) => {
            const s = report.windows[w];
            if (!s) return null;
            return (
              <div key={w} className="rounded-md border border-border/40 bg-secondary/20 p-2">
                <div className="text-[10px] text-muted-foreground">
                  {w}t · n={s.n}
                </div>
                <div className="mt-1 flex justify-between tabular">
                  <span className="text-[var(--bull)]">E {(s.evenPct * 100).toFixed(1)}%</span>
                  <span className="text-[var(--accent)]">O {(s.oddPct * 100).toFixed(1)}%</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  H={s.entropy.toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Contradictions"
        subtitle="Evidence opposing the winning hypothesis"
        accent="magenta"
      >
        <div className="space-y-2 text-xs">
          {report.verdict.hypotheses
            .sort((a, b) => b.confidence - a.confidence)[0]
            .conflicts.slice(0, 6)
            .map((c, i) => (
              <div key={i} className="text-muted-foreground">
                − {c.detail}
              </div>
            ))}
          {report.verdict.hypotheses[0].conflicts.length === 0 && (
            <div className="text-muted-foreground">No material contradictions detected.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function AnalystPanel({ report }: { report: MarketParityReport }) {
  const v = report.verdict;
  const a = v.analyst;
  const r = v.risk;
  const st = v.stability;
  const p = v.plan;
  const db = v.dbot;
  if (!a && !r && !st && !p && !db) return null;
  const badge = (label: string, tone: "bull" | "bear" | "warn" | "neon" | "muted") => {
    const map = {
      bull: "bg-[var(--bull)]/15 text-[var(--bull)] border-[var(--bull)]/40",
      bear: "bg-bear/15 text-bear border-bear/40",
      warn: "bg-warn/15 text-warn border-warn/40",
      neon: "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40",
      muted: "bg-secondary text-muted-foreground border-border/40",
    } as const;
    return (
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-semibold", map[tone])}>
        {label}
      </span>
    );
  };
  const analystTone =
    a?.verdict === "APPROVED" ? "bull" : a?.verdict === "REJECTED" ? "bear" : "warn";
  const riskTone = r?.verdict === "APPROVED" ? "bull" : r?.verdict === "REJECTED" ? "bear" : "warn";
  const stabTone = st
    ? st.label === "DURABLE"
      ? "bull"
      : st.label === "STABLE"
        ? "neon"
        : st.label === "OK"
          ? "warn"
          : "bear"
    : "muted";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Panel
        title="Evidence Analyst"
        subtitle="Would a professional stake real money on this?"
        accent="cyan"
      >
        {a ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              {badge(a.verdict, analystTone)}
              <span className="text-muted-foreground">
                {a.wouldRiskMoney ? "Would risk own money" : "Would NOT risk own money"}
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Key question
              </div>
              <div className="text-foreground/90">{a.keyQuestion}</div>
              <div className="text-muted-foreground mt-1">{a.answer}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--bull)]">
                  Supports
                </div>
                <ul className="space-y-1">
                  {a.supportsRecommendation.slice(0, 5).map((s, i) => (
                    <li key={i}>+ {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-bear">Challenges</div>
                <ul className="space-y-1">
                  {a.challengesRecommendation.slice(0, 5).map((s, i) => (
                    <li key={i}>− {s}</li>
                  ))}
                </ul>
                {a.challengesRecommendation.length === 0 && (
                  <div className="text-muted-foreground">None material.</div>
                )}
              </div>
            </div>
            <div className="text-foreground/80 border-t border-border/30 pt-2">{a.summary}</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Awaiting sufficient evidence…</div>
        )}
      </Panel>

      <Panel
        title="Risk Review"
        subtitle="Is it too late? Is the crowd already in?"
        accent="magenta"
      >
        {r ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">{badge(r.verdict, riskTone)}</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Row label="Too late?" value={r.tooLate ? "Yes" : "No"} />
              <Row label="Crowd in?" value={r.crowdAlreadyIn ? "Yes" : "No"} />
              <Row label="Edge weakening?" value={r.edgeWeakening ? "Yes" : "No"} />
              <Row label="Waiting helps?" value={r.waitingImproves ? "Yes" : "No"} />
            </div>
            {r.concerns.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Concerns
                </div>
                <ul className="space-y-1">
                  {r.concerns.map((c, i) => (
                    <li key={i}>! {c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-foreground/80 border-t border-border/30 pt-2">{r.summary}</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Awaiting sufficient evidence…</div>
        )}
      </Panel>

      <Panel title="Edge Stability & Plan" subtitle="How durable is this edge?" accent="amber">
        {st && p ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              {badge(st.label, stabTone)}
              <span className="tabular font-semibold">{st.score.toFixed(0)}/100</span>
              <span className="text-muted-foreground">
                · ~{st.expectedEntries} entries / {st.expectedDurationSeconds}s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Row label="Contract" value={p.contract === "BUY_EVEN" ? "EVEN" : "ODD"} />
              <Row label="Market phase" value={p.marketPhase} />
              <Row label="Reasoning" value={p.reasoningQuality} />
              <Row label="Runs" value={String(p.recommendedRuns)} />
              <Row label="Stake" value={p.recommendedStake} />
              <Row label="Max delay" value={`${p.maxDelaySeconds}s`} />
              <Row label="Expires in" value={`${p.signalExpirySeconds}s`} />
              <Row label="Status" value={p.status} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Entry directive
              </div>
              <div className="text-foreground/90">{p.entryDirective}</div>
              <div className="text-muted-foreground">Recovery: {p.recoveryCompatibility}</div>
            </div>
            {st.reasons.length > 0 && (
              <ul className="space-y-1 border-t border-border/30 pt-2">
                {st.reasons.slice(0, 4).map((s, i) => (
                  <li key={i} className="text-muted-foreground">
                    • {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Awaiting sufficient evidence…</div>
        )}
      </Panel>

      {db && (
        <Panel
          title="DBot Execution Plan"
          subtitle="Ready-to-load bot recommendation"
          accent="cyan"
          className="lg:col-span-3"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Row label="Market" value={db.marketName} />
            <Row label="Contract" value={db.contract === "BUY_EVEN" ? "BUY EVEN" : "BUY ODD"} />
            <Row label="Entry" value={db.entry} />
            <Row label="Recommended runs" value={String(db.recommendedRuns)} />
            <Row label="Max consecutive" value={String(db.maxConsecutiveEntries)} />
            <Row label="Status" value={db.status} />
          </div>
          {db.cancelConditions.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Cancel if
              </div>
              <ul className="space-y-1 text-xs">
                {db.cancelConditions.map((c, i) => (
                  <li key={i}>× {c}</li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/20 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Market Intelligence Analyst — Bull / Bear / Chief / DBot Survival / Contrarian
// Precision Parity is a panel of analysts, not a signal generator.
// ─────────────────────────────────────────────────────────────────────────
function IntelligencePanelView({ report }: { report: MarketParityReport }) {
  const p = report.verdict.panel;
  if (!p) return null;
  const side =
    p.chief.contract === "BUY_EVEN" ? "EVEN" : p.chief.contract === "BUY_ODD" ? "ODD" : "—";
  const chiefTone =
    p.chief.decision === "APPROVE" ? "bull" : p.chief.decision === "REJECT" ? "bear" : "warn";
  const contraTone = p.contrarian.verdict === "BLOCK" ? "bear" : "bull";
  const gradeTone =
    p.intelligenceGrade === "A"
      ? "bull"
      : p.intelligenceGrade === "B"
        ? "neon"
        : p.intelligenceGrade === "C"
          ? "warn"
          : "bear";
  const badge = (label: string, tone: "bull" | "bear" | "warn" | "neon" | "muted") => {
    const map = {
      bull: "bg-[var(--bull)]/15 text-[var(--bull)] border-[var(--bull)]/40",
      bear: "bg-bear/15 text-bear border-bear/40",
      warn: "bg-warn/15 text-warn border-warn/40",
      neon: "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40",
      muted: "bg-secondary text-muted-foreground border-border/40",
    } as const;
    return (
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-semibold", map[tone])}>
        {label}
      </span>
    );
  };
  return (
    <div className="space-y-5">
      {/* Chief verdict — the panel's headline. */}
      <Panel
        title="Chief Analyst verdict"
        subtitle="After the Bull / Bear debate and Contrarian review"
        accent="cyan"
      >
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {badge(p.chief.decision, chiefTone)}
            {badge(`Grade ${p.intelligenceGrade}`, gradeTone)}
            {p.chief.decision === "APPROVE" && (
              <span className="text-foreground/90">
                on <span className="font-semibold">{side}</span>
              </span>
            )}
            <span className="ml-auto text-muted-foreground">
              {p.chief.bullWon ? "Bull survived cross-examination" : "Bear pressure prevailed"}
            </span>
          </div>
          <p className="text-foreground/90 leading-relaxed">{p.chief.reasoning}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--bull)]">
                Strongest support
              </div>
              <div className="text-foreground/90">{p.chief.strongestSupport}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-bear">
                Strongest opposition
              </div>
              <div className="text-foreground/90">{p.chief.strongestOpposition}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Why opposition was rejected
              </div>
              <div className="text-foreground/90">{p.chief.whyOppositionRejected}</div>
            </div>
          </div>
          <div className="text-muted-foreground border-t border-border/30 pt-2">
            {p.chief.uncertainty}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          title="Bull Analyst"
          subtitle={`Argues for ${side === "—" ? p.bull.contract.replace("BUY_", "") : side}`}
          accent="cyan"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              {badge(`Strength ${p.bull.strength.toFixed(0)}`, "bull")}
              <span className="text-muted-foreground">{p.bull.arguments.length} arguments</span>
            </div>
            <ul className="space-y-2">
              {p.bull.arguments.slice(0, 5).map((a, i) => (
                <li
                  key={i}
                  className="rounded-md border border-[var(--bull)]/20 bg-[var(--bull)]/[0.04] p-2"
                >
                  <div className="text-[var(--bull)] font-semibold">{a.claim}</div>
                  <div className="text-muted-foreground">{a.evidence}</div>
                </li>
              ))}
              {p.bull.arguments.length === 0 && (
                <li className="text-muted-foreground">No meaningful supporting evidence.</li>
              )}
            </ul>
            <div className="text-foreground/80 border-t border-border/30 pt-2">
              {p.bull.summary}
            </div>
          </div>
        </Panel>

        <Panel title="Bear Analyst" subtitle="Attacks the Bull's contract" accent="magenta">
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              {badge(`Destruction ${p.bear.destructiveness.toFixed(0)}`, "bear")}
              <span className="text-muted-foreground">{p.bear.attacks.length} attacks</span>
            </div>
            <ul className="space-y-2">
              {p.bear.attacks.slice(0, 5).map((a, i) => (
                <li key={i} className="rounded-md border border-bear/20 bg-bear/[0.04] p-2">
                  <div className="text-bear font-semibold">{a.claim}</div>
                  <div className="text-muted-foreground">{a.evidence}</div>
                </li>
              ))}
              {p.bear.attacks.length === 0 && (
                <li className="text-muted-foreground">No credible attack found.</li>
              )}
            </ul>
            <div className="text-foreground/80 border-t border-border/30 pt-2">
              {p.bear.summary}
            </div>
          </div>
        </Panel>
      </div>

      {p.crossExamination.length > 0 && (
        <Panel
          title="Cross-examination transcript"
          subtitle="Alternating Bull / Bear exchanges"
          accent="amber"
        >
          <ol className="space-y-1.5 text-xs">
            {p.crossExamination.map((e, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  e.side === "BULL"
                    ? "border-[var(--bull)]/25 bg-[var(--bull)]/[0.05]"
                    : "border-bear/25 bg-bear/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider mr-2",
                    e.side === "BULL" ? "text-[var(--bull)]" : "text-bear",
                  )}
                >
                  {e.side}:
                </span>
                <span className="text-foreground/90">{e.line}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          title="DBot survival profile"
          subtitle="Can this edge survive 1–5 consecutive entries?"
          accent="cyan"
        >
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {badge(
                p.dbotSurvival.durability,
                p.dbotSurvival.durability === "VERY_HIGH" || p.dbotSurvival.durability === "HIGH"
                  ? "bull"
                  : p.dbotSurvival.durability === "MODERATE"
                    ? "warn"
                    : "bear",
              )}
              <span className="text-muted-foreground">
                Recommended runs:{" "}
                <span className="font-semibold text-foreground">
                  {p.dbotSurvival.recommendedRuns}
                </span>
              </span>
              <span className="ml-auto text-muted-foreground">
                Cooldown {p.dbotSurvival.cooldownSeconds}s
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {p.dbotSurvival.survival.map((s, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border/40 bg-secondary/20 p-2 text-center"
                >
                  <div className="text-[10px] text-muted-foreground">Entry {i + 1}</div>
                  <div
                    className={cn(
                      "tabular font-semibold",
                      s >= 0.6 ? "text-[var(--bull)]" : s >= 0.4 ? "text-warn" : "text-bear",
                    )}
                  >
                    {(s * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Row
                label="Flip probability (5)"
                value={`${(p.dbotSurvival.flipProbability5 * 100).toFixed(0)}%`}
              />
              <Row
                label="Expected win run"
                value={`${p.dbotSurvival.expectedWinRun.toFixed(1)}t`}
              />
              <Row
                label="Expected loss run"
                value={`${p.dbotSurvival.expectedLossRun.toFixed(1)}t`}
              />
              <Row label="Grade" value={p.intelligenceGrade} />
            </div>
          </div>
        </Panel>

        <Panel
          title="Contrarian review"
          subtitle="One last challenge before the signal ships"
          accent="magenta"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              {badge(p.contrarian.verdict, contraTone)}
              <span className="text-muted-foreground">
                Trap risk {p.contrarian.trapRisk.toFixed(0)}%
              </span>
              {p.contrarian.crowded && <span className="text-warn">· crowded</span>}
              {p.contrarian.late && <span className="text-warn">· late</span>}
            </div>
            <ul className="space-y-2">
              {p.contrarian.concerns.slice(0, 4).map((c, i) => (
                <li key={i} className="rounded-md border border-warn/20 bg-warn/[0.04] p-2">
                  <div className="text-warn font-semibold">{c.claim}</div>
                  <div className="text-muted-foreground">{c.evidence}</div>
                </li>
              ))}
              {p.contrarian.concerns.length === 0 && (
                <li className="text-muted-foreground">No contrarian concern raised.</li>
              )}
            </ul>
            <div className="text-foreground/80 border-t border-border/30 pt-2">
              {p.contrarian.summary}
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Confidence decomposition"
        subtitle="One number is not enough — every dimension shown"
        accent="amber"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <BreakdownStat label="Prediction" value={p.breakdown.prediction} />
          <BreakdownStat label="DBot survival" value={p.breakdown.dbotSurvival} />
          <BreakdownStat label="Persistence (5)" value={p.breakdown.persistence} />
          <BreakdownStat label="Stability" value={p.breakdown.stability} />
          <BreakdownStat label="Reversal risk" value={p.breakdown.reversalRisk} invert />
          <BreakdownStat label="Contradiction" value={p.breakdown.contradiction} invert />
          <BreakdownStat label="Hypothesis strength" value={p.breakdown.hypothesisStrength} />
          <BreakdownStat label="Reasoning quality" value={p.breakdown.reasoningQuality} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 text-[11px]">
          <Row label="Expected value" value={p.breakdown.expectedValue.toFixed(2)} />
          <Row label="Win run" value={`${p.breakdown.expectedWinRun.toFixed(1)}t`} />
          <Row label="Loss run" value={`${p.breakdown.expectedLossRun.toFixed(1)}t`} />
        </div>
      </Panel>
    </div>
  );
}

function BreakdownStat({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const good = invert ? value <= 30 : value >= 60;
  const bad = invert ? value >= 60 : value <= 30;
  const tone = good ? "text-[var(--bull)]" : bad ? "text-bear" : "text-warn";
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("tabular font-semibold text-base", tone)}>{value.toFixed(0)}</div>
      <Bar value={value} tone={good ? "bull" : bad ? "bear" : "warn"} />
    </div>
  );
}

function Trans({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="tabular font-semibold">{(v * 100).toFixed(1)}%</div>
      <Bar value={v * 100} tone="neon" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SettingsDrawer({
  open,
  onOpenChange,
  settings,
  patch,
  reset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: ParitySettings;
  patch: (p: Partial<ParitySettings>) => void;
  reset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Precision Parity settings</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-5 text-sm">
          <SwitchRow
            label="Auto scan"
            value={settings.autoScan}
            onChange={(v) => patch({ autoScan: v })}
          />
          <SwitchRow
            label="Require mature setup"
            value={settings.requireMature}
            onChange={(v) => patch({ requireMature: v })}
          />
          <SliderRow
            label="Min confidence"
            value={settings.minConfidence}
            min={50}
            max={95}
            onChange={(v) => patch({ minConfidence: v })}
            suffix=""
          />
          <SliderRow
            label="Required edge (margin)"
            value={settings.minEdge}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) => patch({ minEdge: v })}
            suffix="pts"
          />
          <SliderRow
            label="Manipulation cap"
            value={settings.maxManipulation}
            min={10}
            max={80}
            onChange={(v) => patch({ maxManipulation: v })}
            suffix="%"
          />
          <SliderRow
            label="Contradiction tolerance"
            value={settings.maxContradiction}
            min={10}
            max={80}
            onChange={(v) => patch({ maxContradiction: v })}
            suffix="%"
          />
          <SliderRow
            label="Min persistence (ticks)"
            value={settings.minPersistenceTicks}
            min={1}
            max={20}
            onChange={(v) => patch({ minPersistenceTicks: v })}
            suffix="t"
          />
          <SliderRow
            label="Signal hold"
            value={settings.minHoldSeconds}
            min={5}
            max={120}
            onChange={(v) => patch({ minHoldSeconds: v })}
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
          {suffix}
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
// ─────────────────────────────────────────────────────────────────────────
// Future Forecast Panel — surfaces the V3 Future Forecast Intelligence
// Engine's ensemble prediction, horizon probabilities, DBot survival
// forecast, historical analogue and streak-protection verdict.
// ─────────────────────────────────────────────────────────────────────────
function ForecastPanel({ report }: { report: MarketParityReport }) {
  const fc = report.forecast!;
  const ens = fc.ensemble;
  const isEven = ens.favoured === "EVEN";
  const tone = isEven ? "var(--bull)" : "var(--accent)";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Panel
        title="Future Forecast"
        subtitle="Ensemble prediction · next tick"
        accent="amber"
        className="lg:col-span-2"
      >
        <div className="flex items-start gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Favoured next tick
            </div>
            <div className="text-4xl font-bold tabular" style={{ color: tone }}>
              {ens.favoured}
            </div>
            <div className="text-xs text-muted-foreground mt-1 tabular">
              EVEN {(ens.pEvenNext * 100).toFixed(0)}% · ODD {(ens.pOddNext * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ensemble confidence
            </div>
            <div className="text-3xl font-bold tabular">{ens.confidence.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Agreement {(ens.stability * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Persistence window
            </div>
            <div className="text-3xl font-bold tabular">{ens.persistenceWindow}t</div>
            <div className="text-xs text-muted-foreground mt-1">
              Survives {(ens.edgeSurvives * 100).toFixed(0)}% · Reverses{" "}
              {(ens.edgeReverses * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Horizon forecasts
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {ens.horizons.map((h) => (
              <div
                key={h.horizon}
                className="rounded-md border border-border/40 bg-secondary/20 p-2"
              >
                <div className="text-[10px] text-muted-foreground">Next {h.horizon}t</div>
                <div className="tabular text-[var(--bull)]">
                  E {(h.pEven * 100).toFixed(0)}% · exp {h.expectedEven}
                </div>
                <div className="tabular text-[var(--accent)]">
                  O {(h.pOdd * 100).toFixed(0)}% · exp {h.expectedOdd}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Specialist forecasters
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {fc.specialists
              .slice()
              .sort((a, b) => b.confidence - a.confidence)
              .map((s) => {
                const dir: "EVEN" | "ODD" = s.pEvenNext >= 0.5 ? "EVEN" : "ODD";
                const dirTone = dir === "EVEN" ? "var(--bull)" : "var(--accent)";
                return (
                  <div
                    key={s.name}
                    className="rounded-md border border-border/30 bg-secondary/10 p-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="tabular font-semibold" style={{ color: dirTone }}>
                        {dir} {(Math.max(s.pEvenNext, 1 - s.pEvenNext) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{s.supporting}</span>
                      <span className="tabular">
                        conf {(s.confidence * 100).toFixed(0)} · rev{" "}
                        {(s.reversalProbability * 100).toFixed(0)}% · {s.expectedDuration}t
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Panel>

      <Panel title="DBot Survival Forecast" subtitle="Multi-entry durability" accent="cyan">
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Win first entry" value={`${(fc.dbotSurvival.pWin1 * 100).toFixed(0)}%`} />
            <Stat
              label="Recovery needed"
              value={`${(fc.dbotSurvival.pRecoveryRequired * 100).toFixed(0)}%`}
            />
            <Stat
              label="Recovery succeeds"
              value={`${(fc.dbotSurvival.pRecoverySucceeds * 100).toFixed(0)}%`}
            />
            <Stat label="Durability" value={fc.dbotSurvival.durability.replace("_", " ")} />
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/40">
            {([1, 3, 5, 8] as const).map((k) => (
              <div key={k} className="text-center">
                <div className="text-[10px] text-muted-foreground">Survive {k}</div>
                <div className="tabular font-semibold">
                  {(fc.dbotSurvival.survival[k] * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
            Expected {fc.dbotSurvival.expectedWinsBeforeFlip} wins before flip ·{" "}
            {fc.dbotSurvival.expectedLossesBeforeRecovery} losses before recovery
          </div>
        </div>
      </Panel>

      <Panel
        title="Streak Protection"
        subtitle="Loss-avoidance gate"
        accent="magenta"
        className="lg:col-span-2"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Stat
            label="Streak-loss risk"
            value={`${(fc.streakProtection.streakLossProbability * 100).toFixed(0)}%`}
          />
          <Stat
            label="Transition risk"
            value={`${(fc.streakProtection.transitionRisk * 100).toFixed(0)}%`}
          />
          <Stat
            label="Edge expiry"
            value={`${(fc.streakProtection.edgeExpiryRisk * 100).toFixed(0)}%`}
          />
          <Stat
            label="Noise trap"
            value={`${(fc.streakProtection.noiseTrapRisk * 100).toFixed(0)}%`}
          />
        </div>
        <div
          className={cn(
            "mt-3 rounded-md border p-2 text-xs",
            fc.streakProtection.block
              ? "border-bear/30 bg-bear/[0.08] text-bear"
              : "border-[var(--bull)]/30 bg-[var(--bull)]/[0.06] text-[var(--bull)]",
          )}
        >
          {fc.streakProtection.reason}
        </div>
      </Panel>

      <Panel title="Historical Analogue" subtitle="Similar past market states" accent="cyan">
        <div className="space-y-2 text-xs">
          <Stat label="Matches" value={String(fc.analogue.matches)} />
          <Stat label="Similarity" value={`${(fc.analogue.similarity * 100).toFixed(0)}%`} />
          <Stat label="Avg persist" value={`${fc.analogue.avgPersistTicks.toFixed(1)}t`} />
          <Stat label="Reversal rate" value={`${(fc.analogue.reversalRate * 100).toFixed(0)}%`} />
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40 leading-relaxed">
            {fc.analogue.narrative}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="tabular font-semibold text-sm">{value}</div>
    </div>
  );
}
