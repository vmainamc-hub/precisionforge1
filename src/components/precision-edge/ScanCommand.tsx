import { Radar, Zap, ShieldCheck, Timer, Activity, Bot, Gauge, TrendingUp } from "lucide-react";
import type { MarketRow, ScanState } from "@/hooks/usePrecisionEdgeScan";
import { cn } from "@/lib/utils";
import {
  marketDNA,
  psychologyState,
  evidence,
  reasonParagraph,
} from "@/lib/precision-edge/narrative";

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Zap;
  label: string;
  value: number | string;
  tone: "bull" | "warn" | "bear" | "neon";
}) {
  const color =
    tone === "bull"
      ? "var(--bull)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "bear"
          ? "var(--bear)"
          : "var(--primary)";
  return (
    <div className="flex-1 min-w-[92px]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-2xl font-semibold tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function toneOf(v: number): "bull" | "warn" | "bear" {
  if (v >= 70) return "bull";
  if (v >= 55) return "warn";
  return "bear";
}

function BestEdge({ best }: { best: MarketRow }) {
  const rec = best.recommended!;
  const bull =
    best.recommended!.candidate.type === "OVER" || best.recommended!.candidate.type === "UNDER";
  return (
    <div className="rounded-xl border border-[var(--bull)]/30 bg-[var(--bull)]/[0.06] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--bull)]">
            Best available edge
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            <span className="text-[var(--bull)]">
              {rec.candidate.label.split(" ")[0]} {rec.candidate.barrier}
            </span>
            <span className="text-muted-foreground font-normal text-lg"> on </span>
            <span className="text-[var(--primary)]">{best.name}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {best.recovery && (
              <>
                Recovery {best.recovery.primary.label} → {best.recovery.recovery.label} ·{" "}
              </>
            )}
            State <span className="text-warn capitalize">{best.state}</span> · DNA{" "}
            <span className="text-[var(--primary)]">{marketDNA(best)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tabular text-[var(--bull)] neon-text">
            {rec.quality.toFixed(1)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quality</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-y border-border/40 py-3">
        <Metric
          icon={ShieldCheck}
          label="Health"
          value={best.marketHealth.toFixed(0)}
          tone={toneOf(best.marketHealth)}
        />
        <Metric
          icon={Timer}
          label="Persist."
          value={(best.ageMs / 1000) | 0}
          tone={toneOf(Math.min(100, best.ageMs / 100))}
        />
        <Metric
          icon={Activity}
          label="Stable"
          value={best.setupQuality.toFixed(0)}
          tone={toneOf(best.setupQuality)}
        />
        <Metric
          icon={Bot}
          label="Bot fit"
          value={(best.recovery?.compatibility ?? 60).toFixed(0)}
          tone={toneOf(best.recovery?.compatibility ?? 60)}
        />
        <Metric
          icon={Gauge}
          label="Conf."
          value={best.confidence.toFixed(0)}
          tone={toneOf(best.confidence)}
        />
      </div>

      <div className="text-xs text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">Psychology · </span>
        {psychologyState(best)}
      </div>

      <ul className="space-y-1.5">
        {evidence(best).map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
            <Zap className="w-3 h-3 mt-0.5 shrink-0 text-[var(--bull)]" />
            <span>{e}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
        <span className="text-foreground font-medium">Reason · </span>
        {reasonParagraph(best)}
      </p>
    </div>
  );
}

export function ScanCommand({ scan, threshold }: { scan: ScanState; threshold: number }) {
  const noTrade = !scan.best;
  return (
    <div className="flex flex-col gap-5 min-h-0">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Command
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Scan every market</h1>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          <div>
            Threshold ≥ <span className="text-foreground font-semibold tabular">{threshold}</span>
          </div>
          <div>
            Feeds{" "}
            <span className="text-foreground font-semibold tabular">
              {scan.feedsReady}/{scan.feedsTotal}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center py-4">
        <button
          onClick={scan.scanNow}
          className={cn(
            "relative w-52 h-52 rounded-full grid place-items-center transition-transform active:scale-95",
            "bg-gradient-to-br from-[var(--bull)]/80 to-[var(--primary)]/70 text-background",
            scan.scanning ? "neon-border scale-[1.02]" : "shadow-[0_0_40px_-8px_var(--bull)]",
          )}
          style={{ boxShadow: "0 0 60px -10px var(--bull)" }}
        >
          <span
            className={cn(
              "absolute inset-0 rounded-full border border-[var(--bull)]/50",
              scan.scanning && "animate-ping",
            )}
          />
          <div className="flex flex-col items-center gap-2">
            <Radar
              className={cn("w-12 h-12", scan.scanning && "animate-spin")}
              style={{ animationDuration: "2.4s" }}
            />
            <span className="text-sm font-semibold tracking-[0.3em]">SCAN</span>
          </div>
        </button>
      </div>

      {noTrade ? (
        <div className="rounded-xl border border-warn/40 bg-warn/[0.06] px-5 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-warn leading-relaxed">
            No trade · AI is monitoring every market — no setup currently meets the required
            evidence, persistence and stability.
          </p>
        </div>
      ) : (
        <BestEdge best={scan.best!} />
      )}
    </div>
  );
}
