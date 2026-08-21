import { SectionTitle } from "@/components/apex/EvidencePanel";
import type { ContractEval } from "@/lib/apex/types";

const card = "rounded-xl border border-border bg-card p-4";

function tone(state: string) {
  if (state === "SEVERE") return "var(--bear)";
  if (state === "HIGH") return "var(--bear)";
  if (state === "MODERATE") return "var(--warn)";
  return "var(--bull)";
}

/**
 * LOSING-DIGIT EXPOSURE — every digit that makes THIS contract lose, with its
 * burst behaviour and what this market historically did after similar bursts.
 */
export function ExposurePanel({ contract }: { contract: ContractEval }) {
  const e = contract.exposure;
  if (!e) return null;
  return (
    <div className={card}>
      <SectionTitle hint={contract.label}>Losing-digit exposure</SectionTitle>
      <div className="mb-3 flex flex-wrap items-baseline gap-4">
        <Big label="LOSING_DIGIT_RISK" value={e.losingDigitRisk} state={e.state} />
        <Big label="LOSING_DIGIT_EXPOSURE" value={e.losingDigitExposure} state={e.state} />
        {e.bursting.length > 0 && (
          <span className="text-[11px]" style={{ color: "var(--bear)" }}>
            Bursting now: {e.bursting.join(", ")} — treated as exposure, never as "due to stop".
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left uppercase tracking-wider text-muted-foreground">
              <th className="py-1 pr-3">Digit</th>
              <th className="py-1 pr-3">Risk</th>
              <th className="py-1 pr-3">Fast %</th>
              <th className="py-1 pr-3">Pressure</th>
              <th className="py-1 pr-3">Streak</th>
              <th className="py-1 pr-3">Last 10 / 20</th>
              <th className="py-1 pr-3">Longest burst</th>
              <th className="py-1 pr-3">After bursts</th>
              <th className="py-1">Role</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {e.digits.map((d) => (
              <tr key={d.digit} className="border-t border-border/60">
                <td className="py-1 pr-3 text-foreground">{d.digit}</td>
                <td className="py-1 pr-3" style={{ color: tone(d.state) }}>
                  {d.risk} {d.state}
                </td>
                <td className="py-1 pr-3">{(d.frequency * 100).toFixed(1)}%</td>
                <td
                  className="py-1 pr-3"
                  style={{ color: d.pressure > 0 ? "var(--bear)" : "var(--bull)" }}
                >
                  {(d.pressure * 100 >= 0 ? "+" : "") + (d.pressure * 100).toFixed(1)}pp
                </td>
                <td className="py-1 pr-3">{d.streak}</td>
                <td className="py-1 pr-3">
                  {d.burstCount} / {d.recentAppearances}
                </td>
                <td className="py-1 pr-3">{d.longestBurst}</td>
                <td className="py-1 pr-3">
                  {d.continuationAfterBurst >= 0
                    ? `${(d.continuationAfterBurst * 100).toFixed(0)}% (N=${d.continuationN})`
                    : "no sample"}
                </td>
                <td className="py-1">{d.role === "NONE" ? "—" : d.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {e.alerts.length > 0 && (
        <ul className="mt-3 space-y-1">
          {e.alerts.map((a, i) => (
            <li key={i} className="text-[11px]" style={{ color: "var(--bear)" }}>
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Big({ label, value, state }: { label: string; value: number; state: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-xl" style={{ color: tone(state) }}>
        {value}
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}
