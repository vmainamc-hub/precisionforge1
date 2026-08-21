// Runtime-editable bot config store. The settings drawer writes here; the
// scanner reads it every cycle. No engine ever hardcodes a threshold.
import { DEFAULT_BOT_CONFIG, mergeBotConfig, type BotSignalConfig } from "./config";

const KEY = "precision-edge.bot-config.v1";

function load(): BotSignalConfig {
  if (typeof window === "undefined") return DEFAULT_BOT_CONFIG;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BOT_CONFIG;
    return mergeBotConfig(DEFAULT_BOT_CONFIG, JSON.parse(raw) as Partial<BotSignalConfig>);
  } catch {
    return DEFAULT_BOT_CONFIG;
  }
}

let current: BotSignalConfig = load();
const listeners = new Set<(c: BotSignalConfig) => void>();

export function getBotConfig(): BotSignalConfig {
  return current;
}

export function subscribeBotConfig(fn: (c: BotSignalConfig) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function patchBotConfig(patch: Partial<BotSignalConfig>) {
  current = mergeBotConfig(current, patch);
  persist();
  for (const l of listeners) l(current);
}

export function resetBotConfig() {
  current = DEFAULT_BOT_CONFIG;
  persist();
  for (const l of listeners) l(current);
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage is best-effort
  }
}
