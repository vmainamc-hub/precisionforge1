import { useMemo } from "react";
import type { Tick } from "@/lib/deriv-ws";

type Props = { ticks: Tick[]; pipSize: number };

export function TickChart({ ticks, pipSize }: Props) {
  const W = 1000;
  const H = 320;

  const { path, area, min, max, last, rising } = useMemo(() => {
    if (ticks.length < 2) {
      return { path: "", area: "", min: 0, max: 0, last: 0, rising: true };
    }
    const values = ticks.map((t) => t.quote);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = 16;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = pad + (1 - (v - min) / span) * (H - pad * 2);
      return [x, y] as const;
    });
    const path = pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    const area = `${path} L${W},${H} L0,${H} Z`;
    const lastVal = values[values.length - 1] ?? 0;
    const prevVal = values[values.length - 2] ?? lastVal;
    return {
      path,
      area,
      min,
      max,
      last: lastVal,
      rising: lastVal >= prevVal,
    };
  }, [ticks]);

  const stroke = rising ? "var(--color-success)" : "var(--color-danger)";

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[280px] w-full sm:h-[320px]"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="tickFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1="0"
            x2={W}
            y1={H * p}
            y2={H * p}
            stroke="var(--color-border)"
            strokeDasharray="4 8"
            strokeWidth="1"
          />
        ))}
        {path && (
          <>
            <path d={area} fill="url(#tickFill)" />
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {ticks.length > 1 && (
        <>
          <span className="tabular pointer-events-none absolute right-2 top-1 text-[11px] text-muted-foreground">
            {max.toFixed(pipSize)}
          </span>
          <span className="tabular pointer-events-none absolute bottom-1 right-2 text-[11px] text-muted-foreground">
            {min.toFixed(pipSize)}
          </span>
          <span
            className="tabular pointer-events-none absolute left-2 top-1 rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs"
            style={{ color: stroke }}
          >
            {last.toFixed(pipSize)}
          </span>
        </>
      )}
      {ticks.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Waiting for live ticks…
        </div>
      )}
    </div>
  );
}
