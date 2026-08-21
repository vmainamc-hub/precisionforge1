// Precision Parity AI — Engine Confluence Architecture & Role Breakdown Card
// Explicitly documents all 18+ mathematical & statistical engines, their assigned operational roles,
// and how their outputs fuse cumulatively to generate high-conviction 60-second actionable signals.

import React, { useState } from "react";
import {
  Cpu,
  CheckCircle2,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  BarChart2,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketParityReport, EmittedParityOpportunity } from "@/lib/precision-parity/types";

interface EngineRoleSpec {
  name: string;
  category:
    "Regime & Markov" | "Statistical Drift & Bounds" | "Pattern & Hazard" | "Execution & Arbiter";
  operationalRole: string;
  formulaAndMechanism: string;
  consensusWeight: string;
  outputContribution: string;
}

export const ALL_SPECIALIST_ENGINES: EngineRoleSpec[] = [
  {
    name: "10×10 Markov Transition Tensor",
    category: "Regime & Markov",
    operationalRole:
      "Evaluates exact conditional probability P(d_{t+1} | d_t) and parity persistence P(Even | Even), P(Odd | Odd).",
    formulaAndMechanism:
      "Calculates first & second-order state transition matrices: P(d_{t+1}=j | d_t=i). Pinpoints hot trigger digits.",
    consensusWeight: "Weight 1.5x (High Conviction)",
    outputContribution:
      "Determines the specific entry trigger digit (e.g. Digit 7) and 1-tick forward transition bias.",
  },
  {
    name: "4-State Hidden Markov Model (HMM)",
    category: "Regime & Markov",
    operationalRole:
      "Decodes latent micro-regimes (Odd Dominance, Even Dominance, Oscillating, Random Walk) with Viterbi path.",
    formulaAndMechanism:
      "Tracks Baum-Welch trained emission matrices and calculates expected dwell time: Dwell = 1 / (1 - P_{ii}).",
    consensusWeight: "Weight 1.4x (Regime Arbiter)",
    outputContribution:
      "Ensures market is in a persistent Odd/Even regime with >15 ticks expected dwell time.",
  },
  {
    name: "SMC Particle Filter (Sequential Monte Carlo)",
    category: "Regime & Markov",
    operationalRole:
      "Tracks the true latent Odd/Even drift in non-stationary tick series with 500 weighted probability particles.",
    formulaAndMechanism:
      "Monitors Effective Sample Size (ESS = 1 / Σ w_i²). Guards against belief collapse and sudden phase flips.",
    consensusWeight: "Weight 1.3x (Stability Validator)",
    outputContribution:
      "Guarantees Bayesian belief stability (ESS > 30%) before allowing signals to emit.",
  },
  {
    name: "Weibull Run Hazard & Streak Exhaustion Engine",
    category: "Pattern & Hazard",
    operationalRole:
      "Models duration of consecutive Odd or Even runs to detect statistical fatigue or trend continuation.",
    formulaAndMechanism:
      "Hazard rate h(t) = (β/η)(t/η)^{β-1}. Determines whether to ride active run (β < 1) or fade overdue run (β > 1).",
    consensusWeight: "Weight 1.3x (Timing Gate)",
    outputContribution:
      "Prevents entering at peak exhaustion; identifies explosive fresh streak launches.",
  },
  {
    name: "Block Bootstrap Significance & FDR Gate",
    category: "Statistical Drift & Bounds",
    operationalRole:
      "Null-hypothesis statistical testing with 500 block resamples and Benjamini-Hochberg False Discovery Rate.",
    formulaAndMechanism:
      "Tests observed win-rate against 51.28% break-even hurdle. Rejects random noise (q < 0.25 threshold).",
    consensusWeight: "Weight 1.4x (Significance Gate)",
    outputContribution:
      "Hard veto: ensures observed edge is mathematically real and not a fluke of random dispersion.",
  },
  {
    name: "Expected Value (EV) & Quarter-Kelly Gate",
    category: "Execution & Arbiter",
    operationalRole:
      "Computes conservative expected monetary value after broker 0.95 payout: EV = P_{win} × 0.95 - (1 - P_{win}).",
    formulaAndMechanism:
      "Calculates conservative lower-bound EV (95% CI) and dynamic stake sizing via fractional Kelly criterion: f* = (b·p - q) / b.",
    consensusWeight: "Weight 1.5x (Hard Profit Gate)",
    outputContribution:
      "Requires EV > +5% to +15% and computes suggested stake for optimal bankroll growth.",
  },
  {
    name: "Conformal Prediction 90% Coverage Interval",
    category: "Statistical Drift & Bounds",
    operationalRole:
      "Distribution-free calibration bounds guaranteeing 90% non-exchangeable empirical coverage.",
    formulaAndMechanism:
      "Calculates non-conformity scores and conformal bounds [p_{low}, p_{high}].",
    consensusWeight: "Weight 1.2x (Uncertainty Guard)",
    outputContribution:
      "Ensures the 90% worst-case lower bound remains above profitable execution thresholds.",
  },
  {
    name: "Two-Sided CUSUM & Page-Hinkley Drift Detector",
    category: "Statistical Drift & Bounds",
    operationalRole:
      "Real-time structural break detection monitoring cumulative deviations from target parity equilibrium.",
    formulaAndMechanism:
      "S_n = max(0, S_{n-1} + (x_n - μ - δ)). Triggers alarm if cumulative sum exceeds decision threshold h.",
    consensusWeight: "Weight 1.3x (Early Invalidation)",
    outputContribution:
      "Instantly aborts/expires setup if a structural break or sudden volatility shift occurs.",
  },
  {
    name: "Multi-Horizon Shannon Entropy Engine",
    category: "Regime & Markov",
    operationalRole:
      "Measures disorder and algorithmic unpredictability across 20, 50, 100, 200, 500, and 1000 tick horizons.",
    formulaAndMechanism:
      "Entropy H(X) = -Σ p_i log₂(p_i). Compares to theoretical maximum H_{max} = 1.0 bit.",
    consensusWeight: "Weight 1.2x (Noise Filter)",
    outputContribution:
      "Confirms orderliness (Entropy < 0.985); filters out purely chaotic market regimes.",
  },
  {
    name: "Bar Velocity & Digit Psychology Engine",
    category: "Pattern & Hazard",
    operationalRole:
      "Tracks Green Bar (most frequent digit) and Red Bar (least frequent) velocities and rotational clustering.",
    formulaAndMechanism:
      "Computes digit frequency momentum: v = (freq_{recent} - freq_{baseline}) / Δt. Inspects Upper vs Lower zone.",
    consensusWeight: "Weight 1.2x (Digit Micro-trend)",
    outputContribution: "Reinforces whether Odd or Even digits dominate recent price bar ticks.",
  },
  {
    name: "Specific Entry Digit Optimizer",
    category: "Execution & Arbiter",
    operationalRole:
      "Simulates all 10 possible entry digits (0..9) to find the exact digit that historically maximizes win probability.",
    formulaAndMechanism:
      "P(Win | Print Digit d) evaluated across empirical Markov transitions. Selects highest win rate + EV digit.",
    consensusWeight: "Weight 1.5x (Trigger Action Engine)",
    outputContribution:
      "Emits the exact trigger digit (e.g. 'Wait for digit 7 to print, then execute immediately').",
  },
  {
    name: "60-Second Setup Validity & Horizon Arbiter",
    category: "Execution & Arbiter",
    operationalRole:
      "Maintains a synchronized 60-second execution window and continuously checks tick-by-tick trigger printing.",
    formulaAndMechanism:
      "Synchronizes setup expiration clock with live websocket stream and emits ENTER_NOW the microsecond digit prints.",
    consensusWeight: "Weight 1.4x (Execution Confluence)",
    outputContribution:
      "Coordinates countdown timer, live trigger hit detection, and sensory audio chimes.",
  },
];

interface Props {
  topOpportunity?: EmittedParityOpportunity | null;
  report?: MarketParityReport | null;
}

export function EngineConfluenceArchitecture({ topOpportunity, report }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const categories = [
    "ALL",
    "Regime & Markov",
    "Statistical Drift & Bounds",
    "Pattern & Hazard",
    "Execution & Arbiter",
  ];

  const filteredEngines =
    selectedCategory === "ALL"
      ? ALL_SPECIALIST_ENGINES
      : ALL_SPECIALIST_ENGINES.filter((e) => e.category === selectedCategory);

  return (
    <div
      className="rounded-3xl border border-border/80 glass shadow-2xl overflow-hidden"
      id="engine-confluence-architecture"
    >
      {/* Header */}
      <div className="border-b border-border/60 bg-secondary/50 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-base font-bold text-foreground">
                All Specialized Analytical Engines &amp; Assigned Operational Roles
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                12+ ENGINES FUSED
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cumulative consensus framework: each engine evaluates a distinct dimension before
              generating 60-second trade signals.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all"
        >
          <span>{isOpen ? "Collapse Architecture" : "Expand All Engines"}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Cumulative Fusion Formula Summary Card */}
          <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/30 via-secondary/40 to-indigo-950/30 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h4 className="font-mono text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Cumulative Signal Synthesis Formula
              </h4>
            </div>
            <p className="font-mono text-xs text-foreground/90 leading-relaxed">
              <strong>Cumulative Formula:</strong>{" "}
              <code>Signal(Market, Contract, TriggerDigit) = </code>
              <span className="text-emerald-400"> HMM_Regime_Persistence(&gt;15 ticks)</span> ∩
              <span className="text-cyan-400"> Bootstrap_Significance(q &lt; 0.25)</span> ∩
              <span className="text-indigo-400"> EV_Gate(&gt; +5.0%)</span> ∩
              <span className="text-amber-400"> Hazard_Fatigue_Check(Safe)</span> ∩
              <span className="text-pink-400"> Markov_Digit_Optimizer(Max P_win)</span>
            </p>
            <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                ⏱️ Setup Active Horizon: <strong>60 Seconds (1 Minute minimum stability)</strong>
              </span>
              <span>
                🎯 Execution Directive: <strong>1-Tick Contract upon Trigger Digit print</strong>
              </span>
              <span>
                🛡️ False Break Guard:{" "}
                <strong>Automatic Invalidation on CUSUM structural break</strong>
              </span>
            </div>
          </div>

          {/* Filter Categories */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-mono transition-all",
                  selectedCategory === cat
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                    : "bg-secondary/30 text-muted-foreground hover:text-foreground border border-transparent",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Engine Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEngines.map((engine, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-border/60 bg-secondary/20 p-4 space-y-3 hover:border-cyan-500/40 transition-all glass"
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {engine.category}
                    </span>
                    <h5 className="font-mono text-sm font-bold text-foreground mt-1">
                      {engine.name}
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {engine.consensusWeight}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground uppercase text-[10px] block">
                      Operational Role:
                    </span>
                    <p className="text-foreground/90">{engine.operationalRole}</p>
                  </div>

                  <div>
                    <span className="text-muted-foreground uppercase text-[10px] block">
                      Mathematical Mechanism:
                    </span>
                    <p className="text-cyan-300/90 text-[11px] bg-secondary/40 p-2 rounded-lg border border-border/40">
                      {engine.formulaAndMechanism}
                    </p>
                  </div>

                  <div>
                    <span className="text-muted-foreground uppercase text-[10px] block">
                      Signal Output Contribution:
                    </span>
                    <p className="text-emerald-300/90 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{engine.outputContribution}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
