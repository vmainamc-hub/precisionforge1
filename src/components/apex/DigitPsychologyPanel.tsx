// CANONICAL DIGIT PSYCHOLOGY — read-only presentation of the 1,000-tick
// digit-frequency state already computed by the ranking pipeline. It adds no
// new intelligence; it shows the evidence the ranking used.
import type { RankedOpportunity } from "@/lib/apex/types";

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-border/50 bg-secondary/20 px-2 py-1">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-bold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

export default function DigitPsychologyPanel({ item }: { item: RankedOpportunity }) {
  const p = item.digitPsychology;
  const st = item.digitState;
  if (!p) return null;
  const state = p.positions;
  const verdictTone =
    p.verdict === "SUPPORT"
      ? "var(--bull)"
      : p.verdict === "CONFLICT"
        ? "var(--bear)"
        : "var(--warn)";

  return (
    <section className="mt-5 rounded-lg border border-border/50 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-[11px] font-bold tracking-[0.25em] text-[var(--neon)]">
          DIGIT PSYCHOLOGY — 1,000 TICKS
        </h4>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: verdictTone }}
        >
          {p.verdict} · {p.score}/100 · ranking {p.rankingDelta >= 0 ? "+" : ""}
          {p.rankingDelta}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {state.map((r) => (
          <Chip
            key={r.role}
            label={r.role}
            value={r.digit === null ? "—" : `${r.digit} · ${r.zone}`}
            tone={r.support > 0 ? "var(--bull)" : r.support < 0 ? "var(--bear)" : undefined}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Chip label="Winning zone" value={p.winningZone.join(" ") || "—"} tone="var(--bull)" />
        <Chip label="Losing zone" value={p.losingZone.join(" ") || "—"} tone="var(--bear)" />
        <Chip label="Boundary" value={p.boundary.join(" ") || "—"} tone="var(--warn)" />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{p.summary}</p>

      {st && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-[0.18em] text-foreground">{st.change}</span>{" "}
          — {st.changeDetail}
        </p>
      )}

      {p.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {p.reasons.map((r, i) => (
            <li key={i}>+ {r}</li>
          ))}
        </ul>
      )}
      {p.cautions.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px]" style={{ color: "var(--bear)" }}>
          {p.cautions.map((r, i) => (
            <li key={i}>− {r}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
