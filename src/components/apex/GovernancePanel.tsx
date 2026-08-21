// APEX SENTINEL — GOVERNANCE PANEL.
// Surfaces Levels 1 & 2 (trader global veto + cross-market pattern risk) and
// the market-state evidence profile for the current best candidate.
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { RankedOpportunity } from "@/lib/apex/types";
import {
  activeGlobalVetoRules,
  allPatternRiskStats,
  createGlobalVetoRule,
  releaseGlobalVetoRule,
  subscribeGlobalVeto,
} from "@/lib/sentinel/global-veto";
import { patternSignatureFromOpportunity } from "@/lib/sentinel/pattern-tags";

function useVetoState() {
  const [, bump] = useState(0);
  useEffect(() => {
    const off = subscribeGlobalVeto(() => bump((n) => n + 1));
    return () => {
      off();
    };
  }, []);
  return {
    rules: activeGlobalVetoRules(),
    risks: allPatternRiskStats().slice(0, 8),
  };
}

export default function GovernancePanel({ best }: { best: RankedOpportunity | null }) {
  const { rules, risks } = useVetoState();

  const veto = useCallback(() => {
    if (!best) return;
    createGlobalVetoRule({
      sourceId: `${best.symbol}:${best.contract.id}`,
      operatorText: "Never take this pattern again until I release it.",
      pattern: patternSignatureFromOpportunity(best),
      reason: `Operator veto from live signal on ${best.name}`,
      scope: "GLOBAL",
    });
  }, [best]);

  const evidence = best?.stateEvidence ?? null;
  const gov = best?.governance ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/80 bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Level 1 · Trader global risk rules
            </h3>
            <p className="text-xs text-foreground">
              A vetoed pattern can never become Best Opportunity on any market, whatever its score.
            </p>
          </div>
          <Button size="sm" className="h-8 text-[11px]" disabled={!best} onClick={veto}>
            Veto this pattern globally
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {rules.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No active veto rules.</p>
          ) : (
            rules.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/70 bg-background/60 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-[var(--bear)]">
                    {r.scope} · {r.pattern.tags.join(" + ")}
                    {r.pattern.entryDigit != null ? ` · digit ${r.pattern.entryDigit}` : ""}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{r.reason}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  onClick={() => releaseGlobalVetoRule(r.id)}
                >
                  Release
                </Button>
              </div>
            ))
          )}
        </div>
        {gov && (
          <p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">
            Current best candidate governance: <span className="text-foreground">{gov.verdict}</span>{" "}
            — {gov.reasons.join(" ")}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border/80 bg-card/60 p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Level 2 · Cross-market pattern loss memory
        </h3>
        <div className="mt-2 space-y-1.5">
          {risks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No resolved pattern history recorded yet.
            </p>
          ) : (
            risks.map((s) => (
              <div key={s.key} className="rounded border border-border/60 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span className="truncate text-foreground">{s.tags.join(" + ")}</span>
                  <span
                    style={{
                      color:
                        s.riskLevel === "SEVERE" || s.riskLevel === "ELEVATED"
                          ? "var(--bear)"
                          : s.riskLevel === "WATCH"
                            ? "var(--warn)"
                            : "var(--muted-foreground)",
                    }}
                  >
                    {s.riskLevel}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">{s.note}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/80 bg-card/60 p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Market-state evidence · {best ? `${best.name} · ${best.contract.label}` : "no candidate"}
        </h3>
        {!evidence ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Awaiting resolved simulated outcomes for this market and contract.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
              <span className="text-foreground">REGIME: {evidence.regime}</span>
              <span className="text-foreground">VERDICT: {evidence.verdict}</span>
              <span className="text-muted-foreground">
                CONFIDENCE: {evidence.confidence.toFixed(0)}/100
              </span>
              <span className="text-muted-foreground">
                STABILITY: {evidence.stability.label}
              </span>
              <span className="text-muted-foreground">
                TRANSITION: {evidence.streakTransition.transition}
              </span>
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">{evidence.summary}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {evidence.windows.map((w) => (
                <div
                  key={w.window}
                  className="flex items-center justify-between rounded border border-border/60 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  <span>n={w.n} (win {w.window})</span>
                  <span className="text-foreground">
                    {(w.winRate * 100).toFixed(1)}% · streak {w.currentStreak}
                  </span>
                </div>
              ))}
            </div>
            <ul className="space-y-0.5">
              {evidence.reasons.map((r, i) => (
                <li key={i} className="text-[10px] text-muted-foreground">
                  • {r}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground">{evidence.changePoint.note}</p>
          </div>
        )}
      </section>
    </div>
  );
}
