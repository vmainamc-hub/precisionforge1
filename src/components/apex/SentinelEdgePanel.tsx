// APEX SENTINEL — RELATIVE EDGE · PERSISTENCE · ENTRY POINT.
//
// This panel exists so the operator is never asked to trust a rank. It shows
// the three dimensions that decide the ranking beyond absolute scoring:
//   1. Relative edge — how this candidate compares with the actual field.
//   2. Persistence & stability — whether the signal has held across scans.
//   3. Entry point — which digit to act on, and for how long it stays valid.
// Every number carries its sample size or its basis; nothing is asserted
// beyond what was measured.
import type { RankedOpportunity } from "@/lib/apex/types";
import { whyRanksHere } from "@/lib/apex/scan";

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

function relTone(label: string): "bull" | "warn" | "bear" | undefined {
  if (label === "STRONG" || label === "MODERATE") return "bull";
  if (label === "BEHIND") return "bear";
  if (label === "MARGINAL") return "warn";
  return undefined;
}

function statusTone(status: string): "bull" | "warn" | "bear" {
  if (status === "ENTER NOW" || status === "ARMED") return "bull";
  if (status === "INVALIDATED") return "bear";
  return "warn";
}

function ReasonList({ title, items, color }: { title: string; items: string[]; color?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-[11px] text-muted-foreground">
            · {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SentinelEdgePanel({ item }: { item: RankedOpportunity }) {
  const rel = item.relative;
  const p = item.persistence;
  const ep = item.entryPoint;
  const why = whyRanksHere(item);
  const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;

  return (
    <section className="mt-6 rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-[var(--neon)]">
          RELATIVE EDGE · PERSISTENCE · ENTRY POINT
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {p.changeClass} · field {rel.fieldRank}/{rel.fieldSize}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cell
          label="Relative edge vs field"
          value={sign(rel.relativeEdge)}
          sub={`${rel.label} · risk-adjusted ${rel.riskAdjustedEdge.toFixed(2)} from absolute ${rel.absoluteEdge.toFixed(2)} · field position ${rel.normalized}/100`}
          tone={relTone(rel.label)}
        />
        <Cell
          label="Signal persistence"
          value={p.scans < 2 ? "NO HISTORY" : `${p.persistence}/100`}
          sub={
            p.scans < 2
              ? "First scan for this candidate — persistence needs at least two scans"
              : `Top-3 in ${p.topThree}/${p.scans} scans · avg rank ${p.averageRank} · now #${p.currentRank}${p.previousRank ? ` (was #${p.previousRank})` : ""}`
          }
          tone={
            p.scans < 2
              ? undefined
              : p.persistence >= 65
                ? "bull"
                : p.persistence < 40
                  ? "bear"
                  : "warn"
          }
        />
        <Cell
          label="Edge stability"
          value={p.scans < 2 ? "NO HISTORY" : `${p.edgeStability}/100`}
          sub={
            p.scans < 2
              ? "Stability is measured from the spread of edge across scans"
              : `σ ${p.edgeStdDev} · range ${p.edgeRange} over ${p.edgeSeries.length} scan(s) · rotation ${p.rotation}`
          }
          tone={
            p.scans < 2
              ? undefined
              : p.edgeStability >= 70
                ? "bull"
                : p.edgeStability < 45
                  ? "bear"
                  : "warn"
          }
        />
        <Cell
          label="Entry point"
          value={ep.preferred ? `DIGIT ${ep.preferred.digit}` : "NONE"}
          sub={
            ep.preferred
              ? `${ep.status} · confidence ${ep.confidence}/100 · P(win|entry) ${(ep.preferred.pWin * 100).toFixed(1)}% (LB ${(ep.preferred.pWinLower * 100).toFixed(1)}%) over N=${ep.preferred.n}`
              : `${ep.status} · ${ep.summary}`
          }
          tone={statusTone(ep.status)}
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">{rel.detail}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{p.summary}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Validity window: {ep.window.label} — {ep.window.basis}
      </p>

      {/* ── WHY THIS MARKET RANKS WHERE IT DOES ─────────────────────────── */}
      <div className="mt-4 rounded-lg border border-border/50 bg-background/30 p-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/90">
          {why.headline}
        </p>
        <div className="mt-2 grid gap-4 lg:grid-cols-3">
          <ReasonList title="What supports it" items={why.supports} color="var(--bull)" />
          <ReasonList title="What is neutral" items={why.neutral} color="var(--muted-foreground)" />
          <ReasonList title="What argues against it" items={why.cautions} color="var(--bear)" />
        </div>
      </div>

      {/* ── FOUR-ENGINE ANALYTICAL INTELLIGENCE ─────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-border/50 bg-background/30 p-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--neon)]">
          SUPPORTING ANALYTICAL ENGINES (REGIME · FUSION · CALIBRATION · CONTEXT)
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Engine 1: Regime & Changepoint */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Regime / Changepoint
            </p>
            <p
              className="mt-1 font-display text-sm font-bold"
              style={{
                color:
                  item.regimeReport?.state === "STABLE"
                    ? "var(--bull)"
                    : item.regimeReport?.state === "WATCH"
                      ? "var(--warn)"
                      : "var(--bear)",
              }}
            >
              {item.regimeReport
                ? `${item.regimeReport.state} (${item.regimeReport.regimeId})`
                : "UNAVAILABLE"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {item.regimeReport
                ? `Confidence ${item.regimeReport.confidence}/100 · ${item.regimeReport.shouldDiscountOldEvidence ? "Discounting stale ticks" : "Full tick history active"}`
                : "No changepoint read"}
            </p>
          </div>

          {/* Engine 2: Correlation-Aware Evidence Fusion */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Evidence Fusion
            </p>
            <p className="mt-1 font-display text-sm font-bold text-foreground">
              {item.evidenceFusion
                ? `${item.evidenceFusion.effectiveScore.toFixed(0)}/100 eff`
                : "UNAVAILABLE"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {item.evidenceFusion
                ? `Raw ${item.evidenceFusion.rawAgreement.toFixed(0)} → Eff ${item.evidenceFusion.effectiveScore.toFixed(0)} (${item.evidenceFusion.effectiveDegreesOfFreedom} indep src)`
                : "No fusion read"}
            </p>
          </div>

          {/* Engine 3: Calibration */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Empirical Calibration
            </p>
            <p className="mt-1 font-display text-sm font-bold" style={{ color: "var(--bull)" }}>
              {item.calibration
                ? `${(item.calibration.calibratedProbability * 100).toFixed(1)}% win`
                : "UNAVAILABLE"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {item.calibration
                ? `${item.calibration.method} (N=${item.calibration.sampleSize}) · ${((item.calibration.calibratedProbability * 100 - item.calibration.rawScore) >= 0 ? "+" : "") + (item.calibration.calibratedProbability * 100 - item.calibration.rawScore).toFixed(1)}pp edge`
                : "No calibration read"}
            </p>
          </div>

          {/* Engine 4: Markov Context */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Markov Context Engine
            </p>
            <p className="mt-1 font-display text-sm font-bold text-foreground">
              {item.contextMarkov?.preferredDigit !== null &&
              item.contextMarkov?.preferredDigit !== undefined
                ? `Digit ${item.contextMarkov.preferredDigit} (Ord-${item.contextMarkov.preferredOrder})`
                : "NO CONTEXT PREF"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {item.contextMarkov?.preferredDigit !== null &&
              item.contextMarkov?.preferredDigit !== undefined
                ? `Context p(win) ${(item.contextMarkov.preferredPWin * 100).toFixed(1)}%`
                : "Uniform context distribution"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {/* ── Entry digit ranking ───────────────────────────────────────── */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Entry digits ranked by conditional evidence (N per digit shown)
          </p>
          {ep.ranking.length ? (
            <ul className="mt-2 space-y-1">
              {ep.ranking.slice(0, 6).map((d) => (
                <li key={d.digit} className="flex items-baseline gap-2 text-[11px]">
                  <span
                    className="w-6 shrink-0 text-right font-mono font-bold"
                    style={{
                      color:
                        ep.preferred?.digit === d.digit
                          ? "var(--bull)"
                          : d.isLoser
                            ? "var(--bear)"
                            : undefined,
                    }}
                  >
                    {d.digit}
                  </span>
                  <span className="w-14 shrink-0 font-mono text-muted-foreground">
                    {d.score.toFixed(0)}/100
                  </span>
                  <span className="w-28 shrink-0 font-mono text-muted-foreground">
                    {(d.pWin * 100).toFixed(1)}% · N={d.n}
                  </span>
                  <span className="text-muted-foreground">
                    edge {d.edgePp >= 0 ? "+" : ""}
                    {d.edgePp.toFixed(2)}pp · stability {d.stability}/100 · wait ≈
                    {d.expectedWaitTicks} ticks
                    {d.isLoser ? " · losing-side digit" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">
              No digit has enough conditional evidence on this market and contract yet.
            </p>
          )}
        </div>

        {/* ── Why this entry digit, and why not the alternative ─────────── */}
        <div className="space-y-3">
          <ReasonList
            title={
              ep.preferred
                ? `Why digit ${ep.preferred.digit} is the entry point`
                : "Why no entry point is offered"
            }
            items={ep.whyPreferred}
            color="var(--bull)"
          />
          <ReasonList
            title={
              ep.alternative
                ? `Why not digit ${ep.alternative.digit} (runner-up)`
                : "Runner-up entry digit"
            }
            items={ep.whyNotAlternative}
            color="var(--warn)"
          />
          <ReasonList
            title="What would invalidate this entry"
            items={ep.invalidation}
            color="var(--bear)"
          />
        </div>
      </div>

      {p.changeReasons.length ? (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Change since the previous scan · {p.changeClass}
          </p>
          <ul className="mt-1.5 space-y-1">
            {p.changeReasons.map((r, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                · {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
