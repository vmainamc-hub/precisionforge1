import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Brain,
  Crosshair,
  Database,
  Gauge,
  Radar,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

import { useApexSentinel } from "@/hooks/useApexSentinel";
import { DEFAULT_SCAN_OPTIONS, whyNotRunnerUp, type ScanOptions } from "@/lib/apex/scan";
import { SimulatorPanel } from "@/components/apex/SimulatorPanel";
import { SimulatorCommandCenter } from "@/components/apex/SimulatorCommandCenter";
import {
  ForwardProjectionPanel,
  PressureBalance,
  SensitiveDigitMonitor,
} from "@/components/apex/SensitiveDigits";
import { apexReasoning, type ApexReasoning } from "@/lib/apex/ai.functions";
import { ScoreRing, MetricBar } from "@/components/apex/ScoreRing";
import { EvidenceList, SectionTitle } from "@/components/apex/EvidencePanel";
import { EntryConditionLab, EntryConditionSummary } from "@/components/apex/EntryConditionLab";
import {
  PsychologyPanel,
  SpecialDigitPanel,
  FluctuationPanel,
} from "@/components/apex/PsychologyPanel";
import { ExposurePanel } from "@/components/apex/ExposurePanel";
import { SimulatorWindows } from "@/components/apex/SimulatorWindows";
import { LearningDashboard } from "@/components/apex/LearningDashboard";
import WhatSentinelLearned from "@/components/apex/WhatSentinelLearned";
import StagedVerdict from "@/components/apex/StagedVerdict";
import SentinelEdgePanel from "@/components/apex/SentinelEdgePanel";
import DigitPsychologyPanel from "@/components/apex/DigitPsychologyPanel";
import PriceActionPressurePanel from "@/components/apex/PriceActionPressurePanel";
import LosingSidePressurePanel from "@/components/apex/LosingSidePressurePanel";
import DbotHandoff from "@/components/apex/DbotHandoff";
import TradeFeedback from "@/components/apex/TradeFeedback";
import {
  AlertHistoryPanel,
  AlertSettingsPanel,
  CanonicalAlertBanner,
  OpportunityAlertCard,
} from "@/components/apex/OpportunityAlert";
import { useOpportunityAlerts } from "@/hooks/useOpportunityAlerts";
import { isExpired, opportunityKey, qualify } from "@/lib/sentinel/opportunity-alert";

import {
  DEFAULT_EXECUTION,
  loadExecutionSettings,
  recordEntry,
  saveExecutionSettings,
  listJournal,
  journalStats,
  subscribeJournal,
  type ExecutionMode,
} from "@/lib/apex/journal";
import { calibrationTable } from "@/lib/apex/memory";
import type { RankedOpportunity } from "@/lib/apex/types";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/apex")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Apex Sentinel Intelligence — continuous market intelligence" },
      {
        name: "description",
        content:
          "Continuously analyse every Deriv synthetic digit market, rank Over/Under contract opportunities in real time and interrogate the strongest setup on demand.",
      },
      { property: "og:title", content: "Apex Sentinel Intelligence" },
      {
        property: "og:description",
        content:
          "Continuous Market Intelligence. One Clear Opportunity. Real-time multi-engine Deriv digit-contract intelligence terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApexPage,
});

function ApexPage() {
  const [opts, setOpts] = useState<ScanOptions>(DEFAULT_SCAN_OPTIONS);
  const apex = useApexSentinel(opts);
  // Proactive alert layer — observes the existing ranked field, never re-scores.
  const alerts = useOpportunityAlerts(apex.ranked);
  const [reasoning, setReasoning] = useState<ApexReasoning | null>(null);
  const [tab, setTab] = useState("opportunity");
  const [aiLoading, setAiLoading] = useState(false);
  const runReasoning = useServerFn(apexReasoning);

  const bestRef = useRef<HTMLDivElement | null>(null);
  const [focusPulse, setFocusPulse] = useState(false);

  // ATOMIC ALERT → #1 PROMOTION.
  // The alerted candidate is promoted to #1 only while it still exists in the
  // live ranked field and still satisfies the UNCHANGED alert qualification.
  const alertedLive = useMemo(() => {
    const ep = alerts.episode;
    if (!ep || ep.status !== "ACTIVE" || isExpired(ep)) return null;
    const live = apex.ranked.find((o) => opportunityKey(o) === ep.key) ?? null;
    if (!live) return null;
    return qualify(live, alerts.config).ok ? live : null;
  }, [alerts.episode, alerts.config, apex.ranked]);

  const alertStale = !!alerts.episode && !alertedLive;
  const best = alertedLive ?? apex.scan?.top[0] ?? apex.ranked[0] ?? null;

  // AUTOMATIC VISUAL FOCUS — sound → look at screen → see the exact signal.
  const latestAlertId = alerts.latest?.id ?? null;
  useEffect(() => {
    if (!latestAlertId || !alertedLive) return;
    setTab("opportunity");
    setFocusPulse(true);
    const raf = requestAnimationFrame(() => {
      bestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const t = setTimeout(() => setFocusPulse(false), 4000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAlertId]);

  const askAI = useCallback(
    async (target: RankedOpportunity, globalDanger: number, runners: RankedOpportunity[]) => {
      setAiLoading(true);
      setReasoning(null);
      const c = target.contract;
      try {
        const r = await runReasoning({
          data: {
            symbol: target.symbol,
            market: target.name,
            contract: c.label,
            opportunity: Math.round(target.score),
            confidence: Math.round(c.confidence),
            edgePct: Number((c.edge * 100).toFixed(2)),
            edgeLowerBoundPct: Number((c.edgeLB * 100).toFixed(2)),
            quality: Math.round(c.quality),
            stability: Math.round(c.stability),
            freshness: Math.round(c.freshness),
            danger: Math.round(c.danger),
            contradiction: Math.round(c.contradiction),
            phase: c.phase,
            regime: target.intel.regime?.label ?? "UNKNOWN",
            sampleTicks: c.n,
            empiricalWinPct: Number((c.empirical * 100).toFixed(2)),
            theoreticalWinPct: Number((c.theoretical * 100).toFixed(2)),
            supports: c.supports.slice(0, 6),
            conflicts: c.conflicts.slice(0, 6),
            runnerUps: runners.map((r2) => ({
              market: r2.name,
              contract: r2.contract.label,
              score: Math.round(r2.score),
            })),
            globalDanger,

            adjustedWinPct: Number(((c.rate?.adjusted ?? c.empirical) * 100).toFixed(2)),
            winRateIntervalPct: [
              Number(((c.rate?.lower ?? 0) * 100).toFixed(2)),
              Number(((c.rate?.upper ?? 1) * 100).toFixed(2)),
            ] as [number, number],
            rateConfidence: c.rate?.confidence ?? "LOW",
            evidenceGrade: c.stats?.grade ?? "UNGRADED",
            statisticalNotes: c.stats?.notes.slice(0, 5) ?? [],
            losingDigits: c.threat?.losers ?? [],
            losingDigitThreats: (c.threat?.threats ?? []).slice(0, 4).map((t) => ({
              digit: t.digit,
              score: Math.round(t.score),
              state: t.state,
              drivers: t.drivers.slice(0, 3),
            })),
            groupThreat: Math.round(c.threat?.groupThreat ?? 0),
            threatState: c.threat?.state ?? "UNKNOWN",
            recurrence: c.threat?.recurrence ?? "UNKNOWN",
            pressureAsymmetry: Number((c.pressureAsymmetry ?? 0).toFixed(3)),
            criticalConflicts: (c.critical?.conflicts ?? []).map(
              (x) => `Digit ${x.digit} — ${x.role}`,
            ),
            criticalDetail: c.critical?.detail ?? "No critical digit structure conflict.",
            barStructure: target.intel.bars
              ? `${target.intel.bars.current?.color ?? "—"} bar, ${target.intel.bars.consecutive} consecutive, green rate ${(target.intel.bars.greenRate * 100).toFixed(0)}%`
              : "Bar structure unavailable.",
            increasingDigits: target.intel.digitIntel?.increasing.slice(0, 4) ?? [],
            decreasingDigits: target.intel.digitIntel?.decreasing.slice(0, 4) ?? [],
            models: (c.ensemble?.models ?? []).map((m) => ({
              label: m.label,
              status: m.status,
              probabilityPct: Number((m.probability * 100).toFixed(2)),
              oosAccuracyPct: Number((m.oosAccuracy * 100).toFixed(2)),
              baseRatePct: Number((m.baseRate * 100).toFixed(2)),
              testN: m.testN,
              note: m.note,
            })),
            modelAgreement: Math.round(c.ensemble?.agreement ?? 0),
            modelDisagreement: c.ensemble?.disagreement ?? "No validated models available.",
            forwardState: {
              direction: c.forward?.direction ?? "UNKNOWN",
              uncertainty: Math.round(c.forward?.uncertainty ?? 100),
              horizonTicks: c.forward?.horizonTicks ?? 0,
              statement: c.forward?.statement ?? "Forward projection unavailable.",
              risk: c.forward?.risk ?? "—",
              analogueSupport: c.forward?.analogueSupport ?? "No analogue support.",
            },
            fakeEdgeFailures: (c.fakeEdge?.answers ?? [])
              .filter((a) => !a.ok)
              .map((a) => `${a.question} ${a.answer}`),
            fakeEdgeVerdict: c.fakeEdge?.verdict ?? "UNTESTED",
            battle: target.intel.battle
              ? `${target.intel.battle.winner} wins by ${Math.round(target.intel.battle.margin)} — ${target.intel.battle.reason}`
              : "No head-to-head comparison available.",
            historicalAnalogue: c.analogue
              ? `${c.analogue.n} historical analogues, ${(c.analogue.rate * 100).toFixed(1)}% resolved in favour.`
              : "No historical analogue with sufficient sample.",
          },
        });
        setReasoning(r);
      } catch {
        setReasoning({
          analyst: "",
          devilsAdvocate: "",
          chief: "",
          available: false,
          error: "AI interpretation unavailable — quantitative engines unaffected.",
        });
      } finally {
        setAiLoading(false);
      }
    },
    [runReasoning],
  );

  const handleScan = useCallback(() => {
    const result = apex.runScan();
    if (result.top.length) {
      void askAI(result.top[0], result.globalDanger, result.top.slice(1));
    } else {
      setReasoning(null);
    }
  }, [apex, askAI]);

  return (
    <div className="min-h-screen grid-bg">
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
        <Header apex={apex} onScan={handleScan} />

        {apex.scan?.message && (
          <div
            className="glass rounded-lg border border-border/50 px-4 py-3 text-sm"
            style={{
              borderColor:
                apex.scan.verdict === "OPPORTUNITY"
                  ? "var(--bull)"
                  : apex.scan.verdict === "MODERATE"
                    ? "var(--warn)"
                    : "var(--border)",
            }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Scan verdict · {new Date(apex.scan.scannedAt).toLocaleTimeString()}
            </span>
            <p className="mt-1 text-foreground">{apex.scan.message}</p>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
            <TabsTrigger value="alerts">Alerts{alerts.episode ? " ●" : ""}</TabsTrigger>
            <TabsTrigger value="ranking">Cross-market ranking</TabsTrigger>
            <TabsTrigger value="markets">Market intelligence</TabsTrigger>
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
            <TabsTrigger value="entry">Entry lab</TabsTrigger>
            <TabsTrigger value="learning">Learning</TabsTrigger>
            <TabsTrigger value="execution">Execution &amp; journal</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunity" className="mt-5 space-y-5">
            {best ? (
              <>
                <BestOpportunity
                  item={best}
                  alerts={alerts}
                  cardRef={bestRef}
                  focused={focusPulse}
                  alertStale={alertStale}
                />
                <EntryConditionSummary item={best} />

                <Accordion type="multiple" className="space-y-3">
                  <AccordionItem
                    value="verdict"
                    className="glass rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      Verdict &amp; staged reasoning
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      <StagedVerdict item={best} />
                      <SentinelEdgePanel item={best} />
                      <DbotHandoff item={best} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="psychology"
                    className="glass rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      Digit psychology &amp; pressure
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pb-4">
                      <DigitPsychologyPanel item={best} />
                      <PriceActionPressurePanel item={best} />
                      <LosingSidePressurePanel item={best} />
                      <div className="grid gap-5 xl:grid-cols-2">
                        <PsychologyPanel intel={best.intel} />
                        <div className="space-y-5">
                          <SpecialDigitPanel intel={best.intel} />
                          <FluctuationPanel intel={best.intel} />
                        </div>
                      </div>
                      <div className="grid gap-5 xl:grid-cols-2">
                        <SensitiveDigitMonitor intel={best.intel} contract={best.contract} />
                        <PressureBalance contract={best.contract} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="quality"
                    className="glass rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      Quality metrics
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <QualityMetrics
                        item={best}
                        reasoning={reasoning}
                        aiLoading={aiLoading}
                        onAsk={() =>
                          askAI(
                            best,
                            apex.globalDanger,
                            (apex.scan?.top ?? apex.ranked).slice(1, 3),
                          )
                        }
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="forward"
                    className="glass rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      Forward projection &amp; exposure
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pb-4">
                      <ForwardProjectionPanel contract={best.contract} agreement={best.agreement} />
                      <ExposurePanel contract={best.contract} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="simdetail"
                    className="glass rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      Simulator detail
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <SimulatorWindows
                        symbol={best.symbol}
                        name={best.name}
                        contract={best.contract.id}
                        contractLabel={best.contract.label}
                        theoretical={best.contract.theoretical}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="runnerup"
                    className="glass rounded-xl border border-border/50 px-4"
                  >
                    <AccordionTrigger className="font-mono text-[11px] uppercase tracking-[0.22em]">
                      Why not the runner-up
                    </AccordionTrigger>
                    <AccordionContent className="space-y-5 pb-4">
                      <WhyNotRunnerUp
                        top={best}
                        runners={(apex.scan?.top ?? apex.ranked).slice(1, 3)}
                      />
                      <div className="grid gap-4 lg:grid-cols-2">
                        {(apex.scan?.top ?? apex.ranked).slice(1, 3).map((r, i) => (
                          <RunnerUp
                            key={`${r.symbol}-${r.contract.id}`}
                            item={r}
                            place={i === 0 ? "RUNNER-UP" : "THIRD PLACE"}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            ) : (
              <EmptyState apex={apex} />
            )}
          </TabsContent>

          <TabsContent value="alerts" className="mt-5 space-y-5">
            <OpportunityAlertCard alerts={alerts} ranked={apex.ranked} />
            <AlertSettingsPanel alerts={alerts} />
            <AlertHistoryPanel alerts={alerts} />
          </TabsContent>

          <TabsContent value="ranking" className="mt-5">
            <RankingTable rows={apex.ranked} />
            <RejectedList rejected={apex.scan?.rejected ?? []} />
          </TabsContent>

          <TabsContent value="markets" className="mt-5">
            <MarketGrid apex={apex} />
          </TabsContent>

          <TabsContent value="simulator" className="mt-5 space-y-5">
            <SimulatorCommandCenter />
            <SimulatorPanel />
          </TabsContent>

          <TabsContent value="entry" className="mt-5">
            <EntryConditionLab item={best ?? null} />
          </TabsContent>

          <TabsContent value="learning" className="mt-5 space-y-5">
            <GovernancePanel best={best ?? null} />
            <WhatSentinelLearned />
            <LearningDashboard />
          </TabsContent>

          <TabsContent value="execution" className="mt-5">
            <ExecutionPanel best={best} opts={opts} setOpts={setOpts} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type Apex = ReturnType<typeof useApexSentinel>;

function Header({ apex, onScan }: { apex: Apex; onScan: () => void }) {
  const dangerColor =
    apex.globalDangerLabel === "CALM"
      ? "var(--bull)"
      : apex.globalDangerLabel === "ELEVATED"
        ? "var(--warn)"
        : "var(--bear)";
  const engineHealth =
    apex.online === 0
      ? "OFFLINE"
      : apex.online >= apex.total - 2
        ? "ALL SYSTEMS OPERATIONAL"
        : "DEGRADED COVERAGE";

  return (
    <header className="glass flex flex-col gap-4 rounded-xl border border-border/50 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--neon)] to-[var(--accent)]">
          <Radar size={20} className="text-[var(--primary-foreground)]" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-wide neon-text">
            APEX SENTINEL <span className="text-[var(--accent)]">INTELLIGENCE</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Continuous market intelligence · One clear opportunity
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stat
          icon={Activity}
          label="Deriv"
          value={apex.status === "live" ? "CONNECTED" : apex.status.toUpperCase()}
          color={apex.status === "live" ? "var(--bull)" : "var(--warn)"}
        />
        <Stat
          icon={Database}
          label="Coverage"
          value={`${apex.online} / ${apex.total} ONLINE`}
          color={apex.online > 0 ? "var(--neon)" : "var(--bear)"}
        />
        <Stat icon={Gauge} label="Engines" value={engineHealth} color="var(--neon)" />
        <Stat
          icon={ShieldAlert}
          label="Global danger"
          value={`${apex.globalDangerLabel} · ${apex.globalDanger}`}
          color={dangerColor}
        />
        <Stat
          icon={Brain}
          label="Memory"
          value={`${apex.memory.states} states · ${apex.memory.observations} obs`}
          color="var(--muted-foreground)"
        />
        <Button onClick={onScan} size="lg" className="gap-2 font-semibold tracking-wide">
          <Zap size={16} />
          SCAN NOW
        </Button>
      </div>
    </header>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} style={{ color }} />
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className="font-mono text-xs font-semibold" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ apex }: { apex: Apex }) {
  return (
    <div className="glass rounded-xl border border-border/50 p-10 text-center">
      <Crosshair className="mx-auto mb-3 text-muted-foreground" />
      <h2 className="font-display text-base font-semibold">
        {apex.online === 0 ? "DATA UNAVAILABLE" : "NO RANKED OPPORTUNITY YET"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {apex.online === 0
          ? "No market is currently streaming enough ticks to analyse. The terminal will populate automatically once feeds recover."
          : "Markets are streaming but no contract currently clears danger, edge and freshness checks. The engines keep running."}
      </p>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const color =
    phase === "FRESH"
      ? "var(--bull)"
      : phase === "MATURE"
        ? "var(--neon)"
        : phase === "FORMING"
          ? "var(--muted-foreground)"
          : "var(--bear)";
  return (
    <span
      className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
      style={{ color, borderColor: color }}
    >
      {phase}
    </span>
  );
}

function BestOpportunity({
  item,
  alerts,
  cardRef,
  focused,
  alertStale,
}: {
  item: RankedOpportunity;
  alerts: ReturnType<typeof useOpportunityAlerts>;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  focused?: boolean;
  alertStale?: boolean;
}) {
  const c = item.contract;
  const sim = item.simulator;
  const simWins = sim && sim.n ? Math.round(sim.winRate * sim.n) : 0;
  const ep = item.entryPoint;
  const d = ep.preferred;
  const waitForEntry = item.signal?.waitForEntry ?? !d;
  const entryDigitText = d && !waitForEntry ? String(d.digit) : "WAIT";
  const surv = item.survival;
  const survivalValue = !surv ? "N/A" : surv.sufficient ? surv.label : "INSUFFICIENT";
  const survivalColor =
    !surv || !surv.sufficient
      ? "var(--warn)"
      : surv.label === "STRONG"
        ? "var(--bull)"
        : surv.label === "MODERATE"
          ? "var(--neon)"
          : surv.label === "LOW"
            ? "var(--warn)"
            : "var(--bear)";
  return (
    <section
      ref={cardRef}
      className="glass rounded-xl border border-border/50 p-5 transition-shadow duration-700 md:p-7"
      style={
        focused
          ? {
              borderColor: "var(--bull)",
              boxShadow: "0 0 0 2px color-mix(in oklab, var(--bull) 55%, transparent)",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-[var(--neon)]">
          #1 BEST CURRENT OPPORTUNITY
        </span>
        <PhaseBadge phase={c.phase} />
        {item.preferred && (
          <span className="rounded border border-[var(--accent)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
            Primary contract
          </span>
        )}
      </div>
      <h2 className="mt-2 font-display text-4xl font-bold md:text-5xl">
        {item.symbol} <span className="text-muted-foreground">·</span> {c.label}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {item.name} · regime {item.intel.regime?.label ?? "—"} · {c.n} tick sample
      </p>

      <div className="mt-5 flex flex-wrap gap-5">
        <ScoreRing value={item.score} label="Opportunity" tone="neon" size={120} />
        <ScoreRing value={c.confidence} label="Confidence" tone="bull" size={120} sublabel="" />
        <ScoreRing
          value={c.danger}
          label="Danger"
          tone={c.danger > 55 ? "bear" : "warn"}
          size={120}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Engine agreement
          </div>
          <div
            className="mt-0.5 font-mono text-2xl font-bold"
            style={{ color: item.agreement === "SUPPORT" ? "var(--bull)" : undefined }}
          >
            {item.agreement}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Simulated contracts won
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold">
            {sim && sim.n ? (
              <>
                {simWins} / {sim.n} won{" "}
                <span
                  style={{ color: sim.winRate >= c.theoretical ? "var(--bull)" : "var(--bear)" }}
                >
                  ({(sim.winRate * 100).toFixed(0)}%)
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No sample yet</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Entry point digit
          </div>
          <div
            className="mt-0.5 font-display text-4xl font-bold leading-none"
            style={{ color: d && !waitForEntry ? "var(--bull)" : "var(--warn)" }}
          >
            {entryDigitText}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {d && !waitForEntry
              ? `Wait for digit ${d.digit} to print`
              : (item.signal?.reason ?? "No digit has validated conditional evidence yet")}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Validity window
          </div>
          <div
            className="mt-0.5 font-mono text-sm font-bold"
            style={{ color: d && !waitForEntry ? "var(--neon)" : "var(--warn)" }}
          >
            {ep.window.label}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{ep.window.basis}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            DBot execution survival
          </div>
          <div className="mt-0.5 font-mono text-2xl font-bold" style={{ color: survivalColor }}>
            {survivalValue}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {surv
              ? surv.summary
              : "No validated entry digit, so post-entry survival is undefined here."}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-border/50 pt-5">
        <TradeFeedback item={item} />
      </div>

      <CanonicalAlertBanner item={item} alerts={alerts} stale={alertStale} />
    </section>
  );
}

function QualityMetrics({
  item,
  reasoning,
  aiLoading,
  onAsk,
}: {
  item: RankedOpportunity;
  reasoning: ApexReasoning | null;
  aiLoading: boolean;
  onAsk: () => void;
}) {
  const c = item.contract;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricBar label="Quality" value={c.quality} />
        <MetricBar label="Stability" value={c.stability} />
        <MetricBar label="Freshness" value={c.freshness} />
        <MetricBar label="Contradiction" value={c.contradiction} invert />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Empirical win" value={`${(c.empirical * 100).toFixed(2)}%`} />
        <Figure label="Theoretical" value={`${(c.theoretical * 100).toFixed(0)}%`} />
        <Figure
          label="Edge (95% LB)"
          value={`${(c.edge * 100).toFixed(2)}pp / ${(c.edgeLB * 100).toFixed(2)}pp`}
          tone={c.edgeLB > 0 ? "bull" : "bear"}
        />
        <Figure
          label="Composite edge"
          value={c.compositeEdge.toFixed(1)}
          tone={c.compositeEdge > 0 ? "bull" : "bear"}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Simulator (contract-resolved)"
          value={
            item.simulator && item.simulator.n
              ? `${(item.simulator.winRate * 100).toFixed(1)}% · N=${item.simulator.n}`
              : "NO SAMPLE"
          }
          tone={
            item.simulator && item.simulator.n
              ? item.simulator.winRate >= c.theoretical
                ? "bull"
                : "bear"
              : undefined
          }
        />
        <Figure
          label="Simulator expectancy"
          value={item.simulator && item.simulator.n ? item.simulator.expectancy.toFixed(3) : "—"}
        />
        <Figure
          label="Sensitive-digit risk"
          value={c.threat ? `${c.threat.groupThreat.toFixed(0)} · ${c.threat.state}` : "—"}
          tone={c.threat && c.threat.groupThreat > 55 ? "bear" : undefined}
        />
        <Figure
          label="Engine agreement"
          value={item.agreement}
          tone={item.agreement === "SUPPORT" ? "bull" : undefined}
        />
        <Figure
          label="Danger clearance"
          value={`${item.clearance.state} · risk ${item.clearance.risk.toFixed(0)}`}
          tone={
            item.clearance.state === "CLEAR"
              ? "bull"
              : item.clearance.state === "BLOCKED" || item.clearance.state === "UNSTABLE"
                ? "bear"
                : undefined
          }
        />
        <Figure
          label="Evidence status"
          value={`${item.evidence.status} · ${item.evidence.confidence}/100`}
          tone={
            item.evidence.status === "VALIDATED"
              ? "bull"
              : item.evidence.status === "UNDERPERFORMING" || item.evidence.status === "BLOCKED"
                ? "bear"
                : undefined
          }
        />
        <Figure
          label="Recent window (this market)"
          value={
            item.recent && item.recent.n
              ? `${(item.recent.winRate * 100).toFixed(1)}% · N=${item.recent.n}`
              : "NO RECENT SAMPLE"
          }
          tone={
            item.recent && item.recent.n
              ? item.recent.winRate >= c.theoretical
                ? "bull"
                : "bear"
              : undefined
          }
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">{item.simNote}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{item.clearance.summary}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{item.evidence.note}</p>
      {item.blocked ? (
        <div className="mt-3 rounded-lg border border-bear/40 bg-bear/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-bear">
            Blocked — shown, not deleted
          </p>
          <ul className="mt-1 space-y-1">
            {item.clearance.blockers.map((b) => (
              <li key={b.text} className="text-[11px] text-muted-foreground">
                • {b.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border border-border/60 bg-background/40 p-4">
        <SectionTitle hint="every point in the ranking score, attributed">
          Why this market ranks where it does
        </SectionTitle>
        <ul className="mt-2 space-y-1.5">
          {item.factors.map((f) => (
            <li key={f.label} className="flex items-baseline gap-3 text-xs">
              <span
                className="w-16 shrink-0 text-right font-mono"
                style={{
                  color: f.points > 0 ? "var(--bull)" : f.points < 0 ? "var(--bear)" : undefined,
                }}
              >
                {f.points > 0 ? "+" : ""}
                {f.points.toFixed(1)}
              </span>
              <span className="w-40 shrink-0 text-foreground/85">{f.label}</span>
              <span className="text-muted-foreground">{f.detail}</span>
            </li>
          ))}
          <li className="flex items-baseline gap-3 border-t border-border/50 pt-1.5 text-xs">
            <span className="w-16 shrink-0 text-right font-mono text-foreground">
              {item.score.toFixed(1)}
            </span>
            <span className="w-40 shrink-0 font-semibold text-foreground">Final ranking score</span>
            <span className="text-muted-foreground">Clamped to 0–100 after all contributions</span>
          </li>
        </ul>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle hint="quantitative evidence">Supporting evidence</SectionTitle>
          <EvidenceList
            items={c.supports.slice(0, 6)}
            tone="support"
            empty="No supporting evidence."
          />
        </div>
        <div>
          <SectionTitle hint="quantitative evidence">Conflicting evidence</SectionTitle>
          <EvidenceList
            items={c.conflicts.slice(0, 6)}
            tone="conflict"
            empty="No material conflicting evidence detected right now."
          />
        </div>
      </div>

      <div
        className="mt-6 rounded-lg border p-4"
        style={{ borderColor: "color-mix(in oklab, var(--bear) 40%, transparent)" }}
      >
        <SectionTitle hint="watch these — they end the setup">
          What would invalidate this ranking
        </SectionTitle>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {item.invalidation.map((r) => (
            <li key={r} className="flex gap-2">
              <span style={{ color: "var(--bear)" }}>▸</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-lg border border-border/60 bg-background/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle hint="interpretation only — never alters engine values">
            AI interpretation
          </SectionTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onAsk}
            disabled={aiLoading}
            className="gap-2"
          >
            <Sparkles size={14} />
            {aiLoading ? "Reasoning…" : "Run analyst chain"}
          </Button>
        </div>
        {aiLoading && (
          <p className="text-xs text-muted-foreground">
            Analyst → Devil's advocate → Chief intelligence…
          </p>
        )}
        {!aiLoading && !reasoning && (
          <p className="text-xs text-muted-foreground">
            Not requested yet. Quantitative evidence above stands on its own.
          </p>
        )}
        {reasoning && !reasoning.available && (
          <p className="flex items-center gap-2 text-xs" style={{ color: "var(--warn)" }}>
            <AlertTriangle size={13} /> {reasoning.error}
          </p>
        )}
        {reasoning?.available && (
          <div className="grid gap-4 md:grid-cols-3">
            <AIBlock title="Primary analyst" body={reasoning.analyst} />
            <AIBlock title="Devil's advocate" body={reasoning.devilsAdvocate} tone="bear" />
            <AIBlock title="Chief intelligence" body={reasoning.chief} tone="neon" />
          </div>
        )}
      </div>
    </div>
  );
}

function AIBlock({ title, body, tone = "muted" }: { title: string; body: string; tone?: string }) {
  const color =
    tone === "bear" ? "var(--bear)" : tone === "neon" ? "var(--neon)" : "var(--muted-foreground)";
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color }}>
        {title}
      </div>
      <p className="text-xs leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  const color =
    tone === "bull" ? "var(--bull)" : tone === "bear" ? "var(--bear)" : "var(--foreground)";
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function WhyNotRunnerUp({
  top,
  runners,
}: {
  top: RankedOpportunity;
  runners: RankedOpportunity[];
}) {
  const runner = runners[0];
  if (!runner) return null;
  const lines = whyNotRunnerUp(top, runner);
  return (
    <section className="glass rounded-xl border border-border/50 p-5">
      <SectionTitle hint={`${top.contract.label} vs ${runner.contract.label}`}>
        Why not the runner-up
      </SectionTitle>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-3 text-xs text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--neon)]" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RunnerUp({ item, place }: { item: RankedOpportunity; place: string }) {
  const c = item.contract;
  return (
    <div className="glass rounded-xl border border-border/50 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
          {place}
        </span>
        <PhaseBadge phase={c.phase} />
      </div>
      <h3 className="mt-2 font-display text-xl font-semibold">
        {item.symbol} · {c.label}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricBar label="Opportunity" value={item.score} />
        <MetricBar label="Danger" value={c.danger} invert />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {c.supports[0]?.label ?? "No dominant supporting evidence."} · edge{" "}
        {(c.edge * 100).toFixed(2)}pp
        {" · "}agreement {item.agreement}
        {item.simulator && item.simulator.n
          ? ` · simulator ${(item.simulator.winRate * 100).toFixed(1)}% (N=${item.simulator.n})`
          : " · simulator: no sample"}
      </p>
      {c.losingSidePressure ? (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Losing-side pressure {c.losingSidePressure.index.toFixed(0)}/100 ·{" "}
          {c.losingSidePressure.state} · ×{c.losingSidePressure.modifier.toFixed(3)}
        </p>
      ) : null}
    </div>
  );
}

function RankingTable({ rows }: { rows: RankedOpportunity[] }) {
  if (!rows.length) {
    return (
      <div className="glass rounded-xl border border-border/50 p-8 text-center text-sm text-muted-foreground">
        No contract currently qualifies. DATA THIN or every candidate failed danger / edge checks.
      </div>
    );
  }
  return (
    <div className="glass overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="p-3 text-left">#</th>
            <th className="p-3 text-left">Market</th>
            <th className="p-3 text-left">Contract</th>
            <th className="p-3 text-right">Score</th>
            <th className="p-3 text-right">Edge</th>
            <th className="p-3 text-right">Quality</th>
            <th className="p-3 text-right">Stability</th>
            <th className="p-3 text-right">Fresh</th>
            <th className="p-3 text-right">Danger</th>
            <th className="p-3 text-left">Phase</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {rows.slice(0, 40).map((r) => (
            <tr
              key={`${r.symbol}-${r.contract.id}`}
              className="border-b border-border/30 last:border-0"
            >
              <td className="p-3 text-muted-foreground">{r.rank}</td>
              <td className="p-3 font-sans">{r.symbol}</td>
              <td className="p-3 font-sans">{r.contract.label}</td>
              <td className="p-3 text-right font-semibold" style={{ color: "var(--neon)" }}>
                {r.score.toFixed(1)}
              </td>
              <td
                className="p-3 text-right"
                style={{ color: r.contract.edge > 0 ? "var(--bull)" : "var(--bear)" }}
              >
                {(r.contract.edge * 100).toFixed(2)}pp
              </td>
              <td className="p-3 text-right">{r.contract.quality.toFixed(0)}</td>
              <td className="p-3 text-right">{r.contract.stability.toFixed(0)}</td>
              <td className="p-3 text-right">{r.contract.freshness.toFixed(0)}</td>
              <td
                className="p-3 text-right"
                style={{
                  color: r.contract.danger > 55 ? "var(--bear)" : "var(--muted-foreground)",
                }}
              >
                {r.contract.danger.toFixed(0)}
              </td>
              <td className="p-3 font-sans">
                <PhaseBadge phase={r.contract.phase} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RejectedList({
  rejected,
}: {
  rejected: { symbol: string; contract: string; reason: string }[];
}) {
  if (!rejected.length) return null;
  return (
    <div className="glass mt-4 rounded-xl border border-border/50 p-4">
      <SectionTitle hint="from last SCAN NOW">Rejected alternatives</SectionTitle>
      <ul className="grid gap-1.5 md:grid-cols-2">
        {rejected.map((r, i) => (
          <li key={i} className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground/80">{r.symbol}</span> · {r.contract} — {r.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarketGrid({ apex }: { apex: Apex }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {apex.intels.map((m) => {
        const stateColor =
          m.dataState === "OK"
            ? "var(--bull)"
            : m.dataState === "THIN"
              ? "var(--warn)"
              : "var(--bear)";
        return (
          <div key={m.symbol} className="glass rounded-lg border border-border/50 p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-display text-sm font-semibold">{m.symbol}</div>
                <div className="text-[10px] text-muted-foreground">{m.name}</div>
              </div>
              <span
                className="font-mono text-[10px] tracking-[0.18em]"
                style={{ color: stateColor }}
              >
                {m.dataState === "OK" ? "LIVE" : `DATA ${m.dataState}`}
              </span>
            </div>
            {m.stats ? (
              <>
                <div className="mt-3 flex gap-1">
                  {m.stats.recentPct.map((p, d) => (
                    <div key={d} className="flex-1 text-center">
                      <div className="h-12 w-full rounded-sm bg-border/40 relative overflow-hidden">
                        <div
                          className="absolute bottom-0 w-full"
                          style={{
                            height: `${Math.min(100, p * 500)}%`,
                            background:
                              p > 0.12 ? "var(--bull)" : p < 0.08 ? "var(--bear)" : "var(--neon)",
                            opacity: 0.85,
                          }}
                        />
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-muted-foreground">{d}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
                  <span>ticks {m.ticks}</span>
                  <span>regime {m.regime?.label}</span>
                  <span>vol {m.volatility?.ratio.toFixed(2)}×</span>
                  <span>entropy {((m.entropy?.entropy ?? 0) * 100).toFixed(1)}%</span>
                  <span>anomaly {m.anomaly?.score.toFixed(0)}</span>
                  <span>danger {m.danger}</span>
                </div>
                {m.best && (
                  <div className="mt-3 border-t border-border/50 pt-2 text-xs">
                    Best: <span className="font-semibold">{m.best.label}</span>{" "}
                    <span className="font-mono text-muted-foreground">
                      opp {m.best.opportunity.toFixed(0)} · edge {(m.best.edge * 100).toFixed(2)}pp
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                DATA UNAVAILABLE — awaiting feed.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExecutionPanel({
  best,
  opts,
  setOpts,
}: {
  best: RankedOpportunity | null;
  opts: ScanOptions;
  setOpts: (o: ScanOptions) => void;
}) {
  const [settings, setSettings] = useState(DEFAULT_EXECUTION);
  const [, force] = useState(0);

  useEffect(() => {
    setSettings(loadExecutionSettings());
    const unsub = subscribeJournal(() => force((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);

  const entries = useMemo(() => listJournal().slice(0, 20), []);
  const stats = journalStats();
  const calib = calibrationTable().filter((c) => c.n >= 20);

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveExecutionSettings(next);
  };

  const logSetup = () => {
    if (!best) return;
    if (settings.mode !== "PAPER" && settings.mode !== "MANUAL") {
      toast.error("Enable Manual or Paper mode to log a setup.");
      return;
    }
    recordEntry({
      mode: settings.mode,
      symbol: best.symbol,
      name: best.name,
      contract: best.contract.id,
      contractLabel: best.contract.label,
      opportunity: Math.round(best.score),
      confidence: Math.round(best.contract.confidence),
      edgePct: Number((best.contract.edge * 100).toFixed(2)),
      danger: Math.round(best.contract.danger),
      quality: Math.round(best.contract.quality),
      entryDigitIndex: best.intel.ticks,
    });
    force((n) => n + 1);
    toast.success(`${settings.mode} entry logged — ${best.symbol} ${best.contract.label}`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="glass space-y-4 rounded-xl border border-border/50 p-4">
        <SectionTitle hint="analysis and execution stay separate">Execution policy</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {(["MANUAL", "PAPER", "DBOT", "API"] as ExecutionMode[]).map((m) => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className="rounded border px-2 py-1.5 font-mono text-[10px] tracking-[0.12em] transition-colors"
              style={{
                borderColor: settings.mode === m ? "var(--neon)" : "var(--border)",
                color: settings.mode === m ? "var(--neon)" : "var(--muted-foreground)",
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Manual is the default. DBot and direct API remain analysis-only until you explicitly wire
          an account; no automated order is ever fired by the intelligence layer.
        </p>
        <NumberField
          label="Max open trades"
          value={settings.maxOpenTrades}
          min={1}
          max={3}
          onChange={(v) => update({ maxOpenTrades: v })}
        />
        <NumberField
          label="Opportunity threshold"
          value={opts.opportunityThreshold}
          min={40}
          max={95}
          onChange={(v) => setOpts({ ...opts, opportunityThreshold: v })}
        />
        <NumberField
          label="Preference window (Under 7 / Over 2)"
          value={opts.preferenceWindow}
          min={0}
          max={15}
          onChange={(v) => setOpts({ ...opts, preferenceWindow: v })}
        />
        <NumberField
          label="Max danger"
          value={opts.maxDanger}
          min={20}
          max={100}
          onChange={(v) => setOpts({ ...opts, maxDanger: v })}
        />
        <Button onClick={logSetup} disabled={!best} className="w-full">
          Log current #1 to journal
        </Button>
        {best && (
          <div className="rounded-md border border-border/60 p-3 font-mono text-[11px] text-muted-foreground">
            <div>Market: {best.symbol}</div>
            <div>Contract: {best.contract.label.toUpperCase()}</div>
            <div>Duration: 1 tick</div>
          </div>
        )}
      </div>

      <div className="glass rounded-xl border border-border/50 p-4 lg:col-span-2">
        <SectionTitle
          hint={`${stats.settled} settled · ${(stats.winRate * 100).toFixed(0)}% win rate`}
        >
          Journal
        </SectionTitle>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        ) : (
          <table className="w-full font-mono text-[11px]">
            <thead className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="p-1.5 text-left">Time</th>
                <th className="p-1.5 text-left">Mode</th>
                <th className="p-1.5 text-left">Market</th>
                <th className="p-1.5 text-left">Contract</th>
                <th className="p-1.5 text-right">Opp</th>
                <th className="p-1.5 text-right">Danger</th>
                <th className="p-1.5 text-left">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border/30">
                  <td className="p-1.5">{new Date(e.ts).toLocaleTimeString()}</td>
                  <td className="p-1.5">{e.mode}</td>
                  <td className="p-1.5">{e.symbol}</td>
                  <td className="p-1.5">{e.contractLabel}</td>
                  <td className="p-1.5 text-right">{e.opportunity}</td>
                  <td className="p-1.5 text-right">{e.danger}</td>
                  <td className="p-1.5">{e.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6">
          <SectionTitle hint="observed outcomes only">Confidence calibration</SectionTitle>
          {calib.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              DATA THIN — the terminal needs more observed tick outcomes before calibration is
              meaningful.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {calib.map((c) => (
                <div
                  key={c.decile}
                  className="rounded border border-border/60 p-2 font-mono text-[11px]"
                >
                  confidence {c.decile * 10}–{c.decile * 10 + 9}: observed{" "}
                  {(c.rate * 100).toFixed(1)}% (n={c.n})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--neon)]"
      />
      <span className="font-mono text-xs text-foreground">{value}</span>
    </label>
  );
}
