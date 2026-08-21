// APEX SENTINEL — sensitive digit monitor, contract pressure balance,
// losing-side threat and forward projection. Pure read-outs of engine values.
import { SectionTitle } from "@/components/apex/EvidencePanel";
import type { ContractEval, MarketIntel } from "@/lib/apex/types";

const fmtPp = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}pp`;

export function SensitiveDigitMonitor({
  intel,
  contract,
}: {
  intel: MarketIntel;
  contract: ContractEval;
}) {
  const di = intel.digitIntel;
  if (!di) {
    return (
      <div className="glass rounded-xl border border-border/50 p-5 text-xs text-muted-foreground">
        DATA THIN — digit intelligence not yet available for {intel.symbol}.
      </div>
    );
  }
  const winners = new Set(contract.winners);
  const threatOf = (d: number) => contract.threat?.threats.find((t) => t.digit === d) ?? null;
  const bars = intel.bars;

  return (
    <div className="glass rounded-xl border border-border/50 p-5">
      <SectionTitle hint={`${contract.label} · winning side ${contract.winners.join(", ")}`}>
        Sensitive digit monitor
      </SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="py-2">Digit</th>
              <th>Side</th>
              <th className="text-right">Fast %</th>
              <th className="text-right">Pressure</th>
              <th className="text-right">Velocity</th>
              <th className="text-right">Accel</th>
              <th className="text-right">Repeats (20)</th>
              <th>State</th>
              <th className="text-right">Threat</th>
            </tr>
          </thead>
          <tbody>
            {di.profiles.map((p) => {
              const win = winners.has(p.digit);
              const th = threatOf(p.digit);
              return (
                <tr key={p.digit} className="border-t border-border/40">
                  <td className="py-1.5 font-mono text-sm font-semibold">{p.digit}</td>
                  <td>
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: win ? "var(--bull)" : "var(--bear)" }}
                    >
                      {win ? "WIN" : "LOSE"}
                    </span>
                  </td>
                  <td className="text-right font-mono">{(p.fast * 100).toFixed(1)}%</td>
                  <td
                    className="text-right font-mono"
                    style={{ color: p.pressure >= 0 ? "var(--bull)" : "var(--bear)" }}
                  >
                    {fmtPp(p.pressure)}
                  </td>
                  <td className="text-right font-mono">{fmtPp(p.pressureVelocity)}</td>
                  <td className="text-right font-mono">{fmtPp(p.pressureAcceleration)}</td>
                  <td className="text-right font-mono">
                    {th ? th.recentCount : "—"}
                    {p.consecutive > 1 ? ` (${p.consecutive}×)` : ""}
                  </td>
                  <td className="text-[11px] text-muted-foreground">{p.state}</td>
                  <td
                    className="text-right font-mono"
                    style={{
                      color: !th
                        ? undefined
                        : th.score >= 62
                          ? "var(--bear)"
                          : th.score >= 45
                            ? "var(--warn)"
                            : "var(--muted-foreground)",
                    }}
                  >
                    {th ? `${th.score.toFixed(0)} ${th.state}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {bars && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Bar structure: current {bars.current?.color ?? "n/a"} ×{bars.consecutive}, previous{" "}
          {bars.previous?.color ?? "n/a"}, 2nd previous {bars.secondPrevious?.color ?? "n/a"} ·
          green rate {(bars.greenRate * 100).toFixed(0)}% · persistence{" "}
          {(bars.directionalPersistence * 100).toFixed(0)}% · most increasing digits{" "}
          {intel.digitIntel?.increasing.slice(0, 3).join(", ")} · most decreasing{" "}
          {intel.digitIntel?.decreasing.slice(0, 3).join(", ")}.
        </p>
      )}
    </div>
  );
}

export function PressureBalance({ contract }: { contract: ContractEval }) {
  const t = contract.threat;
  if (!t) {
    return (
      <div className="glass rounded-xl border border-border/50 p-5 text-xs text-muted-foreground">
        Threat engine has no usable sample for {contract.label} yet.
      </div>
    );
  }
  const winPct = Math.max(0, Math.min(100, 50 + t.asymmetry * 50));
  return (
    <div className="glass rounded-xl border border-border/50 p-5">
      <SectionTitle hint="directional, not frequency">Contract pressure balance</SectionTitle>
      <div className="flex h-3 overflow-hidden rounded-full border border-border/50">
        <div style={{ width: `${winPct}%`, background: "var(--bull)" }} />
        <div style={{ width: `${100 - winPct}%`, background: "var(--bear)" }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Winning side {contract.winners.join(",")}</span>
        <span>Losing side {t.losers.join(",")}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-border/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Winning pressure
          </div>
          <div className="mt-1 font-mono">
            {fmtPp(t.winning.pressure)} · vel {fmtPp(t.winning.velocity)} · acc{" "}
            {fmtPp(t.winning.acceleration)}
          </div>
          <div className="mt-1 text-muted-foreground">
            share {(t.winning.share * 100).toFixed(1)}% vs baseline{" "}
            {(t.winning.baseline * 100).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg border border-border/50 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Losing pressure
          </div>
          <div className="mt-1 font-mono">
            {fmtPp(t.losing.pressure)} · vel {fmtPp(t.losing.velocity)} · acc{" "}
            {fmtPp(t.losing.acceleration)}
          </div>
          <div className="mt-1 text-muted-foreground">
            share {(t.losing.share * 100).toFixed(1)}% vs baseline{" "}
            {(t.losing.baseline * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Asymmetry {(t.asymmetry * 100).toFixed(0)} · group threat {t.groupThreat.toFixed(0)} (
        {t.state}) · recurrence {t.recurrence}
        {t.risingLosers.length
          ? ` · losing digits gaining pressure: ${t.risingLosers.join(", ")}`
          : " · no losing digit is currently gaining pressure"}
        .
      </p>
      {t.alerts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {t.alerts.slice(0, 4).map((a, i) => (
            <li key={i} className="text-[11px]" style={{ color: "var(--bear)" }}>
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ForwardProjectionPanel({
  contract,
  agreement,
}: {
  contract: ContractEval;
  agreement: string;
}) {
  const f = contract.forward;
  const tone =
    agreement === "SUPPORT"
      ? "var(--bull)"
      : agreement === "NEUTRAL"
        ? "var(--neon)"
        : "var(--bear)";
  return (
    <div className="glass rounded-xl border border-border/50 p-5">
      <SectionTitle hint="state description, never a digit prediction">
        Forward state projection
      </SectionTitle>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Engine agreement
        </span>
        <span
          className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: tone, borderColor: tone }}
        >
          {agreement}
        </span>
      </div>
      {!f ? (
        <p className="text-xs text-muted-foreground">
          Projection unavailable — the engine has no usable state sample yet.
        </p>
      ) : (
        <>
          <div className="grid gap-3 text-xs md:grid-cols-3">
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Current state
              </div>
              <p className="mt-1 text-foreground/85">{f.current}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Projected state ({f.horizonTicks} ticks)
              </div>
              <p className="mt-1 text-foreground/85">{f.developing}</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Invalidation risk
              </div>
              <p className="mt-1" style={{ color: "var(--warn)" }}>
                {f.risk}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {f.direction} · strength {f.strength.toFixed(0)} · uncertainty{" "}
            {f.uncertainty.toFixed(0)} · winning pressure {f.winningPressureOutlook} · losing threat{" "}
            {f.losingThreatOutlook} · regime {f.regimeOutlook} · {f.analogueSupport}
          </p>
        </>
      )}
    </div>
  );
}
