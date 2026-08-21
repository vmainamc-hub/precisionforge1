// BOT VERDICT — the one answer the system exists to give:
// may the bot fire right now, in which direction, at which barrier?
import type { BotSignal } from "@/lib/precision-edge/bot/types";
import { cn } from "@/lib/utils";
import { Bot, CircleSlash, PauseCircle, PlayCircle } from "lucide-react";

const VERDICT_STYLE: Record<string, string> = {
  BOT_ON: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  BOT_STANDBY: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  BOT_OFF: "border-red-500/40 bg-red-500/10 text-red-400",
};

const VERDICT_ICON = {
  BOT_ON: PlayCircle,
  BOT_STANDBY: PauseCircle,
  BOT_OFF: CircleSlash,
} as const;

export function BotVerdictCard({ signal, marketName }: { signal: BotSignal; marketName: string }) {
  const Icon = VERDICT_ICON[signal.verdict];
  return (
    <section className={cn("rounded-xl border p-5", VERDICT_STYLE[signal.verdict])}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-80">
              <Bot className="mr-1 inline h-3 w-3" />
              Precision_Percentage_Bot_V6 · {marketName}
            </div>
            <h2 className="text-2xl font-bold leading-tight">{signal.verdict.replace("_", " ")}</h2>
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <Metric label="Fitness" value={`${signal.fitness.toFixed(0)}`} />
          <Metric label="Confidence" value={`${signal.confidence.toFixed(0)}%`} />
          <Metric label="Ticks" value={signal.ticks.toLocaleString()} />
        </div>
      </header>

      <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
        {signal.narrative.headline}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Why
          </div>
          <ul className="mt-1 space-y-1 text-xs text-[var(--muted-foreground)]">
            {signal.narrative.why.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Risk
          </div>
          <ul className="mt-1 space-y-1 text-xs text-[var(--muted-foreground)]">
            {signal.narrative.risk.length ? (
              signal.narrative.risk.map((w, i) => <li key={i}>• {w}</li>)
            ) : (
              <li>• No elevated risk flags</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Action ·{" "}
        </span>
        {signal.narrative.action}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
