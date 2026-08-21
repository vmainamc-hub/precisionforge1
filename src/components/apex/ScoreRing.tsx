import { cn } from "@/lib/utils";

interface Props {
  value: number;
  label: string;
  size?: number;
  tone?: "neon" | "bull" | "bear" | "warn" | "muted";
  sublabel?: string;
}

const TONE: Record<string, string> = {
  neon: "var(--neon)",
  bull: "var(--bull)",
  bear: "var(--bear)",
  warn: "var(--warn)",
  muted: "var(--muted-foreground)",
};

export function ScoreRing({ value, label, size = 92, tone = "neon", sublabel }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TONE[tone] ?? TONE.neon;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            style={{ transition: "stroke-dashoffset 400ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold leading-none" style={{ color }}>
            {Math.round(pct)}
          </span>
          {sublabel && (
            <span className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className={cn("text-[10px] uppercase tracking-[0.18em] text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

export function MetricBar({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const good = invert ? 100 - pct : pct;
  const color = good > 66 ? "var(--bull)" : good > 40 ? "var(--warn)" : "var(--bear)";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {Math.round(pct)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
