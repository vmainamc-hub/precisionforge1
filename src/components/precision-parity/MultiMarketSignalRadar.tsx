// Precision Parity AI — Multi-Market Real-Time Signal Generator & Radar.
// Constantly monitors ALL volatility markets simultaneously, fuses specialist engines,
// and emits precise, actionable trade signals:
// e.g. "Volatility 10 (1s) Index → BUY ODD | Entry Digit: 7 | Setup Valid For: 60s"

import React, { useState } from "react";
import {
  Sparkles,
  Zap,
  Target,
  Clock,
  Volume2,
  VolumeX,
  Copy,
  Check,
  TrendingUp,
  ShieldCheck,
  Layers,
  ArrowRight,
  RefreshCw,
  Flame,
  Radio,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmittedParityOpportunity, MarketParityReport } from "@/lib/precision-parity/types";

interface Props {
  opportunities: EmittedParityOpportunity[];
  topOpportunity: EmittedParityOpportunity | null;
  markets: MarketParityReport[];
  selectedMarket: string;
  onSelectMarket: (market: string) => void;
  audioAlerts: boolean;
  onToggleAudioAlerts: () => void;
  onScanNow: () => void;
  scanning: boolean;
  journal: EmittedParityOpportunity[];
}

export function MultiMarketSignalRadar({
  opportunities,
  topOpportunity,
  markets,
  selectedMarket,
  onSelectMarket,
  audioAlerts,
  onToggleAudioAlerts,
  onScanNow,
  scanning,
  journal,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"radar" | "all-markets" | "journal">("radar");

  const copyPayload = (opp: EmittedParityOpportunity) => {
    const text = `${opp.marketName} → ${opp.contractLabel} | Entry Digit: ${opp.entryDigit} | Setup valid for ${opp.remainingSeconds}s | Confidence: ${opp.confidence}%`;
    navigator.clipboard.writeText(text);
    setCopiedId(opp.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCount = opportunities.filter((o) => o.status !== "EXPIRED").length;
  const enterNowCount = opportunities.filter((o) => o.status === "ENTER_NOW").length;

  return (
    <div className="space-y-5" id="multi-market-signal-radar">
      {/* Top Controls & Status Bar */}
      <div className="glass rounded-2xl border border-border/70 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-base sm:text-lg font-bold text-foreground tracking-tight">
                Multi-Market Real-Time Signal Radar
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                LIVE PARALLEL SCAN
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Scanning all synthetic volatility indices simultaneously with Markov, Weibull hazard,
              EV gate &amp; Dirichlet engines.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Signal Stats Pills */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border/60 text-xs font-mono">
            <span className="text-muted-foreground">Active Setups:</span>
            <span className="font-bold text-emerald-400">{activeCount}</span>
          </div>

          {enterNowCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-mono text-rose-300 animate-bounce">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>{enterNowCount} TRIGGER HIT (ENTER NOW)</span>
            </div>
          )}

          {/* Audio Chime Toggle */}
          <button
            onClick={onToggleAudioAlerts}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all",
              audioAlerts
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                : "bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground",
            )}
            title="Toggle audio alert chime on trigger digit match"
          >
            {audioAlerts ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio Alert: ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Audio Alert: OFF</span>
              </>
            )}
          </button>

          {/* Force Scan Button */}
          <button
            onClick={onScanNow}
            disabled={scanning}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all",
              scanning
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-[var(--accent)] text-slate-950 hover:opacity-90 shadow-md",
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", scanning && "animate-spin")} />
            <span>{scanning ? "Scanning..." : "Rescan Markets"}</span>
          </button>
        </div>
      </div>

      {/* View Switcher Pills */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView("radar")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5",
              activeView === "radar"
                ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm"
                : "bg-secondary/30 border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Top Emitted Signals ({opportunities.length})</span>
          </button>

          <button
            onClick={() => setActiveView("all-markets")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5",
              activeView === "all-markets"
                ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shadow-sm"
                : "bg-secondary/30 border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All 10+ Scanned Volatilities ({markets.length})</span>
          </button>

          <button
            onClick={() => setActiveView("journal")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5",
              activeView === "journal"
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm"
                : "bg-secondary/30 border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Signal Alert Log ({journal.length})</span>
          </button>
        </div>
      </div>

      {/* ── VIEW 1: RADAR / TOP OPPORTUNITIES ── */}
      {activeView === "radar" && (
        <div className="space-y-5">
          {/* PRIMARY HERO SIGNAL CARD (The Top Ranked High-Conviction Opportunity) */}
          {topOpportunity ? (
            <div
              className={cn(
                "rounded-3xl border glass overflow-hidden shadow-2xl transition-all duration-300",
                topOpportunity.status === "ENTER_NOW"
                  ? "border-emerald-500/80 shadow-emerald-500/20 bg-gradient-to-b from-emerald-950/40 via-background to-background"
                  : "border-border/80 bg-gradient-to-b from-secondary/40 via-background to-background",
              )}
            >
              {/* Header Stripe */}
              <div className="border-b border-border/50 bg-secondary/60 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    PRIMARY EMITTED SIGNAL
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {topOpportunity.marketName} ({topOpportunity.market})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Validity Badge */}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold border",
                      topOpportunity.remainingSeconds > 20
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                        : "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse",
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Setup valid: {topOpportunity.remainingSeconds}s remaining</span>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() => copyPayload(topOpportunity)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border/60 hover:bg-secondary/80 text-xs font-mono text-muted-foreground hover:text-foreground transition-all"
                  >
                    {copiedId === topOpportunity.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === topOpportunity.id ? "Copied" : "Copy Directive"}</span>
                  </button>
                </div>
              </div>

              {/* Main Signal Body */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Visual Directives Banner */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Column 1: Market & Contract Directive */}
                  <div className="md:col-span-4 space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      RECOMMENDED ACTION
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "px-4 py-2 rounded-2xl text-xl sm:text-2xl font-mono font-black tracking-wide border shadow-xl flex items-center gap-2.5",
                          topOpportunity.contract === "BUY_EVEN"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10"
                            : "bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-indigo-500/10",
                        )}
                      >
                        <Target className="w-6 h-6" />
                        <span>{topOpportunity.contractLabel}</span>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        Duration: <strong>1 Tick</strong>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Exact Entry Trigger Digit (Hero Box) */}
                  <div className="md:col-span-5">
                    <div className="p-4 rounded-2xl border border-border/70 bg-secondary/30 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground font-semibold">
                          EXACT ENTRY TRIGGER DIGIT
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold font-mono",
                            topOpportunity.isTriggerDigitShowing
                              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 animate-pulse"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40",
                          )}
                        >
                          {topOpportunity.isTriggerDigitShowing
                            ? "DIGIT PRINTED — ENTER NOW!"
                            : "WAITING FOR DIGIT"}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center font-mono text-3xl font-black border transition-all shadow-xl",
                            topOpportunity.isTriggerDigitShowing
                              ? "bg-emerald-500 text-slate-950 border-emerald-300 scale-105 ring-4 ring-emerald-500/30"
                              : "bg-secondary/80 text-foreground border-border/80",
                          )}
                        >
                          {topOpportunity.entryDigit}
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          <div className="text-foreground font-bold">
                            Wait for digit{" "}
                            <span className="text-emerald-400 text-sm">
                              [{topOpportunity.entryDigit}]
                            </span>{" "}
                            to print
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            Current live digit:{" "}
                            <span className="font-bold text-foreground">
                              {topOpportunity.lastDigit}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Setup Validity Countdown */}
                  <div className="md:col-span-3 space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                      SETUP VALIDITY
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono font-bold">
                        <span className="text-muted-foreground">Time Remaining:</span>
                        <span
                          className={cn(
                            topOpportunity.remainingSeconds > 20
                              ? "text-cyan-300"
                              : "text-rose-400",
                          )}
                        >
                          {topOpportunity.remainingSeconds}s / 60s
                        </span>
                      </div>
                      {/* Visual progress bar */}
                      <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden border border-border/50">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            topOpportunity.remainingSeconds > 20
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                              : "bg-gradient-to-r from-amber-500 to-rose-500",
                          )}
                          style={{
                            width: `${(topOpportunity.remainingSeconds / 60) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quantitative Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40">
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Confidence
                    </div>
                    <div className="font-mono text-base font-bold text-emerald-400">
                      {topOpportunity.confidence}%
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Expected Value (EV)
                    </div>
                    <div className="font-mono text-base font-bold text-cyan-400">
                      +{(topOpportunity.expectedValue * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      P(Win | Digit {topOpportunity.entryDigit})
                    </div>
                    <div className="font-mono text-base font-bold text-foreground">
                      {(topOpportunity.winRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      Kelly Stake
                    </div>
                    <div className="font-mono text-base font-bold text-amber-300">
                      ${topOpportunity.suggestedStake.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Consensus Engine Proof Strip */}
                <div className="p-4 rounded-xl bg-secondary/20 border border-border/40 space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    Specialist Engine Confluence &amp; Quantitative Proof
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topOpportunity.consensusEngines.map((eng, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/60 text-xs font-mono text-foreground flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <strong>{eng.name}:</strong>
                        <span className="text-muted-foreground">{eng.vote}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs font-mono text-muted-foreground">
                    Canonical directive:{" "}
                    <span className="text-foreground font-semibold">
                      {topOpportunity.instructionHeadline}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectMarket(topOpportunity.market)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-slate-950 font-mono font-bold text-xs transition-all shadow-md"
                  >
                    <span>Focus on {topOpportunity.marketName}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 p-10 text-center space-y-3 glass">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="font-mono text-base font-bold text-foreground">
                Scanning All Markets for Confluence...
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No active setups currently clear the minimum statistical edge (+10% EV, FDR q &lt;
                0.05). The system is streaming ticks from all volatility indices and will emit
                signals the instant edge appears.
              </p>
            </div>
          )}

          {/* SECONDARY ACTIVE SIGNALS STREAM (All other currently active market setups) */}
          {opportunities.length > 1 && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Other Active Market Opportunities ({opportunities.length - 1})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {opportunities.slice(1).map((opp) => (
                  <div
                    key={opp.id}
                    className={cn(
                      "rounded-2xl border glass p-4 space-y-3.5 transition-all hover:border-[var(--accent)]/50",
                      opp.status === "ENTER_NOW"
                        ? "border-emerald-500/70 bg-emerald-950/20 shadow-lg shadow-emerald-500/10"
                        : "border-border/60 bg-secondary/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div>
                        <div className="font-mono text-xs font-bold text-foreground">
                          {opp.marketName}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {opp.market}
                        </div>
                      </div>

                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border",
                          opp.contract === "BUY_EVEN"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
                        )}
                      >
                        {opp.contractLabel}
                      </span>
                    </div>

                    {/* Entry Trigger & Validity */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-secondary/40 border border-border/40">
                        <div className="text-[9px] uppercase text-muted-foreground">
                          Trigger Digit
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span
                            className={cn(
                              "w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs",
                              opp.isTriggerDigitShowing
                                ? "bg-emerald-500 text-slate-950 font-black animate-pulse"
                                : "bg-secondary text-foreground",
                            )}
                          >
                            {opp.entryDigit}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            (Live: {opp.lastDigit})
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-secondary/40 border border-border/40">
                        <div className="text-[9px] uppercase text-muted-foreground">Validity</div>
                        <div className="font-bold text-cyan-300 pt-0.5">
                          {opp.remainingSeconds}s left
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1 border-t border-border/30">
                      <span>
                        Conf: <strong className="text-emerald-400">{opp.confidence}%</strong>
                      </span>
                      <span>
                        EV:{" "}
                        <strong className="text-cyan-400">
                          +{(opp.expectedValue * 100).toFixed(0)}%
                        </strong>
                      </span>
                      <button
                        onClick={() => onSelectMarket(opp.market)}
                        className="text-[var(--accent)] hover:underline flex items-center gap-1 font-semibold"
                      >
                        Select <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: ALL SCANNED MARKETS MATRIX ── */}
      {activeView === "all-markets" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground">
            Complete real-time cross-market telemetry across all synthetic volatility indices.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {markets.map((m) => {
              const rec = m.verdict.recommendation;
              const isEven = rec === "BUY_EVEN";
              const isTrade = rec !== "NO_TRADE";
              const opp = opportunities.find((o) => o.market === m.market);

              return (
                <div
                  key={m.market}
                  onClick={() => onSelectMarket(m.market)}
                  className={cn(
                    "rounded-2xl border glass p-4 space-y-3 cursor-pointer transition-all hover:border-[var(--accent)] hover:shadow-lg",
                    selectedMarket === m.market &&
                      "ring-2 ring-[var(--accent)]/50 border-[var(--accent)]",
                    isTrade ? "bg-secondary/30" : "bg-secondary/10 opacity-80",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm font-bold text-foreground">{m.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {m.market} · {m.ticks} ticks
                      </div>
                    </div>

                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border",
                        rec === "BUY_EVEN"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : rec === "BUY_ODD"
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                            : "bg-secondary/60 text-muted-foreground border-border/50",
                      )}
                    >
                      {rec.replace("_", " ")}
                    </span>
                  </div>

                  {opp ? (
                    <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/50 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Entry Trigger:</span>
                        <span className="font-bold text-emerald-400">
                          Wait for Digit {opp.entryDigit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Setup Validity:</span>
                        <span className="font-bold text-cyan-300">{opp.remainingSeconds}s</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/30 text-xs font-mono text-muted-foreground">
                      Status: {m.verdict.state} (Confidence: {m.verdict.confidence}%)
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                    <span>
                      Streak: {m.verdict.hypotheses[0]?.persistenceTicks ?? 0}{" "}
                      {m.verdict.hypotheses[0]?.contract}
                    </span>
                    <span>EV: +{((m.signal?.expectedValue ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VIEW 3: SIGNAL ALERT JOURNAL ── */}
      {activeView === "journal" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground">
            Chronological audit log of all trade signals emitted across every volatility market.
          </div>

          {journal.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border/60 text-center font-mono text-xs text-muted-foreground glass">
              No historical signals logged yet in this session. Signals will populate here
              automatically as they are emitted.
            </div>
          ) : (
            <div className="space-y-2.5">
              {journal.map((j) => (
                <div
                  key={j.id}
                  className="rounded-xl border border-border/60 glass p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(j.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="font-bold text-foreground">{j.marketName}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-bold",
                        j.contract === "BUY_EVEN"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40",
                      )}
                    >
                      {j.contractLabel}
                    </span>
                    <span className="text-muted-foreground">
                      Trigger: <strong>Digit {j.entryDigit}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">
                      Conf: <strong>{j.confidence}%</strong>
                    </span>
                    <span className="text-cyan-400">
                      EV: <strong>+{(j.expectedValue * 100).toFixed(1)}%</strong>
                    </span>
                    <button
                      onClick={() => onSelectMarket(j.market)}
                      className="px-2.5 py-1 rounded bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-mono border border-border/60 transition-colors"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
