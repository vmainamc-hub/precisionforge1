import { useEffect, useState } from "react";
import { BookOpen, Check, X, SkipForward, ShieldAlert } from "lucide-react";
import {
  listJournal,
  markOutcome,
  subscribe,
  type JournalEntry,
  type Outcome,
} from "@/lib/precision-edge-v2/journal";
import { cn } from "@/lib/utils";

const OUTCOMES: { key: Outcome; label: string; icon: typeof Check; cls: string }[] = [
  {
    key: "win",
    label: "Win",
    icon: Check,
    cls: "text-[var(--bull)] border-[var(--bull)]/40 hover:bg-[var(--bull)]/10",
  },
  {
    key: "loss",
    label: "Loss",
    icon: X,
    cls: "text-[var(--bear)] border-[var(--bear)]/40 hover:bg-[var(--bear)]/10",
  },
  {
    key: "skipped",
    label: "Skip",
    icon: SkipForward,
    cls: "text-muted-foreground border-border/50 hover:bg-secondary/40",
  },
  {
    key: "invalidated",
    label: "Invalid",
    icon: ShieldAlert,
    cls: "text-warn border-warn/40 hover:bg-warn/10",
  },
];

export function JournalPanel() {
  const [items, setItems] = useState<JournalEntry[]>(() => listJournal());
  useEffect(() => subscribe(() => setItems(listJournal())), []);

  const decided = items.filter((e) => e.outcome === "win" || e.outcome === "loss");
  const winRate =
    decided.length > 0
      ? (decided.filter((e) => e.outcome === "win").length / decided.length) * 100
      : 0;

  return (
    <div className="glass rounded-xl border border-border/50">
      <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--primary)]" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Trade journal
            </div>
            <div className="text-lg font-semibold text-foreground">Outcomes & feedback</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular text-[var(--bull)]">{winRate.toFixed(0)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {decided.length} decided · {items.length} logged
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="grid place-items-center py-8 text-xs text-muted-foreground">
            No signals yet. Journal auto-records when a READY signal locks.
          </div>
        ) : (
          items.slice(0, 30).map((e) => (
            <div key={e.id} className="rounded-lg border border-border/40 bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground">
                    <span className="text-[var(--bull)]">{e.contract}</span>
                    <span className="text-muted-foreground"> · {e.market}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(e.ts).toLocaleString()} · conf {e.confidence.toFixed(0)}% · edge{" "}
                    {(e.edge * 100).toFixed(1)} · H {e.health.toFixed(0)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {OUTCOMES.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => markOutcome(e.id, o.key)}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors",
                        o.cls,
                        e.outcome === o.key &&
                          "bg-[var(--primary)]/10 border-[var(--primary)]/60 text-[var(--primary)]",
                      )}
                      title={o.label}
                    >
                      <o.icon className="w-3 h-3" />
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {e.reasoning && (
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  {e.reasoning}
                </p>
              )}
              {e.outcome !== "pending" && (
                <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--primary)]">
                  Outcome: {e.outcome}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
