// In-memory historical logger. Ring buffer per market. Designed so a Supabase
// (or file) persistence adapter can plug in later without touching the engine.
import type { EngineOutput, HistoricalRecord } from "./types";

type Sink = (rec: HistoricalRecord) => void;

const buffers = new Map<string, HistoricalRecord[]>();
const sinks: Sink[] = [];

export function addHistoricalSink(sink: Sink) {
  sinks.push(sink);
}
export function clearHistoricalSinks() {
  sinks.length = 0;
}

export function logOutput(output: EngineOutput, maxSize: number) {
  const rec: HistoricalRecord = {
    timestamp: output.timestamp,
    market: output.market,
    trade: output.recommended?.candidate ?? null,
    engines: output.engineContributions,
    edgeScore: output.edgeScore,
    recommendation: output.recommended?.candidate.label ?? "No High Quality Setup",
    state: output.state,
    features: {
      entropy: output.featureContributions.entropy,
      greenPct: output.featureContributions.greenPct,
      zoneA: output.featureContributions.zoneA,
    },
    outcome: null,
  };
  const list = buffers.get(output.market) ?? [];
  list.push(rec);
  while (list.length > maxSize) list.shift();
  buffers.set(output.market, list);
  for (const s of sinks) {
    try {
      s(rec);
    } catch {
      /* ignore */
    }
  }
}

export function getHistory(market: string): HistoricalRecord[] {
  return buffers.get(market)?.slice() ?? [];
}

export function recordOutcome(market: string, timestamp: number, outcome: "win" | "loss") {
  const list = buffers.get(market);
  if (!list) return;
  const rec = list.find((r) => r.timestamp === timestamp);
  if (rec) rec.outcome = outcome;
}
