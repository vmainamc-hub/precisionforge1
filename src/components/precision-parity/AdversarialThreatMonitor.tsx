// Precision Parity AI — Adversarial Threat & Veto Monitor.
// Visualizes active safeguards (feed integrity, entropy vetoes, streak traps, changepoints, sample depth).

import type { ParityDangerResult } from "@/lib/precision-parity/engines/danger-engine";
import { ShieldAlert, ShieldCheck, AlertTriangle, Activity, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  danger: ParityDangerResult;
}

export function AdversarialThreatMonitor({ danger }: Props) {
  const hasVeto = danger.hasCriticalVeto;

  return (
    <div
      id="parity-threat-monitor"
      className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "p-1.5 rounded-lg border",
              hasVeto
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            )}
          >
            {hasVeto ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Adversarial Threat & Veto Monitor</h3>
            <p className="text-[11px] text-slate-400">
              Independent safety checks safeguarding execution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold font-mono border",
              hasVeto
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
            )}
          >
            {hasVeto ? "EXECUTION VETOED" : "ALL GATES PASS"}
          </span>
          <span className="text-xs text-slate-400 font-mono">Danger: {danger.dangerScore}/100</span>
        </div>
      </div>

      {/* Threats / Safeguards Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {danger.threats.length > 0 ? (
          danger.threats.map((t, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-xl border flex items-start gap-2.5",
                t.severity === "CRITICAL_VETO"
                  ? "bg-red-500/10 border-red-500/30 text-red-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-200",
              )}
            >
              <AlertTriangle
                className={cn(
                  "w-4 h-4 shrink-0 mt-0.5",
                  t.severity === "CRITICAL_VETO" ? "text-red-400" : "text-amber-400",
                )}
              />
              <div className="text-xs">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>{t.engine}</span>
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded font-mono uppercase font-bold",
                      t.severity === "CRITICAL_VETO"
                        ? "bg-red-500/30 text-red-300"
                        : "bg-amber-500/30 text-amber-300",
                    )}
                  >
                    {t.severity}
                  </span>
                </div>
                <div className="mt-0.5 opacity-90">{t.reason}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-xs font-semibold text-white">
                  Zero Critical Threats or Exhaustion Traps Detected
                </div>
                <div className="text-[11px] text-slate-400">
                  Feed is stable, entropy is structured, and no late-streak exhaustion is present.
                </div>
              </div>
            </div>
            <span className="text-xs text-emerald-300 font-mono font-bold">100% Clear</span>
          </div>
        )}
      </div>
    </div>
  );
}
