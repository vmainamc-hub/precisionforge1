// APEX SENTINEL — PROACTIVE ALERT PRESENTATION LAYER.
// Pure presentation of the alert layer's decisions. It renders the engines'
// existing numbers verbatim: nothing here scores, ranks or invents a digit.
import { useState } from "react";
import { AlertTriangle, Bell, BellRing, MessageSquarePlus, Radio, Trash2, X } from "lucide-react";
import type { RankedOpportunity } from "@/lib/apex/types";
import type { AlertEpisode, AlertEvent } from "@/lib/sentinel/opportunity-alert";
import { isExpired, qualify } from "@/lib/sentinel/opportunity-alert";
import type { OpportunityAlertsState } from "@/hooks/useOpportunityAlerts";
import TradeFeedback from "@/components/apex/TradeFeedback";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

/**
 * CANONICAL ALERT BANNER — the attention layer attached to the #1 opportunity.
 *
 * It never selects its own candidate: it renders the alert state of the exact
 * RankedOpportunity that is already ranked #1. Qualification, thresholds and
 * every number come from the existing engines verbatim.
 */
export function CanonicalAlertBanner({
  item,
  alerts,
  stale,
}: {
  item: RankedOpportunity;
  alerts: OpportunityAlertsState;
  /** A prior alert can no longer be presented as actionable. */
  stale?: boolean;
}) {
  const key = `${item.symbol}|${item.contract.id}`;
  const q = qualify(item, alerts.config);
  const episodeMatches = !!alerts.episode && alerts.episode.key === key;
  const expired =
    episodeMatches && (isExpired(alerts.episode) || alerts.episode!.status !== "ACTIVE");
  // Actionable only when the canonical #1 itself satisfies the alert criteria.
  if (!q.ok) {
    if (!stale) return null;
    return (
      <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--warn)" }}>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--warn)]">
          ⚠ ALERT EXPIRED / SIGNAL CHANGED
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          The previously alerted candidate is no longer actionable. The card below shows the current
          best opportunity, which has not triggered an alert.
        </p>
      </div>
    );
  }
  const s = q.snapshot;
  const color = expired ? "var(--warn)" : "var(--bull)";
  return (
    <div
      className="mt-4 rounded-lg border p-4"
      style={{ borderColor: color, background: "color-mix(in oklab, var(--bull) 8%, transparent)" }}
    >
      <div className="flex items-start gap-3">
        <BellRing size={18} style={{ color }} />
        <div className="min-w-0">
          <p
            className="font-mono text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color }}
          >
            {expired ? "⚠ ALERT WINDOW EXPIRED" : "🚨 HIGH-QUALITY OPPORTUNITY DETECTED"}
            {alerts.latest && alerts.latest.snapshot.key === key
              ? ` · ${alerts.latest.kind} · ${fmtTime(alerts.latest.ts)}`
              : ""}
          </p>
          <p className="mt-1 font-display text-2xl font-bold">
            {s.symbol} <span className="text-muted-foreground">·</span> {s.contractLabel}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Row label="Market" value={`${s.symbol} · ${s.name}`} />
            <Row label="Contract" value={s.contractLabel} />
            <Row
              label="Wait for digit"
              value={s.entryDigit === null ? "—" : String(s.entryDigit)}
              color="var(--neon)"
            />
            <Row label="Entry confidence" value={`${s.confidence}/100`} />
            <Row label="Opportunity" value={`${s.score}/100`} />
            <Row label="Persistence" value={String(s.persistence)} />
            <Row label="Stability" value={String(s.stability)} />
            <Row label="Execution survival" value={s.survivalLabel} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Execution survival: {s.survivalLabel} — {s.survivalDetail}
          </p>
          <p className="mt-1 font-mono text-[11px]" style={{ color }}>
            VALIDITY: {s.windowLabel}
          </p>
          <div className="mt-3 rounded-md border p-3" style={{ borderColor: "var(--neon)" }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Execution instruction · {s.instructionState}
            </p>
            <p className="mt-1 font-display text-sm font-bold text-[var(--neon)]">
              {s.instructionHeadline}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.instructionDetail}</p>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            This is the same candidate shown as BEST CURRENT OPPORTUNITY — one canonical signal.
          </p>
        </div>
      </div>
    </div>
  );
}

/** The full alert card, per the operator specification. */
export function OpportunityAlertCard({
  alerts,
  ranked,
}: {
  alerts: OpportunityAlertsState;
  ranked: RankedOpportunity[];
}) {
  const ep: AlertEpisode | null = alerts.episode;
  if (!ep) {
    return (
      <section className="glass rounded-xl border border-border/50 p-6 text-center">
        <Radio className="mx-auto mb-2 text-muted-foreground" />
        <h3 className="font-display text-sm font-semibold">
          MONITORING FOR A QUALIFYING OPPORTUNITY
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-xs text-muted-foreground">
          Sentinel keeps watching every market continuously. You will hear an alert when an
          opportunity clears {alerts.config.minScore}/100 with a validated entry digit and no hard
          invalidation. Manual SCAN remains available at any time.
        </p>
      </section>
    );
  }

  const s = ep.snapshot;
  const expired = isExpired(ep) || ep.status !== "ACTIVE";
  const live = ranked.find((o) => `${o.symbol}|${o.contract.id}` === ep.key) ?? null;
  const liveQ = live ? qualify(live, alerts.config) : null;

  return (
    <section
      className="glass rounded-xl border p-5"
      style={{ borderColor: expired ? "var(--warn)" : "var(--bull)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          className="font-display text-sm font-bold tracking-[0.18em]"
          style={{ color: expired ? "var(--warn)" : "var(--bull)" }}
        >
          🚨 HIGH-QUALITY OPPORTUNITY
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {expired ? (ep.closeReason ?? "EXPIRED") : "ACTIVE EPISODE"} · opened{" "}
          {fmtTime(ep.openedAt)} · {ep.alerts} alert{ep.alerts === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Row label="Market" value={`${s.symbol} · ${s.name}`} />
        <Row label="Contract" value={s.contractLabel} />
        <Row
          label="Entry digit"
          value={s.entryDigit === null ? "NOT QUALIFIED" : String(s.entryDigit)}
          color="var(--neon)"
        />
        <Row label="Entry confidence" value={`${s.confidence}/100`} />
        <Row label="Opportunity" value={`${s.score}/100`} color="var(--bull)" />
        <Row label="Relative edge" value={s.relativeEdge} />
        <Row label="Persistence" value={`${s.persistence}/100`} />
        <Row label="Stability" value={`${s.stability}/100`} />
        <Row label="Engine agreement" value={s.agreement} />
        <Row
          label="Danger"
          value={`${s.danger}/100`}
          color={s.danger >= 60 ? "var(--bear)" : s.danger >= 40 ? "var(--warn)" : "var(--bull)"}
        />
        <Row
          label="Validity"
          value={expired ? "EXPIRED" : s.windowLabel}
          color={expired ? "var(--warn)" : undefined}
        />
        <Row label="Signal state" value={s.stateLabel} />
        <Row
          label="Execution survival"
          value={s.survivalLabel}
          color={
            s.survivalLabel === "FRAGILE"
              ? "var(--bear)"
              : s.survivalLabel === "STRONG"
                ? "var(--bull)"
                : "var(--warn)"
          }
        />
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted-foreground">
        Window basis: {s.windowBasis} · entry status {s.entryStatus} · clearance {s.clearance}
      </p>
      <div className="mt-3 rounded-md border p-3" style={{ borderColor: "var(--neon)" }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          Execution instruction · {(liveQ?.snapshot ?? s).instructionState}
        </p>
        <p className="mt-1 font-display text-sm font-bold text-[var(--neon)]">
          {(liveQ?.snapshot ?? s).instructionHeadline}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {(liveQ?.snapshot ?? s).instructionDetail}
        </p>
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        Level 2 · {s.survivalSequences} observed post-entry sequence(s): {s.survivalDetail}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Why alerted
          </p>
          <ul className="mt-1 space-y-1 text-xs">
            {(liveQ?.snapshot.reasons ?? s.reasons).map((r) => (
              <li key={r} className="text-foreground">
                + {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--warn)]">
            Caution
          </p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {(liveQ?.snapshot.cautions ?? s.cautions).map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
          {liveQ && !liveQ.ok ? (
            <p className="mt-2 flex items-start gap-1 font-mono text-[10px] text-[var(--warn)]">
              <AlertTriangle size={12} className="mt-[1px]" />
              No longer qualifying: {liveQ.failures.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {live ? (
        <div className="mt-4 border-t border-border/50 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            If you trade this alert
          </p>
          <TradeFeedback item={live} />
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-muted-foreground">
          This alerted market is not in the current ranked field, so no trade can be attached to it.
          The alert stays in history as an observation only.
        </p>
      )}
    </section>
  );
}

/** Configuration — the operator is never locked to 70. */
export function AlertSettingsPanel({ alerts }: { alerts: OpportunityAlertsState }) {
  const { config, setConfig } = alerts;
  return (
    <section className="glass rounded-xl border border-border/50 p-5">
      <div className="flex items-center gap-2">
        <Bell size={15} className="text-[var(--neon)]" />
        <h3 className="font-display text-sm font-semibold tracking-[0.14em]">
          ALERT CONFIGURATION
        </h3>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ToggleRow
          label="Proactive monitoring"
          hint="Continuously watch the ranked field and alert on qualifying opportunities."
          checked={config.enabled}
          onChange={(v) => setConfig({ enabled: v })}
        />
        <ToggleRow
          label="Sound alerts"
          hint="Short attention tone on a new or materially changed opportunity."
          checked={config.sound}
          onChange={(v) => setConfig({ sound: v })}
        />
        <ToggleRow
          label="Browser notifications"
          hint={
            alerts.permission === "granted"
              ? "Permission granted."
              : alerts.permission === "unsupported"
                ? "This browser does not support notifications; the in-app banner is used."
                : "Permission required — the in-app banner is always shown as a fallback."
          }
          checked={config.notifications}
          onChange={(v) => {
            setConfig({ notifications: v });
            if (v && alerts.permission === "default") alerts.requestPermission();
          }}
        />
        <ToggleRow
          label="Require validated entry digit"
          hint="Without a qualified entry digit no actionable alert is issued."
          checked={config.requireEntryDigit}
          onChange={(v) => setConfig({ requireEntryDigit: v })}
        />
        <NumberRow
          label="Opportunity threshold"
          value={config.minScore}
          min={50}
          max={95}
          onChange={(n) => setConfig({ minScore: n })}
        />
        <NumberRow
          label="Min entry confidence"
          value={config.minConfidence}
          min={0}
          max={95}
          onChange={(n) => setConfig({ minConfidence: n })}
        />
        <NumberRow
          label="Min persistence"
          value={config.minPersistence}
          min={0}
          max={95}
          onChange={(n) => setConfig({ minPersistence: n })}
        />
        <NumberRow
          label="Min stability"
          value={config.minStability}
          min={0}
          max={95}
          onChange={(n) => setConfig({ minStability: n })}
        />
        <NumberRow
          label="Alert cooldown (seconds)"
          value={Math.round(config.cooldownMs / 1000)}
          min={5}
          max={600}
          onChange={(n) => setConfig({ cooldownMs: n * 1000 })}
        />
        <NumberRow
          label="Material score change (points)"
          value={config.materialScoreDelta}
          min={1}
          max={30}
          onChange={(n) => setConfig({ materialScoreDelta: n })}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" className="text-[11px]" onClick={alerts.resetConfig}>
          Reset to defaults
        </Button>
        {alerts.permission === "default" ? (
          <Button size="sm" className="text-[11px]" onClick={alerts.requestPermission}>
            Allow browser notifications
          </Button>
        ) : null}
        <p className="text-[10px] text-muted-foreground">
          Alerts never change scoring, ranking or entry selection. They only decide when to
          interrupt you.
        </p>
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <Input
        type="number"
        className="h-8 w-24 font-mono text-xs"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
      />
    </div>
  );
}

/** Lightweight alert history — observations, never trade outcomes. */
export function AlertHistoryPanel({ alerts }: { alerts: OpportunityAlertsState }) {
  const rows: AlertEvent[] = alerts.history;
  return (
    <section className="glass rounded-xl border border-border/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-[0.14em]">ALERT HISTORY</h3>
        {rows.length ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-[11px]"
            onClick={alerts.clearHistory}
          >
            <Trash2 size={13} /> Clear
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        An alert is an observation. Only trades you confirm become outcomes that Sentinel learns
        from.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No alerts recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="py-1 pr-3">Time</th>
                <th className="py-1 pr-3">Kind</th>
                <th className="py-1 pr-3">Market</th>
                <th className="py-1 pr-3">Contract</th>
                <th className="py-1 pr-3">Entry</th>
                <th className="py-1 pr-3">Opp</th>
                <th className="py-1 pr-3">Conf</th>
                <th className="py-1 pr-3">Rel. edge</th>
                <th className="py-1 pr-3">Danger</th>
                <th className="py-1 pr-3">Pers</th>
                <th className="py-1 pr-3">Stab</th>
                <th className="py-1">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="py-1 pr-3">{fmtTime(r.ts)}</td>
                  <td className="py-1 pr-3">{r.kind}</td>
                  <td className="py-1 pr-3">{r.snapshot.symbol}</td>
                  <td className="py-1 pr-3">{r.snapshot.contractLabel}</td>
                  <td className="py-1 pr-3">{r.snapshot.entryDigit ?? "—"}</td>
                  <td className="py-1 pr-3">{r.snapshot.score}</td>
                  <td className="py-1 pr-3">{r.snapshot.confidence}</td>
                  <td className="py-1 pr-3">{r.snapshot.relativeEdge}</td>
                  <td className="py-1 pr-3">{r.snapshot.danger}</td>
                  <td className="py-1 pr-3">{r.snapshot.persistence}</td>
                  <td className="py-1 pr-3">{r.snapshot.stability}</td>
                  <td className="py-1 text-muted-foreground">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
