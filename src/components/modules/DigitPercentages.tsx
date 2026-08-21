import { useMemo } from "react";
import { Panel } from "../Panel";
import { lastDigit, type Tick } from "@/lib/analytics";
import { canonicalDigits, distributionFromDigits } from "@/lib/deriv/canonical-distribution";
import { digitRoleStats, assignDigitRoles } from "@/lib/digit-roles";
import { canonicalDigitState } from "@/lib/sentinel/digit-psychology";

// Neutral color for digits that have no special role
const NEUTRAL_COLOR = "#64748b"; // slate-500

// Role colors (override base) - all digits 0-9 are equal candidates
const HOT_COLOR = "var(--bull)"; // green - hottest
const HOT2_COLOR = "#84cc16"; // lime - second hottest
const COLD_COLOR = "var(--bear)"; // red - coldest
const COLD2_COLOR = "#fb7185"; // rose - second coldest
const RISING_COLOR = "var(--accent)"; // magenta - most increasing
const FALLING_COLOR = "#38bdf8"; // sky - most decreasing

export function DigitPercentages({ ticks, symbol }: { ticks: Tick[]; symbol?: string }) {
  const stats = useMemo(() => {
    // CANONICAL SOURCE — the same pip-size-aware digit stream Sentinel reads.
    // Deriving digits locally from the price (Math.round(price*100)%10) is
    // WRONG for symbols whose pip size is not 2, and was the cause of the
    // dashboard/Sentinel distribution mismatch.
    const canonical = symbol ? canonicalDigits(symbol) : null;
    const digits =
      canonical && canonical.length ? canonical.slice(-1000) : ticks.slice(-1000).map((t) => lastDigit(t.price));
    const dist = distributionFromDigits(digits, { symbol, source: "dashboard" });
    const { freq, delta } = digitRoleStats(digits);
    const pct = dist.pct;

    // Live unconstrained role assignment: every digit 0-9 is 100% eligible for ANY role/colour
    const roles = assignDigitRoles(pct, delta, 0);
    const state = canonicalDigitState(digits);

    // Dynamic role mapping: prefer canonical state if resolved, otherwise use live frequencies directly
    const hot = state.green !== null ? state.green : roles.hot;
    const hot2 = state.secondGreen !== null ? state.secondGreen : roles.hot2;
    const cold = state.red !== null ? state.red : roles.cold;
    const cold2 = state.secondRed !== null ? state.secondRed : roles.cold2;
    const rising = state.mostIncreasing !== null ? state.mostIncreasing : roles.rising;

    let falling = state.mostDecreasing !== null ? state.mostDecreasing : -1;
    if (falling === -1 && delta && delta.length > 0) {
      let minDeltaIdx = -1;
      for (let i = 0; i < delta.length; i++) {
        if (minDeltaIdx === -1 || delta[i] < delta[minDeltaIdx]) minDeltaIdx = i;
      }
      if (minDeltaIdx !== -1 && delta[minDeltaIdx] < 0) falling = minDeltaIdx;
    }

    return {
      freq,
      pct,
      total: dist.n,
      hot: hot >= 0 ? hot : -1,
      hot2: hot2 >= 0 ? hot2 : -1,
      cold: cold >= 0 ? cold : -1,
      cold2: cold2 >= 0 ? cold2 : -1,
      rising: rising >= 0 ? rising : -1,
      falling: falling >= 0 ? falling : -1,
      lastD: digits.length ? digits[digits.length - 1] : -1,
    };
  }, [ticks, symbol]);

  const { freq, pct, total, hot, hot2, cold, cold2, rising, falling, lastD } = stats;
  const maxP = Math.max(...pct, 1);

  function colorFor(d: number): string {
    if (d === hot && hot >= 0) return HOT_COLOR;
    if (d === cold && cold >= 0) return COLD_COLOR;
    if (d === rising && rising >= 0) return RISING_COLOR;
    if (d === hot2 && hot2 >= 0) return HOT2_COLOR;
    if (d === cold2 && cold2 >= 0) return COLD2_COLOR;
    if (d === falling && falling >= 0) return FALLING_COLOR;
    return NEUTRAL_COLOR;
  }

  function roleFor(d: number): string | null {
    if (d === hot && hot >= 0) return "HOT";
    if (d === cold && cold >= 0) return "COLD";
    if (d === rising && rising >= 0) return "RISING";
    if (d === hot2 && hot2 >= 0) return "HOT 2";
    if (d === cold2 && cold2 >= 0) return "COLD 2";
    if (d === falling && falling >= 0) return "FALLING";
    return null;
  }

  return (
    <Panel
      title="Digits 0–9 Live Distribution"
      subtitle={`Last ${total} ticks · Expected 10% each · All digits eligible`}
      accent="cyan"
    >
      <div className="grid grid-cols-10 gap-2">
        {pct.map((p, d) => {
          const isLast = d === lastD;
          const barH = Math.max(4, (p / maxP) * 100);
          const tone = colorFor(d);
          const role = roleFor(d);
          const highlighted = role !== null;
          return (
            <div key={d} className="flex flex-col items-center gap-1">
              <div className="tabular text-[11px] font-semibold" style={{ color: tone }}>
                {p.toFixed(1)}%
              </div>
              <div className="relative w-full h-24 rounded-md border border-border/40 bg-secondary/30 overflow-hidden flex items-end">
                <div
                  className="w-full transition-all duration-300"
                  style={{
                    height: `${barH}%`,
                    background: `linear-gradient(to top, ${tone}, color-mix(in oklab, ${tone} 40%, transparent))`,
                    boxShadow: highlighted ? `0 0 12px ${tone}` : undefined,
                  }}
                />
              </div>
              <div
                className={`tabular text-sm font-bold w-7 h-7 flex items-center justify-center rounded ${
                  isLast ? "ring-1 ring-[var(--accent)]" : ""
                }`}
                style={{ color: tone }}
              >
                {d}
              </div>
              <div
                className="tabular text-[8px] uppercase tracking-wider font-semibold leading-none h-3"
                style={{ color: role ? tone : "transparent" }}
              >
                {role ?? "·"}
              </div>
              <div className="tabular text-[9px] text-muted-foreground">{freq[d]}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          Hot{" "}
          <span className="font-semibold" style={{ color: HOT_COLOR }}>
            {hot >= 0 ? hot : "—"}
          </span>
        </span>
        <span>
          Hot 2{" "}
          <span className="font-semibold" style={{ color: HOT2_COLOR }}>
            {hot2 >= 0 ? hot2 : "—"}
          </span>
        </span>
        <span>
          Cold{" "}
          <span className="font-semibold" style={{ color: COLD_COLOR }}>
            {cold >= 0 ? cold : "—"}
          </span>
        </span>
        <span>
          Cold 2{" "}
          <span className="font-semibold" style={{ color: COLD2_COLOR }}>
            {cold2 >= 0 ? cold2 : "—"}
          </span>
        </span>
        <span>
          Rising{" "}
          <span className="font-semibold" style={{ color: RISING_COLOR }}>
            {rising >= 0 ? rising : "—"}
          </span>
        </span>
        <span>
          Falling{" "}
          <span className="font-semibold" style={{ color: FALLING_COLOR }}>
            {falling >= 0 ? falling : "—"}
          </span>
        </span>
        <span className="ml-auto">
          Last{" "}
          <span className="text-[var(--accent)] font-semibold">{lastD >= 0 ? lastD : "—"}</span>
        </span>
      </div>
    </Panel>
  );
}
