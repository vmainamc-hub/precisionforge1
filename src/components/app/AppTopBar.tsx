import { SidebarTrigger } from "@/components/ui/sidebar";
import { useStream } from "@/lib/stream-context";
import { useDerivAccount } from "@/lib/deriv/account-context";
import { Wifi, WifiOff, Radio, Pause, Play, Wallet } from "lucide-react";

export function AppTopBar() {
  const s = useStream();
  const { account, balance, currency, status: derivStatus } = useDerivAccount();
  return (
    <header className="h-14 border-b border-border/40 glass sticky top-0 z-20 flex items-center gap-3 px-4">
      <SidebarTrigger />
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-secondary/40 text-[11px] text-muted-foreground">
        {s.status === "live" ? (
          <Wifi size={12} className="text-[var(--bull)] pulse-dot" />
        ) : s.status === "connecting" ? (
          <Radio size={12} className="text-[var(--accent)] pulse-dot" />
        ) : (
          <WifiOff size={12} className="text-[var(--bear)]" />
        )}
        {s.status.toUpperCase()}
      </div>
      <select
        value={s.symbol}
        onChange={(e) => {
          s.setSymbol(e.target.value);
          s.setRunning(true);
        }}
        className="h-8 px-2 rounded-md bg-secondary/40 border border-border/60 text-[11px] text-foreground focus:outline-none focus:border-[var(--neon)]"
      >
        {s.symbols.map((sym) => (
          <option key={sym.symbol} value={sym.symbol}>
            {sym.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => s.setRunning(!s.running)}
        className="h-8 px-3 rounded-md bg-secondary hover:bg-secondary/70 border border-border/60 text-xs flex items-center gap-1.5"
      >
        {s.running ? (
          <>
            <Pause size={12} /> Pause
          </>
        ) : (
          <>
            <Play size={12} /> Resume
          </>
        )}
      </button>

      <div className="ml-auto flex items-center gap-3">
        {account ? (
          <a
            href="/app/settings"
            className="flex items-center gap-2 h-8 px-3 rounded-md border border-border/60 bg-secondary/30 text-[11px] hover:border-[var(--neon)]/60"
          >
            <Wallet
              size={12}
              className={derivStatus === "open" ? "text-[var(--bull)]" : "text-muted-foreground"}
            />
            <span className="tabular text-foreground">
              {balance !== null ? balance.toFixed(2) : "—"} {currency ?? ""}
            </span>
            <span className="text-muted-foreground">· {account.loginid}</span>
            {account.is_virtual && (
              <span className="text-[9px] text-[var(--accent)] uppercase tracking-widest">
                Demo
              </span>
            )}
          </a>
        ) : (
          <a
            href="/app/settings"
            className="h-8 px-3 rounded-md bg-[var(--neon)]/15 border border-[var(--neon)]/40 text-[var(--neon)] text-[11px] flex items-center gap-1.5 hover:bg-[var(--neon)]/25"
          >
            <Wallet size={12} /> Connect Deriv
          </a>
        )}
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground hidden md:block">
          {s.ticks.length} ticks
        </div>
      </div>
    </header>
  );
}
