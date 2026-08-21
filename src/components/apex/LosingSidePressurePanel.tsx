// SENTINEL — LOSING_SIDE_PRESSURE surface.
//
// The losing side of a contract is monitored as one aggregate: every digit that
// can make the contract lose contributes to a single bounded index. This panel
// shows the index, the state, the exact ranking modifier that was applied to
// the opportunity score, and the digits responsible — so the operator can see
// why a candidate was dampened instead of guessing.
import type { RankedOpportunity } from "@/lib/apex/types";
import {
  LOSING_SIDE_MAX_MODIFIER,
  LOSING_SIDE_MIN_MODIFIER,
  type LosingSidePressureState,
} from "@/lib/sentinel/losing-side-pressure";

function stateTone(state: LosingSidePressureState): "bull" | "warn" | "bear" {
  if (state === "HOSTILE") return "bear";
  if (state === "PRESSURED" || state === "BUILDING") return "warn";
  return "bull";
}

function Cell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear" | "warn" | "neon";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-display text-lg font-bold"
        style={{ color: tone ? `var(--${tone})` : undefined }}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default function LosingSidePressurePanel({ item }: { item: RankedOpportunity }) {
  const lsp = item.contract.losingSidePressure;
  if (!lsp) return null;
  const tone = stateTone(lsp.state);

  return (
    <section className="mt-6 rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-[var(--neon)]">
          LOSING_SIDE_PRESSURE
        </p>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: `var(--${tone})` }}
        >
          {lsp.state}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cell label="Pressure index" value={`${lsp.index.toFixed(0)}/100`} tone={tone} />
        <Cell
          label="Ranking modifier"
          value={`×${lsp.modifier.toFixed(3)}`}
          sub={`Hard bounds ${LOSING_SIDE_MIN_MODIFIER}–${LOSING_SIDE_MAX_MODIFIER} — it can dampen but never flip a ranking`}
          tone={lsp.modifier < 1 ? "warn" : lsp.modifier > 1 ? "bull" : undefined}
        />
        <Cell
          label="Score impact"
          value={`${lsp.penaltyPoints > 0 ? "−" : ""}${Math.abs(lsp.penaltyPoints).toFixed(2)} pts`}
          sub="Applied after the fake-edge and veto layers"
          tone={lsp.penaltyPoints > 0 ? "bear" : undefined}
        />
        <Cell
          label="Losing digits rising"
          value={`${lsp.risingCount} of ${lsp.contributors.length}`}
          sub="Simultaneous risers widen the breadth term"
          tone={lsp.risingCount >= 3 ? "bear" : lsp.risingCount > 0 ? "warn" : "bull"}
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">{lsp.reason}</p>

      {lsp.contributors.length ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Losing digits, worst first
          </p>
          <ul className="mt-2 space-y-1">
            {lsp.contributors.slice(0, 6).map((d) => (
              <li key={d.digit} className="flex items-baseline gap-2 text-[11px]">
                <span
                  className="w-6 shrink-0 text-right font-mono font-bold"
                  style={{ color: d.rising ? "var(--bear)" : undefined }}
                >
                  {d.digit}
                </span>
                <span className="w-16 shrink-0 font-mono text-muted-foreground">
                  {d.threat.toFixed(0)}/100
                </span>
                <span className="w-24 shrink-0 font-mono text-muted-foreground">
                  {d.pressurePp >= 0 ? "+" : ""}
                  {d.pressurePp.toFixed(2)}pp
                </span>
                <span className="text-muted-foreground">
                  {d.state}
                  {d.rising ? " · rising" : " · flat or fading"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
