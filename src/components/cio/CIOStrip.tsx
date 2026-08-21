// §60 CIO — slim "house pick" strip.
//
// Reads Edge + Parity outputs from the current session via lightweight hooks
// (or accepts direct props). Renders one line per market with the house pick.
// Behind `DEFAULT_FEATURE_FLAGS.cio` — parent decides whether to mount.

import { useMemo } from "react";
import {
  arbitrateHousePicks,
  houseTopPick,
  type CIOEdgeInput,
  type CIOParityInput,
} from "@/lib/cio";
import { cn } from "@/lib/utils";

export interface CIOStripProps {
  edges?: CIOEdgeInput[];
  parities?: CIOParityInput[];
  className?: string;
}

export function CIOStrip({ edges = [], parities = [], className }: CIOStripProps) {
  const picks = useMemo(() => arbitrateHousePicks(edges, parities), [edges, parities]);
  const top = useMemo(() => houseTopPick(picks), [picks]);

  if (!top && picks.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs",
        className,
      )}
      aria-label="Chief Investment Office house pick"
    >
      <span className="font-semibold uppercase tracking-wide text-primary">CIO</span>
      {top ? (
        <>
          <span className="font-medium">{top.market}</span>
          <span className="opacity-70">·</span>
          <span>
            {top.source === "abstain"
              ? "Abstain (contradiction)"
              : `${top.label} @ ${top.confidence.toFixed(0)}%`}
          </span>
          <span className="opacity-70">·</span>
          <span className="text-muted-foreground">{top.reason}</span>
          {top.runnerUp && (
            <span className="ml-auto text-muted-foreground">
              runner-up: {top.runnerUp.source} {top.runnerUp.label} @{" "}
              {top.runnerUp.confidence.toFixed(0)}%
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">No house pick.</span>
      )}
    </div>
  );
}
