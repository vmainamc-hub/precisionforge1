// Precision Parity AI — Markov Transitions Matrix Visualizer.
// Visualizes 1st order (EE, EO, OE, OO), 2nd order, and 3rd order empirical parity transitions.

import type { ParityMarkovEngineResult } from "@/lib/precision-parity/engines/markov-engine";
import { GitBranch, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  markov: ParityMarkovEngineResult;
}

export function MarkovTransitionMatrix({ markov }: Props) {
  const m = markov.matrix1st;

  return (
    <div
      id="parity-markov-transition-matrix"
      className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Markov Transitions Matrix</h3>
            <p className="text-[11px] text-slate-400">
              1st, 2nd & 3rd-order conditional state transition probabilities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
            Optimal: Order-{markov.preferredOrder}
          </span>
          {markov.activeContext3 && (
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 font-mono text-[11px]">
              Ctx3: {markov.activeContext3.context}
            </span>
          )}
        </div>
      </div>

      {/* 1st-Order 2x2 Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Even -> Even */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">E → E</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400 font-mono">
              N={m.counts.EE}
            </span>
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {(m.pEE * 100).toFixed(1)}%
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${m.pEE * 100}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-400 mt-1">Even continuation</div>
        </div>

        {/* Even -> Odd */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">E → O</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400 font-mono">
              N={m.counts.EO}
            </span>
          </div>
          <div className="text-lg font-bold text-amber-400 font-mono mt-1">
            {(m.pEO * 100).toFixed(1)}%
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-amber-400 rounded-full"
              style={{ width: `${m.pEO * 100}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-400 mt-1">Even break / flip</div>
        </div>

        {/* Odd -> Even */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">O → E</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400 font-mono">
              N={m.counts.OE}
            </span>
          </div>
          <div className="text-lg font-bold text-cyan-400 font-mono mt-1">
            {(m.pOE * 100).toFixed(1)}%
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${m.pOE * 100}%` }} />
          </div>
          <div className="text-[9px] text-slate-400 mt-1">Odd break / flip</div>
        </div>

        {/* Odd -> Odd */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">O → O</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-slate-400 font-mono">
              N={m.counts.OO}
            </span>
          </div>
          <div className="text-lg font-bold text-indigo-400 font-mono mt-1">
            {(m.pOO * 100).toFixed(1)}%
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-indigo-400 rounded-full"
              style={{ width: `${m.pOO * 100}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-400 mt-1">Odd continuation</div>
        </div>
      </div>

      {/* Active High-Order Markov Contexts */}
      {(markov.activeContext2 || markov.activeContext3) && (
        <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Active High-Order Suffix:</span>
            {markov.activeContext2 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-white">
                [{markov.activeContext2.context}] → P(E)=
                {(markov.activeContext2.pEven * 100).toFixed(1)}% (N=
                {markov.activeContext2.sampleCount})
              </span>
            )}
            {markov.activeContext3 && (
              <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-cyan-300">
                [{markov.activeContext3.context}] → P(E)=
                {(markov.activeContext3.pEven * 100).toFixed(1)}% (N=
                {markov.activeContext3.sampleCount})
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Laplace smoothing applied to sparse higher-order nodes
          </div>
        </div>
      )}
    </div>
  );
}
