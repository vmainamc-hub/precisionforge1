// Compact "DBot entry" card — turns an engine signal into the exact fields
// a Deriv DBot would need to load: market, contract type, barrier/prediction,
// duration, and entry directive. Used by Precision Edge and Precision Parity.
import { Bot, Copy, Check } from "lucide-react";
import { useState } from "react";

export interface DBotEntry {
  market: string; // Deriv symbol code, e.g. "R_10", "1HZ10V"
  marketName: string; // Human name, e.g. "Volatility 10 Index"
  contractType: string; // Deriv contract type, e.g. "DIGITOVER"
  contractLabel: string; // Human label, e.g. "Over 3"
  prediction?: number; // barrier digit for OVER/UNDER
  durationTicks: number; // typically 1
  entry: "Immediate" | "Wait";
  entryTrigger?: string; // optional last-digit filter, e.g. "last digit ≤ 5"
  stake?: string;
}

export function DBotEntryCard({ entry }: { entry: DBotEntry }) {
  const [copied, setCopied] = useState(false);
  const lines = [
    `Market:        ${entry.marketName} (${entry.market})`,
    `Trade type:    ${entry.contractType}   // ${entry.contractLabel}`,
    entry.prediction !== undefined ? `Prediction:    ${entry.prediction}` : "",
    `Duration:      ${entry.durationTicks} tick${entry.durationTicks > 1 ? "s" : ""}`,
    `Entry:         ${entry.entry}${entry.entryTrigger ? `  (${entry.entryTrigger})` : ""}`,
    entry.stake ? `Stake:         ${entry.stake}` : "",
  ].filter(Boolean);
  const text = lines.join("\n");

  return (
    <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/[0.06] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--primary)] flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5" /> DBot entry formula
        </div>
        <button
          onClick={() => {
            try {
              navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-secondary/40 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-3 h-3 text-[var(--bull)]" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="text-[11px] leading-relaxed tabular whitespace-pre-wrap text-foreground/90 font-mono">
        {text}
      </pre>
      <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
        Load these fields into your DBot block. Contract types map directly to Deriv's
        binary-options API. Duration is 1 tick unless your bot uses a different horizon.
      </p>
    </div>
  );
}
