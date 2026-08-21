// LOWER-TIMEFRAME PRICE ACTION PRESSURE — read-only presentation of the
// 120-tick pressure reading already computed by the ranking pipeline.
//
// It shows the two layers side by side so the operator can see the difference
// the engine acts on: what the 1,000 ticks HAVE BUILT (structure) against what
// the last 120 ticks are DOING (pressure). Disagreement is displayed, never
// hidden — it is the transition/takeover signal.
import type { RankedOpportunity } from "@/lib/apex/types";
import type { DigitPressureReading } from "@/lib/sentinel/price-action-psychology";

const ALIGN_TONE: Record<string, string> = {
  CONFIRMING: "var(--bull)",
  NEUTRAL: "var(--muted-foreground)",
  TRANSITIONING: "var(--warn)",
  CONTRADICTING: "var(--bear)",
  TAKEOVER: "var(--bear)",
};

function toneFor(r: DigitPressureReading): string {
  if (r.pressure > 12) return "var(--bull)";
  if (r.pressure < -12) return "var(--bear)";
  if (Math.abs(r.pressure) > 5) return "var(--warn)";
  return "var(--muted-foreground)";
}

export default function PriceActionPressurePanel({ item }: { item: RankedOpportunity }) {
  const pa = item.priceAction;
  const field = item.priceActionField;
  if (!pa || !field) return null;
  const tone = ALIGN_TONE[pa.alignment] ?? "var(--muted-foreground)";

  return (
    <section className="mt-5 rounded-lg border border-border/50 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-[11px] font-bold tracking-[0.25em] text-[var(--neon)]">
          PRICE ACTION PRESSURE — {pa.window} TICKS
        </h4>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: tone }}>
          {pa.alignment} · {pa.takeover.state}
        </span>
      </div>

      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{pa.summary}</p>

      {/* Structural (1,000t) vs pressure (120 → 60 → 30) per digit */}
      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {field.digits.map((r) => {
          const winner = pa.winners.includes(r.digit);
          return (
            <div
              key={r.digit}
              className={`rounded border px-1.5 py-1 ${winner ? "border-border/70 bg-secondary/30" : "border-border/30 bg-background/40"}`}
              title={r.note}
            >
              <div className="font-mono text-sm font-bold" style={{ color: toneFor(r) }}>
                {r.digit}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">
                {r.structuralPct.toFixed(1)}%
              </div>
              <div className="font-mono text-[10px]" style={{ color: toneFor(r) }}>
                {r.pctFast.toFixed(1)}%
              </div>
              <div className="font-mono text-[9px]" style={{ color: toneFor(r) }}>
                {r.rateOfChangePp >= 0 ? "+" : ""}
                {r.rateOfChangePp.toFixed(1)}pp
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        row 1 structural 1,000t · row 2 fast {field.config.fast}t · row 3 change vs {pa.window}t
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-border/40 bg-secondary/20 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          {pa.winningSide.summary}
        </div>
        <div className="rounded border border-border/40 bg-secondary/20 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          {pa.losingSide.summary}
        </div>
      </div>

      {pa.takeover.evidence.length > 0 && (
        <ul className="mt-3 space-y-1">
          {pa.takeover.evidence.map((e, i) => (
            <li key={i} className="font-mono text-[10px] text-[var(--bear)]">
              ▸ {e}
            </li>
          ))}
        </ul>
      )}

      {pa.cautions.map((c, i) => (
        <p key={`c${i}`} className="mt-1 font-mono text-[10px] text-[var(--warn)]">
          ⚠ {c}
        </p>
      ))}
      {pa.reasons.map((r, i) => (
        <p key={`r${i}`} className="mt-1 font-mono text-[10px] text-[var(--bull)]">
          ✓ {r}
        </p>
      ))}

      <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground">
        <span>{pa.redControl.note}</span>
        <span>·</span>
        <span>{pa.greenLosingSide.note}</span>
        <span>·</span>
        <span>{pa.specialRisk.note}</span>
        <span>·</span>
        <span style={{ color: pa.rankingDelta < 0 ? "var(--bear)" : "var(--bull)" }}>
          ranking {pa.rankingDelta >= 0 ? "+" : ""}
          {pa.rankingDelta.toFixed(1)}
        </span>
        {pa.veto && <span className="text-[var(--bear)]">· VETOED: {pa.vetoReason}</span>}
      </div>
    </section>
  );
}
