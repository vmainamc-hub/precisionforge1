import { memo, useMemo } from "react";
import { Panel } from "../Panel";
import { lastDigit, type Tick } from "@/lib/analytics";
import {
  computePressureField,
  PRESSURE_META,
  PRESSURE_SUB,
  PRESSURE_WINDOW,
  type PressureState,
} from "@/lib/precision-edge-v2/pressure-engine";

// Presentation layer for the canonical Digit Pressure / Scarcity engine
// (src/lib/precision-edge-v2/pressure-engine.ts). This is the same engine
// Precision Edge now trades from — the panel and the signals can never drift.

const WINDOW = PRESSURE_WINDOW;
const SUB = PRESSURE_SUB;
const STATE_META = PRESSURE_META;
const STATE_ORDER: PressureState[] = ["fair", "dominant", "exhausting", "suppressed", "recovering"];

function DigitPressureImpl({ ticks }: { ticks: Tick[] }) {
  // Only the tail matters, and only the digits — avoid cloning 1000 tick
  // objects on every frame.
  const rows = useMemo(() => {
    const start = Math.max(0, ticks.length - WINDOW);
    const digits: number[] = new Array(ticks.length - start);
    for (let i = start; i < ticks.length; i++) digits[i - start] = lastDigit(ticks[i].price);
    return computePressureField(digits, WINDOW, SUB).digits;
  }, [ticks]);

  const enoughData = ticks.length >= 200;
  const window = Math.min(ticks.length, WINDOW);

  return (
    <Panel
      title="Digit Pressure / Scarcity Engine"
      subtitle={`Live state per digit · ${window}-tick window · recent ${SUB} vs prior ${SUB}`}
      accent="magenta"
    >
      {!enoughData ? (
        <div className="text-xs text-muted-foreground py-4">Warming up… collecting ticks.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {rows.map((r) => {
              const meta = STATE_META[r.state];
              const pct = (r.share * 100).toFixed(1);
              const mom = r.momentum * 100;
              const momStr = `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}pt`;
              const shareBarWidth = `${Math.min(100, Math.max(4, r.share * 100 * 5))}%`;
              return (
                <div
                  key={r.d}
                  className="relative rounded-md border p-2.5 flex items-center gap-2.5 overflow-hidden"
                  style={{
                    borderColor: `color-mix(in oklab, ${meta.color} 70%, transparent)`,
                    background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: meta.color }}
                  />
                  <div
                    className="absolute bottom-0 left-0 h-[3px] rounded-r-full opacity-80"
                    style={{ width: shareBarWidth, background: meta.color }}
                  />
                  <div
                    className="relative z-10 tabular text-2xl font-bold w-9 h-9 flex items-center justify-center rounded"
                    style={{
                      color: meta.color,
                      background: `color-mix(in oklab, ${meta.color} 22%, transparent)`,
                      boxShadow: `0 0 0 1px color-mix(in oklab, ${meta.color} 45%, transparent)`,
                    }}
                  >
                    {r.d}
                  </div>
                  <div className="relative z-10 flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="text-[10px] uppercase tracking-wider font-semibold"
                        style={{
                          color: meta.color,
                          textShadow: `0 0 10px color-mix(in oklab, ${meta.color} 60%, transparent)`,
                        }}
                      >
                        {meta.label}
                      </span>
                      <span className="tabular text-[10px] text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="tabular text-[10px] text-muted-foreground">
                      momentum {momStr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {STATE_ORDER.map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ background: STATE_META[k].color }} />
                <span style={{ color: STATE_META[k].color }} className="font-semibold">
                  {STATE_META[k].label}
                </span>
                <span className="opacity-70 normal-case tracking-normal">
                  — {STATE_META[k].blurb}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

// Memoised: the dashboard re-renders on every tick, but the pressure grid only
// needs to change when the tick buffer identity changes.
export const DigitPressure = memo(DigitPressureImpl);
