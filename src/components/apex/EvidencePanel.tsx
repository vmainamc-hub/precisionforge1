import type { Evidence } from "@/lib/apex/types";

export function EvidenceList({
  items,
  tone,
  empty,
}: {
  items: Evidence[];
  tone: "support" | "conflict";
  empty: string;
}) {
  if (!items.length) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  const color = tone === "support" ? "var(--bull)" : "var(--bear)";
  return (
    <ul className="space-y-2.5">
      {items.map((e, i) => (
        <li key={`${e.engine}-${i}`} className="flex gap-3">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-foreground">{e.label}</span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {e.engine}
                {e.n > 0 ? ` · n=${e.n}` : ""}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{e.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/80">
        {children}
      </h3>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
