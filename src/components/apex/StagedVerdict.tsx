// Sentinel's staged verdict, surfaced exactly as it is computed:
// Stage 1 direction → Stage 2 setup (danger-composed) → Stage 3 clearance,
// with the sample size behind every figure. Nothing is rounded into a claim
// the evidence cannot support: an untested combination says UNTESTED.
import type { RankedOpportunity } from "@/lib/apex/types";

function Stat({
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
  const color = tone ? `var(--${tone})` : undefined;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold" style={{ color }}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function verdictTone(v: string): "bull" | "bear" | "warn" {
  return v === "CLEARED" ? "bull" : v === "BLOCKED" ? "bear" : "warn";
}

export default function StagedVerdict({ item }: { item: RankedOpportunity }) {
  const { direction, setup, dangerComposition: danger, entryClearance: gate, combination } = item;
  const combo = combination.exact;

  return (
    <section className="mt-6 rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-[var(--neon)]">
          STAGED VERDICT · DIRECTION → SETUP → CLEARANCE
        </p>
        <span
          className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            color: `var(--${verdictTone(gate.verdict)})`,
            borderColor: `var(--${verdictTone(gate.verdict)})`,
          }}
        >
          {gate.verdict} · confidence {gate.confidence}/100
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Stage 1 · direction"
          value={`${direction.score.toFixed(0)}/100`}
          sub={`${direction.label} · ${direction.supporting.length} for / ${direction.opposing.length} against · confidence ${direction.confidence}/100`}
          tone={direction.label === "AGAINST" ? "bear" : "bull"}
        />
        <Stat
          label="Stage 2a · danger"
          value={`${danger.total.toFixed(0)}/100`}
          sub={`${danger.level} · ${danger.components.length} component(s)${danger.autoBlock.length ? ` · ${danger.autoBlock.length} AUTO-BLOCK` : ""}`}
          tone={danger.total > 55 ? "bear" : "warn"}
        />
        <Stat
          label="Stage 2 · setup"
          value={`${setup.score.toFixed(0)}/100`}
          sub={`${setup.grade} · N=${setup.sampleSize} resolved (recent N=${setup.recentSampleSize}) · confidence ${setup.confidence}/100`}
          tone={setup.grade === "PRIME" || setup.grade === "GOOD" ? "bull" : "warn"}
        />
        <Stat
          label="Stage 3.5 · combination"
          value={combo.n ? `${(combo.weightedWinRate * 100).toFixed(1)}%` : "UNTESTED"}
          sub={
            combo.n
              ? `${combo.state} · N=${combo.n} raw / weighted ${combo.weightedN.toFixed(1)} · expectancy ${combo.weightedExpectancy.toFixed(3)}`
              : `No resolved entry for regime ${combo.regime} · entry ${combo.entryCondition}`
          }
          tone={
            combo.state === "VALIDATED"
              ? "bull"
              : combo.state === "FAILING" || combo.state === "DETERIORATING"
                ? "bear"
                : undefined
          }
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">{setup.summary}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{gate.summary}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{combo.note}</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Stage 1 engine votes (weight · sample)
          </p>
          <ul className="mt-2 space-y-1">
            {direction.votes.slice(0, 8).map((v) => (
              <li key={v.engine} className="flex items-baseline gap-2 text-[11px]">
                <span
                  className="w-14 shrink-0 text-right font-mono"
                  style={{
                    color:
                      v.stance === "SUPPORT"
                        ? "var(--bull)"
                        : v.stance === "OPPOSE"
                          ? "var(--bear)"
                          : undefined,
                  }}
                >
                  {v.stance === "OPPOSE" ? "−" : v.stance === "SUPPORT" ? "+" : "·"}
                  {v.weight.toFixed(1)}
                </span>
                <span className="w-36 shrink-0 text-foreground/85">{v.engine}</span>
                <span className="text-muted-foreground">
                  {v.detail}
                  {v.n ? ` (N=${v.n})` : " (not sample-based)"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Stage 3 requirements
          </p>
          <ul className="mt-2 space-y-1">
            {gate.requirements.map((r) => (
              <li key={r.code} className="flex items-baseline gap-2 text-[11px]">
                <span
                  className="w-10 shrink-0 text-right font-mono"
                  style={{
                    color: r.met
                      ? "var(--bull)"
                      : `var(--${r.severity === "BLOCK" ? "bear" : "warn"})`,
                  }}
                >
                  {r.met
                    ? "OK"
                    : r.severity === "BLOCK"
                      ? "BLOCK"
                      : r.severity === "WAIT"
                        ? "WAIT"
                        : "INFO"}
                </span>
                <span className="w-44 shrink-0 text-foreground/85">{r.label}</span>
                <span className="text-muted-foreground">{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {danger.components.length ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Stage 2a danger composition
          </p>
          <ul className="mt-2 space-y-1">
            {danger.components.map((d) => (
              <li key={d.code} className="flex items-baseline gap-2 text-[11px]">
                <span
                  className="w-12 shrink-0 text-right font-mono"
                  style={{ color: "var(--bear)" }}
                >
                  {d.points.toFixed(1)}
                </span>
                <span className="w-40 shrink-0 text-foreground/85">
                  {d.label} <span className="text-muted-foreground">({d.severity})</span>
                </span>
                <span className="text-muted-foreground">{d.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {combination.siblings.length > 1 ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Entry conditions measured in regime {combo.regime} (never pooled across regimes)
          </p>
          <ul className="mt-2 space-y-1">
            {combination.siblings.slice(0, 6).map((s) => (
              <li key={s.key} className="flex items-baseline gap-2 text-[11px]">
                <span className="w-36 shrink-0 text-foreground/85">{s.entryCondition}</span>
                <span className="w-24 shrink-0 font-mono text-muted-foreground">
                  {s.n ? `${(s.weightedWinRate * 100).toFixed(1)}%` : "—"}
                </span>
                <span className="text-muted-foreground">
                  {s.state} · N={s.n} (weighted {s.weightedN.toFixed(1)}) · expectancy{" "}
                  {s.weightedExpectancy.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
