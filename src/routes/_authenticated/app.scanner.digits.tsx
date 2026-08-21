import { createFileRoute } from "@tanstack/react-router";
import { useStream } from "@/lib/stream-context";
import { DigitPercentages } from "@/components/modules/DigitPercentages";
import { EvenOddModule } from "@/components/modules/EvenOddModule";
import { MatchDiffModule } from "@/components/modules/MatchDiffModule";
import { OverUnderModule } from "@/components/modules/OverUnderModule";

export const Route = createFileRoute("/_authenticated/app/scanner/digits")({
  component: DigitsPage,
});

function DigitsPage() {
  const s = useStream();
  return (
    <div className="space-y-4">
      <DigitPercentages ticks={s.ticks} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground uppercase tracking-wider">Over/Under threshold</span>
        <div className="flex gap-1 rounded-md border border-border/60 bg-secondary/40 p-1">
          {[3, 4, 5, 6, 7].map((t) => (
            <button
              key={t}
              onClick={() => s.setThreshold(t)}
              className={`px-2.5 py-1 rounded text-[11px] tabular ${s.threshold === t ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {s.view.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EvenOddModule ticks={s.view} />
          <OverUnderModule ticks={s.view} threshold={s.threshold} />
          <MatchDiffModule ticks={s.view} />
        </div>
      )}
    </div>
  );
}
