import type { VerdictState } from "@/lib/precision-edge-v2/types";
import { cn } from "@/lib/utils";

const MAP: Record<VerdictState, { label: string; cls: string }> = {
  READY: { label: "READY", cls: "bg-[var(--bull)]/15 text-[var(--bull)] border-[var(--bull)]/40" },
  WATCH: {
    label: "WATCH",
    cls: "bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/40",
  },
  BUILDING: { label: "BUILDING", cls: "bg-warn/15 text-warn border-warn/40" },
  CONFLICT: {
    label: "CONFLICT",
    cls: "bg-[var(--bear)]/10 text-[var(--bear)] border-[var(--bear)]/40",
  },
  REJECTED: { label: "REJECTED", cls: "bg-secondary/50 text-muted-foreground border-border/50" },
  TRANSITION: {
    label: "TRANSITION",
    cls: "bg-[var(--primary)]/10 text-[var(--primary)]/90 border-[var(--primary)]/30",
  },
  UNSTABLE: { label: "UNSTABLE", cls: "bg-warn/10 text-warn border-warn/30" },
  EXPIRED: { label: "EXPIRED", cls: "bg-secondary/40 text-muted-foreground/80 border-border/40" },
};

export function StateBadge({ state, className }: { state: VerdictState; className?: string }) {
  const s = MAP[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
