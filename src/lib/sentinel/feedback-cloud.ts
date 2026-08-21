// APEX SENTINEL — durable, user-scoped persistence for operator feedback.
//
// The local store stays authoritative and offline-safe; this module mirrors it
// into `sentinel_operator_feedback`, one row per marked trade / written
// observation, keyed by (user_id, kind, item_id). Writes are idempotent
// upserts, so replaying the same record never produces duplicate-key errors.
// It records ONLY what already exists locally: no signal becomes a trade and no
// comment becomes an outcome here.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  mergeRemoteFeedback,
  setFeedbackSink,
  type SignalObservation,
  type TradeRecord,
} from "./trade-feedback";

let userId: string | null = null;
let phase: "LOCAL" | "SYNCED" | "ERROR" = "LOCAL";
let syncError: string | null = null;
/** item key -> serialized payload already stored remotely (push de-dupe). */
const pushed = new Map<string, string>();
let inFlight: Promise<void> | null = null;

export function feedbackSyncStatus() {
  return { phase, error: syncError, durable: !!userId };
}

type Row = { kind: string; item_id: string; payload: Json };

function schedulePush(trades: TradeRecord[], observations: SignalObservation[]) {
  if (!userId) return;
  const rows: { user_id: string; kind: string; item_id: string; payload: Json }[] = [];
  const seen = new Set<string>();
  const add = (kind: "TRADE" | "OBSERVATION", id: string, payload: Json) => {
    const key = `${kind}:${id}`;
    seen.add(key);
    const json = JSON.stringify(payload);
    if (pushed.get(key) === json) return;
    pushed.set(key, json);
    rows.push({ user_id: userId!, kind, item_id: id, payload });
  };
  for (const t of trades) add("TRADE", t.id, t as unknown as Json);
  for (const o of observations) add("OBSERVATION", o.observationId, o as unknown as Json);
  for (const key of [...pushed.keys()]) if (!seen.has(key)) pushed.delete(key);
  if (!rows.length) return;

  const run = async () => {
    const { error } = await supabase
      .from("sentinel_operator_feedback")
      .upsert(rows, { onConflict: "user_id,kind,item_id" });
    if (error) {
      phase = "ERROR";
      syncError = error.message;
      // Allow a retry on the next mutation.
      for (const r of rows) pushed.delete(`${r.kind}:${r.item_id}`);
    } else {
      phase = "SYNCED";
      syncError = null;
    }
  };

  // Serialise writes so bursts of mutations collapse into ordered upserts.
  inFlight = inFlight ? inFlight.then(run).catch(() => {}) : run().catch(() => {});
}

/** Attach durable feedback storage. Safe to call repeatedly. */
export async function startFeedbackSync(): Promise<void> {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getUser();
  userId = data.user?.id ?? null;
  if (!userId) {
    phase = "LOCAL";
    setFeedbackSink(null);
    return;
  }

  const { data: rows, error } = await supabase
    .from("sentinel_operator_feedback")
    .select("kind,item_id,payload")
    .eq("user_id", userId);

  if (error) {
    phase = "ERROR";
    syncError = error.message;
  } else {
    const trades: TradeRecord[] = [];
    const observations: SignalObservation[] = [];
    for (const row of (rows ?? []) as Row[]) {
      if (row.kind === "TRADE") trades.push(row.payload as unknown as TradeRecord);
      else if (row.kind === "OBSERVATION")
        observations.push(row.payload as unknown as SignalObservation);
      pushed.set(`${row.kind}:${row.item_id}`, JSON.stringify(row.payload));
    }
    phase = "SYNCED";
    syncError = null;
    // Attach the sink first so the merge also pushes local-only records up.
    setFeedbackSink(schedulePush);
    mergeRemoteFeedback(trades, observations);
    return;
  }
  setFeedbackSink(schedulePush);
}

export function stopFeedbackSync() {
  setFeedbackSink(null);
  userId = null;
  phase = "LOCAL";
  pushed.clear();
}
