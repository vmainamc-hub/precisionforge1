// BOT INSTRUCTIONS — exactly what to set in DBot, straight from BOT_SPEC.
import type { BotInstructions } from "@/lib/precision-edge/bot/types";
import type { BotState } from "@/lib/precision-edge/bot/state-tracker";

export function BotInstructionsCard({
  instructions,
  state,
}: {
  instructions: BotInstructions;
  state: BotState;
}) {
  const rows: Array<[string, string]> = [
    ["Symbol", `${instructions.marketName} (${instructions.symbol})`],
    ["Contract", instructions.contractLabel],
    ["Prediction / barrier", instructions.barrier === null ? "—" : String(instructions.barrier)],
    ["Duration", `${instructions.durationTicks} tick${instructions.durationTicks > 1 ? "s" : ""}`],
    ["Ticks analyzed", String(instructions.ticksAnalyzed)],
    ["Threshold %", `${instructions.thresholdPct}`],
    ["Martingale factor", instructions.martingaleFactor.toFixed(2)],
    ["Wait ticks", String(instructions.waitTicks)],
    ["Leg", `${state.leg} · CountLoss ${state.countLoss}`],
    ["Stake multiple", `${instructions.stakeMultiple.toFixed(2)}×`],
  ];

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <header>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Bot Instructions</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Barriers come only from the bot's own map — fresh OVER 2 / UNDER 7, recovery OVER 3 /
          UNDER 6.
        </p>
      </header>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-[var(--muted-foreground)]">{k}</dt>
            <dd className="font-mono text-[var(--foreground)]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-xs text-[var(--foreground)]">
        {instructions.action}
      </p>
    </section>
  );
}
