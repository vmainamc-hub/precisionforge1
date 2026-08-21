// EQUILIBRIUM MONITOR — the primary law, made visible.
// Over 4 vs Under 5 across the canonical window, the deviation, the drift
// velocity and the band verdict.
import type { EquilibriumReading } from "@/lib/precision-edge/bot/equilibrium";
import { cn } from "@/lib/utils";

const BAND_STYLES: Record<string, string> = {
  PERFECT: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  PRIME: "text-lime-400 border-lime-500/40 bg-lime-500/10",
  ACCEPTABLE: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  DRIFTING: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  BROKEN: "text-red-400 border-red-500/40 bg-red-500/10",
};

export function EquilibriumMonitor({ eq, ticks }: { eq: EquilibriumReading; ticks: number }) {
  const over = eq.over4Pct;
  const under = eq.under5Pct;
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Equilibrium Monitor</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Over 4 vs Under 5 · {ticks.toLocaleString()} ticks · primary law
          </p>
        </div>
        <span
          className={cn("rounded-md border px-2 py-1 text-xs font-semibold", BAND_STYLES[eq.band])}
        >
          {eq.band}
        </span>
      </header>

      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div className="bg-emerald-500/80 transition-all" style={{ width: `${over}%` }} />
        <div className="bg-sky-500/80 transition-all" style={{ width: `${under}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-emerald-400">Over 4 · {over.toFixed(2)}%</span>
        <span className="text-[var(--muted-foreground)]">50.00% target</span>
        <span className="text-sky-400">Under 5 · {under.toFixed(2)}%</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Deviation" value={`${eq.error.toFixed(2)}pp`} />
        <Metric
          label="Drift velocity"
          value={`${eq.driftVelocity >= 0 ? "+" : ""}${eq.driftVelocity.toFixed(3)}%/100t`}
        />
        <Metric label="Stability" value={`${eq.stability.toFixed(0)}%`} />
        <Metric label="Time in band" value={`${Math.round(eq.timeInBandMs / 1000)}s`} />
      </dl>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--muted-foreground)]">
        {eq.windows.map((w: EquilibriumReading["windows"][number]) => (
          <div key={w.window} className="rounded-md border border-[var(--border)] px-2 py-1">
            <div className="text-[var(--foreground)]">{w.window}t</div>
            <div>
              {w.over4Pct.toFixed(1)} / {w.under5Pct.toFixed(1)}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Filtered Over 4 {eq.filteredOver4.toFixed(2)}% ±{eq.uncertainty.toFixed(2)} · equilibrium
        score {eq.score.toFixed(0)}/100 over {eq.samples.toLocaleString()} samples.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
