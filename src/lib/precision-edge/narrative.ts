// Precision Edge AI — translates an EngineOutput into the human narrative the
// terminal shows: market DNA personality, psychological state, and the
// evidence chain that justifies the recommendation.
import type { EngineOutput, EngineScore } from "./types";

function eng(o: EngineOutput, name: string): EngineScore | undefined {
  return o.engineContributions.find((e) => e.name === name);
}

/** Live personality label for a market. */
export function marketDNA(o: EngineOutput): string {
  const f = o.featureContributions;
  const mom = f.momentum ?? 0;
  const stab = f.distributionStability ?? 0.5;
  const ent = f.entropyNorm ?? 1;
  const health = o.marketHealth;
  if (health < 45) return "Manipulated";
  if (o.state === "expired") return "Exhausted";
  if (Math.abs(mom) > 0.35 && o.trend !== "flat") return mom > 0 ? "Expanding" : "Compressing";
  if (o.edgeScore >= 70 && stab > 0.6) return "Accumulating";
  if (o.state === "strengthening") return "Trending";
  if (o.state === "weakening") return "Distributing";
  if (stab > 0.62 && ent > 0.9) return "Balanced";
  if (ent < 0.85) return "Rotational";
  return "Healthy";
}

/** One-line description of who currently controls the market. */
export function psychologyState(o: EngineOutput): string {
  const t = o.recommended?.candidate.type;
  if (t === "UNDER")
    return "Higher winning digits keep absorbing probability while lower losing digits stay suppressed.";
  if (t === "OVER")
    return "Lower-zone digits are attracting pressure while higher digits remain suppressed.";
  if (t === "EVEN") return "Even digits are accumulating dominance over odd digits.";
  if (t === "ODD") return "Odd digits are strengthening while even digits lose influence.";
  if (t === "DIFFERS") return "The dominant digit is over-crowded and likely to be avoided next.";
  if (t === "MATCHES") return "A single digit is repeatedly attracting order flow.";
  return "No group has taken clear control — the market story is still forming.";
}

/** Ordered evidence bullets backing the recommendation. */
export function evidence(o: EngineOutput): string[] {
  const out: string[] = [];
  const rec = o.recommended;
  if (rec) {
    const p = (rec.probability * 100).toFixed(1);
    const base = (rec.historicalProb * 100).toFixed(1);
    out.push(`Empirical win rate ${p}% over 100 ticks (baseline ${base}%).`);
    const agree =
      Math.abs(rec.edge) < 0.03 ? "strong" : Math.abs(rec.edge) < 0.06 ? "steady" : "mixed";
    out.push(`Multi-window agreement is ${agree} across 20/50/100/200/500 horizons.`);
    if (o.recovery) {
      out.push(
        `${rec.candidate.label} bot: recovery ${o.recovery.primary.label} → ${o.recovery.recovery.label} stays compatible.`,
      );
    }
  }
  const psy = eng(o, "psychology");
  if (psy?.reasons?.length) out.push(psy.reasons[0]);
  const zone = eng(o, "zone");
  if (zone?.reasons?.length) out.push(zone.reasons[0]);
  const contra = eng(o, "contrarian");
  if (contra?.reasons?.length) out.push(contra.reasons[0]);
  const stab = eng(o, "setupStability");
  if (stab?.reasons?.length) out.push(stab.reasons[0]);
  // De-duplicate and cap.
  return Array.from(new Set(out.filter(Boolean))).slice(0, 6);
}

/** Short reason paragraph for the headline card. */
export function reasonParagraph(o: EngineOutput): string {
  const t = o.recommended?.candidate.type;
  const dir =
    t === "UNDER"
      ? "favours Under traders because higher winning digits keep absorbing probability while losing digits remain suppressed"
      : t === "OVER"
        ? "favours Over traders because lower-zone digits keep drawing pressure while high digits stay weak"
        : "shows a consistent imbalance in favour of the recommended side";
  return `The market currently ${dir}. Pressure has stayed stable long enough (${(o.ageMs / 1000).toFixed(0)}s) to form a statistically reliable, ${o.marketHealthLabel} opportunity.`;
}

export function healthTone(v: number): "bull" | "warn" | "bear" {
  if (v >= 70) return "bull";
  if (v >= 55) return "warn";
  return "bear";
}
