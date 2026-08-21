// APEX SENTINEL — OPERATOR LEARNING VISIBILITY (display only).
//
// Renders the existing operator-learning states. No thresholds, no maths and
// no persistence live here — everything comes from operator-learning.ts.
import { SectionTitle } from "@/components/apex/EvidencePanel";
import { operatorLearningSummary } from "@/lib/sentinel/operator-learning-summary";
import { useTradeFeedbackVersion } from "@/components/apex/TradeFeedback";

const card = "rounded-xl border border-border bg-card p-4";

function Row({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-xs tabular-nums">{value}</span>
    </li>
  );
}

function Pipeline() {
  return (
    <div className="mt-3 rounded border border-border/60 p-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Learning pipeline
      </p>
      <p className="mt-1 font-mono text-[10px] leading-relaxed">
        REMEMBERED → BEING TESTED → SUPPORTED → VALIDATED → BOUNDED FUTURE INFLUENCE
      </p>
      <p className="font-mono text-[10px] text-[var(--bear)]">
        contradictory subsequent evidence → DISCOUNTED
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Remembered is not validated, and validated never means unbounded control — influence stays
        capped and market/contract/entry-digit isolated.
      </p>
    </div>
  );
}

function statusLabel(s: string) {
  return s === "EMERGING" ? "BEING TESTED" : s === "OBSERVATION" ? "REMEMBERED" : s;
}

/** Compact variant rendered inside the BEST CURRENT OPPORTUNITY card. */
export function OperatorLearningInline() {
  useTradeFeedbackVersion();
  const { counts, mostRecent, influence } = operatorLearningSummary();

  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Operator learning · written feedback (never counted as trades)
      </p>
      <ul className="mt-1 space-y-0.5">
        <Row label="Observations remembered" value={counts.observationsRemembered} />
        <Row label="Being tested" value={counts.beingTested} />
        <Row label="Supported" value={counts.supported} />
        <Row label="Validated" value={counts.validated} />
        <Row label="Discounted" value={counts.discounted} />
      </ul>

      {mostRecent ? (
        <div className="mt-3 rounded border border-border/60 p-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Operator feedback
          </p>
          <p className="mt-1 text-[11px]">&ldquo;{mostRecent.text}&rdquo;</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--warn)]">
            Status: {statusLabel(mostRecent.status)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {mostRecent.pattern.symbol} · {mostRecent.pattern.contractLabel}
            {mostRecent.pattern.entryDigit !== null
              ? ` · Entry digit ${mostRecent.pattern.entryDigit}`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No written operator feedback recorded yet.
        </p>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Future decision influence
      </p>
      {influence.active ? (
        <p className="mt-1 font-mono text-[11px]">
          Entry influence: {influence.entry > 0 ? "+" : ""}
          {influence.entry} · Ranking influence: {influence.ranking > 0 ? "+" : ""}
          {influence.ranking}
          <span className="text-muted-foreground"> (bounded, engine-capped)</span>
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">No current decision influence.</p>
      )}

      <Pipeline />
    </div>
  );
}

export default function OperatorLearningSummary() {
  useTradeFeedbackVersion();
  const { counts, inProgress, influence } = operatorLearningSummary();

  return (
    <div className={card}>
      <SectionTitle hint="written feedback · never counted as trades">
        Operator learning
      </SectionTitle>
      <ul className="space-y-0.5">
        <Row label="Observations remembered" value={counts.observationsRemembered} />
        <Row label="Being tested" value={counts.beingTested} />
        <Row label="Supported" value={counts.supported} />
        <Row label="Validated" value={counts.validated} />
        <Row label="Discounted" value={counts.discounted} />
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Written comments are operator observations only — they never become a WIN, a LOSS or a
        confirmed trade, and ignored signals are never recorded as trades.
      </p>

      {inProgress.length ? (
        <>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Why these are still insufficient
          </p>
          <ul className="mt-1 space-y-1.5 text-[11px]">
            {inProgress.slice(0, 6).map((p) => (
              <li key={p.pattern.key} className="rounded border border-border/60 p-2">
                <p className="font-mono text-[11px]">
                  {p.pattern.symbol} · {p.pattern.contractLabel}
                  {p.pattern.entryDigit !== null ? ` · Entry digit ${p.pattern.entryDigit}` : ""}
                  {p.pattern.category ? ` · ${p.pattern.category}` : ""}
                </p>
                {p.pattern.samples?.[0] ? (
                  <p className="mt-0.5 text-muted-foreground">
                    &ldquo;{p.pattern.samples[0]}&rdquo;
                  </p>
                ) : null}
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--warn)]">
                  Status: {p.status === "EMERGING" ? "BEING TESTED" : "REMEMBERED"}
                </p>
                <p className="text-muted-foreground">
                  Observations: {p.pattern.observations} · Subsequent related trades:{" "}
                  {p.subsequentTrades}
                  {p.requiredForNextStage !== null
                    ? ` · Required for ${p.nextStage}: ${p.requiredForNextStage}`
                    : ""}
                </p>
                <p className="mt-0.5 text-muted-foreground">{p.explanation}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">
          No operator feedback is currently awaiting evidence. Feedback remains remembered and is
          tested against subsequent confirmed trades only.
        </p>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Future decision influence
      </p>
      {influence.active ? (
        <p className="mt-1 font-mono text-[11px]">
          Entry influence: {influence.entry > 0 ? "+" : ""}
          {influence.entry} · Ranking influence: {influence.ranking > 0 ? "+" : ""}
          {influence.ranking}
          <span className="text-muted-foreground"> (bounded, engine-capped)</span>
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">No current decision influence.</p>
      )}

      <Pipeline />
    </div>
  );
}
