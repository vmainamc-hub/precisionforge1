// APEX SENTINEL — CONTINUOUS OPPORTUNITY MONITORING (alert layer binding).
//
// This hook does NOT scan and does NOT score. It observes the ranked field the
// existing engines already maintain and lets the alert reducer decide when the
// operator should be interrupted. Manual SCAN remains untouched.
import { useCallback, useEffect, useRef, useState } from "react";
import type { RankedOpportunity } from "@/lib/apex/types";
import {
  DEFAULT_ALERT_CONFIG,
  EMPTY_ALERT_STATE,
  loadAlertConfig,
  loadAlertHistory,
  reduceAlerts,
  saveAlertConfig,
  saveAlertHistory,
  type AlertConfig,
  type AlertEpisode,
  type AlertEvent,
  type AlertState,
} from "@/lib/sentinel/opportunity-alert";
import { useAlertSound } from "@/hooks/useAlertSound";

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

function permissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

function notify(ev: AlertEvent) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const s = ev.snapshot;
  try {
    new Notification("🚨 HIGH-QUALITY OPPORTUNITY DETECTED", {
      body:
        `${s.symbol} · ${s.contractLabel}\n` +
        `Entry: ${s.entryDigit ?? "—"} · Opportunity: ${s.score} · Entry confidence: ${s.confidence}\n` +
        `Valid for: ${s.windowLabel}`,
      tag: `apex-alert-${s.key}`,
    });
  } catch {
    /* notifications unavailable — the in-app banner still shows */
  }
}

export interface OpportunityAlertsState {
  config: AlertConfig;
  setConfig: (patch: Partial<AlertConfig>) => void;
  resetConfig: () => void;
  episode: AlertEpisode | null;
  history: AlertEvent[];
  latest: AlertEvent | null;
  /** Dismiss the banner for the current alert (episode tracking continues). */
  dismiss: () => void;
  dismissed: boolean;
  permission: NotificationPermissionState;
  requestPermission: () => void;
  clearHistory: () => void;
}

export function useOpportunityAlerts(ranked: RankedOpportunity[]): OpportunityAlertsState {
  const [config, setConfigState] = useState<AlertConfig>(DEFAULT_ALERT_CONFIG);
  const [state, setState] = useState<AlertState>(EMPTY_ALERT_STATE);
  const [latest, setLatest] = useState<AlertEvent | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Hydrate persisted config + history on the client only.
  useEffect(() => {
    const cfg = loadAlertConfig();
    setConfigState(cfg);
    const history = loadAlertHistory();
    if (history.length) setState((s) => ({ ...s, history }));
    setPermission(permissionState());
  }, []);

  // Observe every ranked-field refresh. The reducer stays silent unless a new
  // episode opens or a material change occurs.
  useEffect(() => {
    if (!ranked.length) return;
    const { state: next, fired } = reduceAlerts(
      stateRef.current,
      ranked,
      cfgRef.current,
      Date.now(),
    );
    setState(next);
    if (fired.length) {
      setLatest(fired[0]);
      setDismissedId(null);
      if (cfgRef.current.notifications) notify(fired[0]);
      saveAlertHistory(next.history);
    }
  }, [ranked]);

  // Sound fires only on a genuinely new alert event id.
  useAlertSound(latest ? `alert:${latest.id}` : "", config.sound);

  const setConfig = useCallback((patch: Partial<AlertConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      saveAlertConfig(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_ALERT_CONFIG);
    saveAlertConfig(DEFAULT_ALERT_CONFIG);
  }, []);

  const requestPermission = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    void Notification.requestPermission().then((p) =>
      setPermission(p as NotificationPermissionState),
    );
  }, []);

  const clearHistory = useCallback(() => {
    setState((s) => ({ ...s, history: [] }));
    saveAlertHistory([]);
  }, []);

  return {
    config,
    setConfig,
    resetConfig,
    episode: state.episode,
    history: state.history,
    latest,
    dismiss: () => setDismissedId(latest?.id ?? null),
    dismissed: !!latest && dismissedId === latest.id,
    permission,
    requestPermission,
    clearHistory,
  };
}
