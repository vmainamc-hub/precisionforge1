import { SectionTitle } from "@/components/apex/EvidencePanel";
import type { MarketIntel } from "@/lib/apex/types";

const card = "rounded-xl border border-border bg-card p-4";

function toneFor(state: string) {
  if (state === "HOSTILE" || state === "CHAOTIC" || state === "SEVERE") return "var(--bear)";
  if (state === "ELEVATED" || state === "UNSTABLE" || state === "HIGH") return "var(--warn)";
  return "var(--bull)";
}

/**
 * DIGIT PSYCHOLOGY — the observed Over / Under configurations, presented as
 * hypotheses with their supporting evidence AND their contradictions.
 */
export function PsychologyPanel({ intel }: { intel: MarketIntel }) {
  const psy = intel.psychology;
  if (!psy) {
    return (
      <div className={card}>
        <SectionTitle>Digit psychology</SectionTitle>
        <p className="text-xs text-muted-foreground">
          Not enough observed ticks on {intel.name} to evaluate the psychology configuration.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <SectionTitle hint={`${psy.n} ticks · hypothesis layer`}>Digit psychology</SectionTitle>
      <p className="mb-3 text-xs text-muted-foreground">{psy.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {[psy.over, psy.under].map((p) => (
          <div key={p.side} className="rounded-lg border border-border/70 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                {p.side} psychology
              </span>
              <span
                className="font-mono text-sm"
                style={{ color: p.aligned ? "var(--bull)" : "var(--muted-foreground)" }}
              >
                {p.score}/100
              </span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              confidence {p.confidence}/100 · {p.aligned ? "ALIGNED" : "NOT ALIGNED"}
            </div>
            <ul className="mt-2 space-y-1">
              {p.supporting.slice(0, 4).map((s, i) => (
                <li
                  key={i}
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--bull)" }}
                >
                  + {s}
                </li>
              ))}
              {p.contradictions.slice(0, 4).map((s, i) => (
                <li
                  key={`c${i}`}
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--bear)" }}
                >
                  − {s}
                </li>
              ))}
              {!p.supporting.length && !p.contradictions.length && (
                <li className="text-[11px] text-muted-foreground">
                  No evaluable conditions right now.
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <Role label="Green bar" value={psy.greenDigit} />
        <Role label="Red bar" value={psy.redDigit} />
        <Role
          label="Second bar"
          value={psy.secondBarDigit}
          suffix={psy.secondBarColor ? ` (${psy.secondBarColor.toLowerCase()})` : ""}
        />
      </div>

      <div className="mt-3">
        <SectionTitle hint="competing pressure groups — not literal traders">
          Contract groups
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-6">
          {psy.groups.map((g) => (
            <div key={g.group} className="rounded-md border border-border/60 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {g.group}
              </div>
              <div
                className="font-mono"
                style={{ color: g.pressure >= 0 ? "var(--bull)" : "var(--bear)" }}
              >
                {(g.pressure * 100 >= 0 ? "+" : "") + (g.pressure * 100).toFixed(1)}pp
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Role({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-foreground">{value === null ? "—" : `${value}${suffix}`}</div>
    </div>
  );
}

/** SPECIAL DIGIT RISK — the dedicated 0 / 1 / 8 / 9 monitor. */
export function SpecialDigitPanel({ intel }: { intel: MarketIntel }) {
  const sd = intel.specialDigits;
  if (!sd) return null;
  return (
    <div className={card}>
      <SectionTitle hint="0 · 1 · 8 · 9">Special digit risk</SectionTitle>
      <p className="mb-3 text-xs text-muted-foreground">{sd.summary}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sd.digits.map((d) => (
          <div key={d.digit} className="rounded-lg border border-border/70 p-2.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-lg text-foreground">{d.digit}</span>
              <span className="font-mono text-xs" style={{ color: toneFor(d.state) }}>
                {d.score}
              </span>
            </div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: toneFor(d.state) }}
            >
              {d.state}
              {d.onLosingSide ? " · LOSING SIDE" : ""}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {d.drivers.slice(0, 2).join("; ") || "no notable behaviour"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** FLUCTUATION — is the evidence holding still? */
export function FluctuationPanel({ intel }: { intel: MarketIntel }) {
  const f = intel.fluctuation;
  if (!f) return null;
  return (
    <div className={card}>
      <SectionTitle hint={`${f.n} observations`}>Fluctuation</SectionTitle>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-2xl" style={{ color: toneFor(f.state) }}>
          {f.score}
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: toneFor(f.state) }}
        >
          {f.state}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{f.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <Metric label="Signal flicker" value={`${(f.signalFlickerRate * 100).toFixed(0)}%`} />
        <Metric label="Edge sign flips" value={`${(f.edgeSignFlipRate * 100).toFixed(0)}%`} />
        <Metric label="Confidence σ" value={f.confidenceOscillation.toFixed(1)} />
        <Metric label="Psychology flips" value={`${(f.psychologyFlipRate * 100).toFixed(0)}%`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-foreground">{value}</div>
    </div>
  );
}
