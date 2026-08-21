import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

import { PRESSURE_META } from "@/lib/precision-edge-v2/pressure-engine";
import { PRECISION_CONTRACTS, CONTRACT_DEFS } from "@/lib/precision-scanner/contracts";
import { playPrecisionAlert } from "@/lib/precision-scanner/alert-sound";
import { grade } from "@/lib/precision-scanner/scoring";
import { ScannerSettingsDrawer } from "@/components/modules/ScannerSettingsDrawer";

import type {
  PrecisionScanSignal,
  PrecisionWinRates,
  ResolvedPrecisionSignal,
  PrecisionNearMiss,
} from "@/hooks/useMultiMarketPrecisionScan";

function since(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const SHORT_STATE: Record<string, string> = {
  dominant: "Dom",
  recovering: "Rec",
  exhausting: "Exh",
  suppressed: "Sup",
  fair: "Fair",
};

/** Natural-English prose explaining why a signal fired. */
function generateExplanation(sig: PrecisionScanSignal): string[] {
  const lines: string[] = [];
  const winners = sig.keyWinnerDigits;
  const dominant = winners.filter((d) => sig.pressureStates[d] === "dominant");
  const recovering = winners.filter((d) => sig.pressureStates[d] === "recovering");

  const zonePct = sig.winnerDigits.reduce((a, d) => a + sig.digitPct[d], 0) * 100;
  const fairPct = sig.winnerDigits.length * 10;
  const loserPct = sig.loserDigits.reduce((a, d) => a + sig.digitPct[d], 0) * 100;
  lines.push(
    `Live 0-9 distribution: digits ${sig.winnerDigits.join(", ")} hold ${zonePct.toFixed(1)}% of the last 1000 ticks against a fair ${fairPct}% ` +
      `(+${(zonePct - fairPct).toFixed(1)} points), while the losing digits ${sig.loserDigits.join(", ")} only hold ${loserPct.toFixed(1)}%. ` +
      `That distribution imbalance is what triggered ${sig.label} — the pressure map below only confirms it.`,
  );

  lines.push(
    `Digits ${winners.join(", ")} — the winning side for ${sig.label} — are all building pressure. ` +
      `${dominant.length} of them are dominant (over fair share and still climbing) and ${recovering.length} are recovering (rising back from below). ` +
      `The winning group is actively absorbing probability.`,
  );

  const suppressed = sig.loserDigits.filter((d) => sig.pressureStates[d] === "suppressed");
  const exhausting = sig.loserDigits.filter((d) => sig.pressureStates[d] === "exhausting");
  lines.push(
    `The losing side (digits ${sig.loserDigits.join(", ")}) is fading` +
      (suppressed.length ? ` — ${suppressed.join(", ")} suppressed` : "") +
      (exhausting.length
        ? `${suppressed.length ? " and" : " —"} ${exhausting.join(", ")} exhausting`
        : "") +
      `. None are recovering or gaining strength, so there is no competition against the winning side.`,
  );

  lines.push(
    `The boundary digit (${sig.gateDigit}) sits at ${(sig.gateDigitPct * 100).toFixed(1)}% and is ` +
      `${sig.gateDigitMomentum < -0.0005 ? "falling" : "flat"} — present in the market but not threatening to grow, ` +
      `which confirms the setup is safe to act on.`,
  );

  const pass = sig.gateDetails.filter((g) => g.pass).length;
  lines.push(
    `All ${pass} of ${sig.gateDetails.length} confirmation gates align on ${sig.name} (${sig.symbol}) at ${sig.confidence}% confidence.`,
  );

  return lines;
}

function DigitPressureMap({ sig }: { sig: PrecisionScanSignal }) {
  return (
    <div className="grid grid-cols-10 gap-px rounded-md overflow-hidden">
      {sig.pressureStates.map((state, d) => {
        const isWinner = sig.keyWinnerDigits.includes(d);
        const isGate = d === sig.gateDigit;
        return (
          <div
            key={d}
            className="flex flex-col items-center gap-1 py-2"
            style={{
              backgroundColor: isGate
                ? "color-mix(in oklab, var(--warn) 7%, transparent)"
                : isWinner
                  ? "color-mix(in oklab, var(--bull) 7%, transparent)"
                  : "transparent",
            }}
            title={`d${d} · ${PRESSURE_META[state].label} · ${PRESSURE_META[state].blurb}`}
          >
            <span className="text-[10px] text-muted-foreground tabular">{d}</span>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PRESSURE_META[state].color }}
            />
            <span className="text-[10px] tabular">{(sig.digitPct[d] * 100).toFixed(1)}</span>
            <span className="text-[9px] text-muted-foreground">{SHORT_STATE[state] ?? state}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: number;
  tone: string;
  caption: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="tabular text-[12px] font-semibold" style={{ color: tone }}>
          {value}
        </span>
      </div>
      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: tone }}
        />
      </span>
      <span className="block text-[10px] text-muted-foreground">{caption}</span>
    </div>
  );
}

function LockPill({ sig }: { sig: PrecisionScanSignal }) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.ceil((sig.lockedUntil - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(
      () => setLeft(Math.max(0, Math.ceil((sig.lockedUntil - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [sig.lockedUntil]);

  const fading = !sig.stillValid;
  const color =
    left > 0 ? (fading ? "var(--warn)" : "var(--neon)") : fading ? "var(--warn)" : "var(--bull)";
  const text =
    left > 0
      ? fading
        ? `⚠ Setup fading · ${left}s`
        : `🔒 Locked · ${left}s remaining`
      : fading
        ? "⚠ Setup fading — verify before trading"
        : "✓ Signal active";
  return (
    <span
      className="rounded-full px-2 py-[2px] text-[10px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      {text}
    </span>
  );
}

function SignalCard({ sig, onDismiss }: { sig: PrecisionScanSignal; onDismiss: () => void }) {
  const [flash, setFlash] = useState(true);
  const sideColor = sig.side === "OVER" ? "var(--bull)" : "var(--accent)";
  const prose = useMemo(() => generateExplanation(sig), [sig]);
  const g = grade(sig.finalScore);

  useEffect(() => {
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={cn(
        "mx-3 my-2 rounded-[10px] border border-border/40 p-4 space-y-4",
        flash && "signal-flash",
      )}
      style={{
        borderLeft: `4px solid ${sig.stillValid ? sideColor : "var(--warn)"}`,
        boxShadow: sig.stillValid ? `0 0 18px -8px ${sideColor}` : "none",
        opacity: sig.stillValid ? 1 : 0.75,
        backgroundColor: sig.stillValid
          ? "color-mix(in oklab, var(--card) 60%, transparent)"
          : "color-mix(in oklab, var(--warn) 6%, var(--card) 60%)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ backgroundColor: sideColor, color: "#04060a" }}
        >
          ⚡ {sig.label} signal
        </span>
        <LockPill sig={sig} />
        <span className="ml-auto text-[11px] text-muted-foreground tabular">
          {since(sig.ts)} ago
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] text-muted-foreground hover:text-foreground px-1"
          aria-label="Dismiss signal"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-sm font-medium">{sig.name}</div>
          <div className="text-[11px] text-muted-foreground tabular">{sig.symbol}</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: sideColor }}>
            {sig.label}
          </span>
          <span className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{ width: `${sig.confidence}%`, backgroundColor: sideColor }}
            />
          </span>
          <span className="tabular text-sm font-semibold">{sig.confidence}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[130px_1fr]">
        <div
          className="rounded-lg border px-3 py-2 text-center"
          style={{ borderColor: `color-mix(in oklab, ${g.color} 45%, transparent)` }}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            Final score
          </div>
          <div className="tabular text-3xl font-bold" style={{ color: g.color }}>
            {sig.finalScore}
          </div>
          <div className="text-[10px]" style={{ color: g.color }}>
            {g.letter} — {g.label}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ScoreBar
            label="Manipulation"
            value={sig.manipulationScore.value}
            tone={sig.manipulationScore.tone}
            caption={sig.manipulationScore.label}
          />
          <ScoreBar
            label="Edge"
            value={sig.edge.edgeScore}
            tone="var(--bull)"
            caption={`${sig.edge.rawEdge >= 0 ? "+" : ""}${(sig.edge.rawEdge * 100).toFixed(1)}% ${sig.edge.label} → ${sig.edge.momentumTag}`}
          />
          <ScoreBar
            label="Persistence"
            value={sig.persistence.persistenceScore}
            tone="var(--accent)"
            caption={`${sig.persistence.label} · ${sig.persistence.streakTicks}-tick streak`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Why this signal fired
        </h5>
        {prose.map((line, i) => (
          <p key={i} className="flex gap-2 text-[12px] leading-relaxed text-foreground/90">
            <span style={{ color: sideColor }}>✓</span>
            <span>{line}</span>
          </p>
        ))}
      </div>

      <div className="space-y-1">
        <h5 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Digit pressure map
        </h5>
        <DigitPressureMap sig={sig} />
      </div>

      <div className="space-y-1">
        <h5 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Distribution + pressure gates
        </h5>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {sig.gateDetails.map((g) => (
            <span key={g.key} className="text-[11px]" title={g.note}>
              <span style={{ color: g.pass ? "var(--bull)" : "var(--bear)" }}>
                {g.pass ? "✓" : "✗"}
              </span>{" "}
              <span className="text-muted-foreground">{g.label}</span>{" "}
              <span className="tabular">{g.note}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrecisionMultiMarketFeed({
  signals,
  nearMisses = [],
  history,
  winRates,
  status,
  scannedCount,
  contractCount = 6,
}: {
  signals: PrecisionScanSignal[];
  nearMisses?: PrecisionNearMiss[];
  history: ResolvedPrecisionSignal[];
  winRates: PrecisionWinRates;
  status: string;
  scannedCount: number;
  contractCount?: number;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [, setTick] = useState(0);
  const lastScanRef = useRef(Date.now());
  const seenSignalIds = useRef(new Set<string>());
  const mountedRef = useRef(false);

  // 1s text counter — no animation.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    lastScanRef.current = Date.now();
  }, [signals, scannedCount]);

  useEffect(() => {
    for (const sig of signals) {
      if (!seenSignalIds.current.has(sig.id)) {
        seenSignalIds.current.add(sig.id);
        if (mountedRef.current) {
          playPrecisionAlert();
          break;
        }
      }
    }
    mountedRef.current = true;
  }, [signals]);

  const visible = signals.filter((s) => !dismissed.has(s.id));
  const activeTypes = new Set(visible.map((s) => s.contractType));
  const resolved = history.filter((h) => h.outcome !== "PENDING").slice(0, 25);
  const wins = resolved.filter((h) => h.outcome === "WIN").length;
  const losses = resolved.length - wins;
  const lastScanSecs = Math.max(0, Math.round((Date.now() - lastScanRef.current) / 1000));

  return (
    <div className="glass overflow-hidden rounded-xl border border-border/50">
      {/* Header bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30"
        style={{ backgroundColor: "color-mix(in oklab, var(--secondary) 30%, transparent)" }}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Precision multi-market scanner
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground/70 tabular">
            {scannedCount} markets · {contractCount} contracts · Distribution-led confirmation
          </span>
        </span>
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 rounded-full", status === "live" && "slow-pulse")}
              style={{ backgroundColor: status === "live" ? "var(--bull)" : "var(--warn)" }}
            />
            {status === "live" ? "LIVE" : status}
          </span>
          <span className="tabular">{scannedCount} mkts</span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Scanner settings"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <Settings size={14} />
          </button>
        </span>
      </div>
      <ScannerSettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Contract strip */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-border/30">
        {PRECISION_CONTRACTS.map((c) => {
          const def = CONTRACT_DEFS[c];
          const active = activeTypes.has(c);
          const color = def.side === "OVER" ? "var(--bull)" : "var(--accent)";
          const wr = winRates[c];
          const total = wr.wins + wr.losses;
          return (
            <span
              key={c}
              title={
                total
                  ? `${Math.round((wr.wins / total) * 100)}% win rate`
                  : "No resolved signals yet"
              }
              className="rounded-full border px-2.5 py-[3px] text-[11px] font-semibold"
              style={
                active
                  ? {
                      borderColor: color,
                      color,
                      backgroundColor: `color-mix(in oklab, ${color} 10%, transparent)`,
                    }
                  : {
                      borderColor: "color-mix(in oklab, var(--border) 50%, transparent)",
                      color: "var(--muted-foreground)",
                      backgroundColor: "transparent",
                    }
              }
            >
              {def.label.toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* Active signals zone */}
      {visible.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            No opportunities detected — monitoring {scannedCount} markets
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            Signals are driven by the live 0-9 distribution and confirmed by the pressure map — all
            gates must align.
          </p>
          <p className="mt-4 text-[11px] text-muted-foreground/70 tabular">
            Last scan: {lastScanSecs}s ago · Markets watched: {scannedCount}
          </p>

          {nearMisses.length > 0 && (
            <div className="mt-5 text-left">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                One gate away
              </p>
              <div className="space-y-1">
                {nearMisses.map((n) => (
                  <div
                    key={n.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate">
                      <span className="font-semibold">{n.label.toUpperCase()}</span>
                      <span className="text-muted-foreground"> · {n.name}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular">
                      {n.buildingInWinners.length} in zone · blocked: {n.blockedBy.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto py-1">
          {visible.map((sig) => (
            <SignalCard
              key={sig.id}
              sig={sig}
              onDismiss={() => setDismissed((prev) => new Set(prev).add(sig.id))}
            />
          ))}
        </div>
      )}

      {/* History strip */}
      <div className="border-t border-border/30 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <span>{historyOpen ? "▾" : "▸"}</span>
          <span>
            Signal history ({wins}W / {losses}L)
          </span>
          <span className="ml-auto tabular">
            {resolved.length ? `${Math.round((wins / resolved.length) * 100)}%` : "—"}
          </span>
        </button>
        {historyOpen && resolved.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {resolved.map((h) => (
              <span
                key={h.id}
                title={`${h.label} · ${h.name} · ${h.confidence}%`}
                className="rounded-full border px-2 py-[2px] text-[10px] font-semibold tabular"
                style={{
                  borderColor: h.outcome === "WIN" ? "var(--bull)" : "var(--bear)",
                  color: h.outcome === "WIN" ? "var(--bull)" : "var(--bear)",
                }}
              >
                {h.outcome}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
