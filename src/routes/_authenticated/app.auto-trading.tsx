import { createFileRoute } from "@tanstack/react-router";
import { useAutoTrader } from "@/lib/deriv/auto-trader";
import { useDerivAccount } from "@/lib/deriv/account-context";
import {
  Bot,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Radar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/auto-trading")({
  head: () => ({ meta: [{ title: "Auto Trading — Precision Edge" }] }),
  component: AutoTradingPage,
});

function AutoTradingPage() {
  const {
    settings,
    updateSettings,
    save,
    logs,
    running,
    dailyPL,
    consecutiveLosses,
    haltReason,
    clearLogs,
  } = useAutoTrader();
  const { account, status, balance, currency } = useDerivAccount();

  const src = settings.sources;

  async function toggleEnabled() {
    await updateSettings({ enabled: !settings.enabled });
    // save immediately on toggle
    setTimeout(save, 50);
  }

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot size={22} className="text-[var(--neon)]" /> Auto Trading
          </h1>
          <p className="text-sm text-muted-foreground">
            Automatically fire trades on every high-confidence signal from the live feed.
          </p>
        </div>
        <button
          onClick={toggleEnabled}
          className={`px-5 py-2.5 rounded-md font-semibold text-sm flex items-center gap-2 ${settings.enabled ? "bg-[var(--bear)]/25 text-[var(--bear)] border border-[var(--bear)]/40" : "bg-[var(--bull)]/25 text-[var(--bull)] border border-[var(--bull)]/40"}`}
        >
          {settings.enabled ? (
            <>
              <Pause size={14} /> Stop auto-trader
            </>
          ) : (
            <>
              <Play size={14} /> Start auto-trader
            </>
          )}
        </button>
      </div>

      {/* Status band */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric
          label="Engine"
          value={running ? "RUNNING" : settings.enabled ? "STANDBY" : "OFF"}
          tone={running ? "bull" : haltReason ? "bear" : undefined}
        />
        <Metric
          label="Account"
          value={account?.loginid ?? "—"}
          hint={account?.is_virtual ? "Demo" : account ? "Real" : ""}
        />
        <Metric label="Balance" value={`${balance?.toFixed(2) ?? "—"} ${currency ?? ""}`} />
        <Metric
          label="Today P/L (auto)"
          value={`${dailyPL >= 0 ? "+" : ""}${dailyPL.toFixed(2)}`}
          tone={dailyPL >= 0 ? "bull" : "bear"}
        />
        <Metric
          label="Consec. losses"
          value={String(consecutiveLosses)}
          tone={consecutiveLosses >= settings.max_consecutive_losses ? "bear" : undefined}
        />
      </div>

      {haltReason && (
        <div className="glass rounded-lg p-3 border border-[var(--bear)]/40 text-sm flex items-start gap-2 text-[var(--bear)]">
          <AlertTriangle size={16} />{" "}
          <div>
            <b>Auto-trader halted:</b> {haltReason}
          </div>
        </div>
      )}
      {!account && (
        <div className="glass rounded-lg p-3 border border-[var(--warn)]/40 text-sm flex items-start gap-2 text-[var(--warn)]">
          <AlertTriangle size={16} /> Connect your Deriv account in{" "}
          <a href="/app/settings" className="underline">
            Settings
          </a>{" "}
          to enable auto-trading.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config */}
        <div className="glass rounded-xl p-5 space-y-4 lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Signal sources</h2>
          <div className="space-y-2 text-sm">
            <Toggle
              label="Under 7 · Multi-Market"
              checked={src.under7}
              onChange={(v) => updateSettings({ sources: { ...src, under7: v } })}
            />
            <Toggle
              label="Over 2 · Multi-Market"
              checked={src.over2}
              onChange={(v) => updateSettings({ sources: { ...src, over2: v } })}
            />
            <Toggle
              label="Advanced Under 7"
              checked={src.advUnder7}
              onChange={(v) => updateSettings({ sources: { ...src, advUnder7: v } })}
            />
            <Toggle
              label="Advanced Over 2"
              checked={src.advOver2}
              onChange={(v) => updateSettings({ sources: { ...src, advOver2: v } })}
            />
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-widest pt-2">Trade params</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Stake">
              <input
                type="number"
                min={0.35}
                step={0.01}
                value={settings.stake}
                onChange={(e) => updateSettings({ stake: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Duration (ticks)">
              <input
                type="number"
                min={1}
                max={10}
                value={settings.duration_ticks}
                onChange={(e) => updateSettings({ duration_ticks: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Min confidence %">
              <input
                type="number"
                min={50}
                max={100}
                value={settings.min_confidence}
                onChange={(e) => updateSettings({ min_confidence: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Max consec. losses">
              <input
                type="number"
                min={1}
                value={settings.max_consecutive_losses}
                onChange={(e) => updateSettings({ max_consecutive_losses: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Daily loss cap">
              <input
                type="number"
                step={0.01}
                value={settings.max_daily_loss ?? ""}
                onChange={(e) =>
                  updateSettings({
                    max_daily_loss: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="tk-input"
                placeholder="unset"
              />
            </Field>
            <Field label="Take profit">
              <input
                type="number"
                step={0.01}
                value={settings.take_profit ?? ""}
                onChange={(e) =>
                  updateSettings({
                    take_profit: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="tk-input"
                placeholder="unset"
              />
            </Field>
            <Field label="Stop loss">
              <input
                type="number"
                step={0.01}
                value={settings.stop_loss ?? ""}
                onChange={(e) =>
                  updateSettings({
                    stop_loss: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="tk-input"
                placeholder="unset"
              />
            </Field>
          </div>
          <Toggle
            label="Only run on Demo accounts"
            checked={settings.demo_only}
            onChange={(v) => updateSettings({ demo_only: v })}
          />
          <button
            onClick={save}
            className="w-full h-10 rounded-md bg-secondary hover:bg-secondary/70 text-sm"
          >
            Save configuration
          </button>
        </div>

        {/* Activity log */}
        <div className="glass rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2">
              <Radar size={14} className={running ? "pulse-dot text-[var(--neon)]" : ""} /> Activity
              log
            </h2>
            <button
              onClick={clearLogs}
              className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Trash2 size={11} /> clear
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              {running
                ? "Waiting for signals…"
                : "Enable the auto-trader to start firing trades on live signals."}
            </div>
          ) : (
            <div className="text-xs">
              <div className="grid grid-cols-[80px_100px_60px_100px_60px_60px_60px_1fr_100px] gap-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                <div>Time</div>
                <div>Source</div>
                <div>Symbol</div>
                <div>Type</div>
                <div>Bar</div>
                <div>Stake</div>
                <div>Dur</div>
                <div>Message</div>
                <div className="text-right">Status</div>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="grid grid-cols-[80px_100px_60px_100px_60px_60px_60px_1fr_100px] gap-2 py-1.5 items-center border-b border-border/10 tabular"
                  >
                    <div className="text-muted-foreground">
                      {new Date(l.ts).toLocaleTimeString()}
                    </div>
                    <div>{l.source}</div>
                    <div>{l.symbol}</div>
                    <div>{l.contract_type}</div>
                    <div>{l.barrier ?? "—"}</div>
                    <div>{l.stake}</div>
                    <div>{l.duration}t</div>
                    <div className="truncate text-muted-foreground">
                      {l.message}
                      {l.profit !== undefined ? ` · P/L ${l.profit.toFixed(2)}` : ""}
                    </div>
                    <div className="text-right">
                      <StatusBadge s={l.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-lg p-3 text-[11px] text-muted-foreground flex items-start gap-2">
        <AlertTriangle size={12} className="mt-0.5 text-[var(--warn)]" />
        Auto-trading places real orders on your active Deriv account. Start with Demo, small stakes,
        and short sessions. Every fired signal is written to your trade history and closed contracts
        are reconciled automatically.
      </div>

      <style>{`.tk-input{height:34px;width:100%;padding:0 10px;border-radius:6px;background:hsl(var(--secondary)/.4);border:1px solid hsl(var(--border));color:inherit;font-size:13px}`}</style>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
  hint?: string;
}) {
  const color =
    tone === "bull"
      ? "text-[var(--bull)]"
      : tone === "bear"
        ? "text-[var(--bear)]"
        : "text-foreground";
  return (
    <div className="glass rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`tabular text-lg font-semibold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition ${checked ? "bg-[var(--neon)]" : "bg-secondary"}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-background transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
function StatusBadge({ s }: { s: string }) {
  if (s === "won")
    return (
      <span className="text-[var(--bull)] flex items-center justify-end gap-1">
        <CheckCircle2 size={11} />
        won
      </span>
    );
  if (s === "lost")
    return (
      <span className="text-[var(--bear)] flex items-center justify-end gap-1">
        <XCircle size={11} />
        lost
      </span>
    );
  if (s === "error") return <span className="text-[var(--bear)]">error</span>;
  if (s === "bought") return <span className="text-[var(--neon)]">open</span>;
  if (s === "sent") return <span className="text-muted-foreground">sending…</span>;
  return <span className="text-muted-foreground">{s}</span>;
}
