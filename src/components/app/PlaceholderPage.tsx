import { Construction } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase?: string;
}) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="glass rounded-lg p-10 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--neon)]/15 border border-[var(--neon)]/40">
          <Construction size={24} className="text-[var(--neon)]" />
        </div>
        <h1 className="text-2xl font-bold neon-text">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">{description}</p>
        {phase && (
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--accent)]">
            Ships in {phase}
          </p>
        )}
      </div>
    </div>
  );
}
