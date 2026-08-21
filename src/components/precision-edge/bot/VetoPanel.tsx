// VETO PANEL — every blocking condition, always visible, never hidden.
import type { Veto } from "@/lib/precision-edge/bot/veto";
import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export function VetoPanel({ vetoes }: { vetoes: Veto[] }) {
  const active = vetoes.filter((v) => v.severity === "BLOCK");
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <header className="flex items-center gap-2">
        {active.length ? (
          <ShieldAlert className="h-4 w-4 text-red-400" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
        )}
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Veto Stack{" "}
          {active.length
            ? `· ${active.length} blocking`
            : vetoes.length
              ? `· ${vetoes.length} warning${vetoes.length > 1 ? "s" : ""}`
              : "· all clear"}
        </h2>
      </header>
      <ul className="mt-3 space-y-1.5">
        {vetoes.map((v) => (
          <li
            key={v.id}
            className={cn(
              "flex items-start justify-between gap-3 rounded-md border px-2.5 py-1.5 text-xs",
              v.severity === "BLOCK"
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300",
            )}
          >
            <span>
              <span className="font-medium">{v.title}</span>
              <span className="block opacity-80">{v.detail}</span>
            </span>
            <span className="shrink-0 font-mono">{v.severity}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
