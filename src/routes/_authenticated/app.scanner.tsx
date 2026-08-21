import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

const tabs = [
  { title: "Digits", to: "/app/scanner/digits" },
  { title: "Volatility", to: "/app/scanner/volatility" },
];

export const Route = createFileRoute("/_authenticated/app/scanner")({
  head: () => ({ meta: [{ title: "AI Scanner — Precision Edge" }] }),
  component: ScannerLayout,
});

function ScannerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold neon-text">AI Scanner</h1>
        <p className="text-sm text-muted-foreground">
          Multi-market probability engine — Digits, Volatility
        </p>
      </div>
      <div className="flex gap-1 rounded-md border border-border/60 bg-secondary/30 p-1 w-fit">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`px-4 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${pathname.startsWith(t.to) ? "bg-[var(--neon)]/20 text-[var(--neon)]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.title}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
