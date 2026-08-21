// Shared Deriv WebSocket multiplexer.
// One WebSocket connection is opened for the entire app. Every hook that
// needs live ticks subscribes through this bus, so we get:
//   * ONE connection instead of 6-8 concurrent ones
//   * ONE tick history request per symbol instead of duplicated requests
//   * A single shared in-memory tick buffer per symbol
//   * Automatic reconnection with exponential backoff
//   * Consistent status reporting across hooks
//
// This bus uses Deriv's live `ticks` subscription (anonymous, allowed for
// public volatility indices). A short poll fallback kicks in only if we go
// silent for too long (dead-socket detector).
import type { Tick } from "@/lib/analytics";

import { DERIV_WS_URL } from "@/lib/deriv-ws";

const WS_URL = DERIV_WS_URL;
const MAX_BUFFER = 1000;
const HISTORY_COUNT = 1000; // canonical standard window — one request fills it exactly
const STALE_TICK_MS = 4_000; // if no tick for a subscribed symbol in this time, force a catch-up poll
const CATCHUP_COUNT = 20;

export type BusStatus = "idle" | "connecting" | "live" | "error";
type TickListener = (symbol: string, tick: Tick) => void;
type HistoryListener = (symbol: string, ticks: Tick[]) => void;
type StatusListener = (s: BusStatus) => void;

class DerivTickBus {
  private ws: WebSocket | null = null;
  private status: BusStatus = "idle";
  private refcount = new Map<string, number>();
  private buffers = new Map<string, Tick[]>();
  // Incremental last-digit buffer, kept in lockstep with `buffers`.
  // Every scanner used to recompute `ticks.map(t => lastDigit(t.price))` —
  // often several times per contract, per symbol, per frame. Maintaining it
  // once here turns that O(n) work into O(1) per tick.
  private digitBuffers = new Map<string, number[]>();
  private subIds = new Map<string, string>(); // symbol -> live subscription id
  private lastEpoch = new Map<string, number>(); // symbol -> last tick epoch (seconds)
  private lastMessageAt = 0;
  private tickListeners = new Set<TickListener>();
  private historyListeners = new Set<HistoryListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;

  private envHooked = false;
  private wakeLock: any = null;

  getStatus() {
    return this.status;
  }

  getTicks(sym: string): Tick[] {
    return this.buffers.get(sym) ?? [];
  }

  /** Rolling last-digit array for a symbol, aligned 1:1 with getTicks(). */
  getDigits(sym: string): number[] {
    return this.digitBuffers.get(sym) ?? [];
  }

  // Deriv quotes have different decimal precision per symbol (pip size).
  // The last *digit* of a contract is the final decimal of the quote at that
  // precision — using a fixed 2 decimals produced garbage digits (and fake
  // 100% win rates) on symbols like 1HZ250V. pip_size arrives with both the
  // history and tick payloads; default to 2 until we have it.
  private pipSize = new Map<string, number>();

  private digitOf(sym: string, price: number): number {
    const pip = this.pipSize.get(sym) ?? 2;
    return Math.abs(Math.round(price * Math.pow(10, pip))) % 10;
  }

  /** Record pip size; rebuild the digit buffer when the precision changes. */
  private setPip(sym: string, pip: number) {
    if (!Number.isFinite(pip) || this.pipSize.get(sym) === pip) return;
    this.pipSize.set(sym, pip);
    const buf = this.buffers.get(sym);
    if (buf && buf.length) this.setBuffer(sym, buf);
  }

  getPipSize(sym: string): number {
    return this.pipSize.get(sym) ?? 2;
  }

  private setBuffer(sym: string, ticks: Tick[]) {
    this.buffers.set(sym, ticks);
    const digits = new Array<number>(ticks.length);
    for (let i = 0; i < ticks.length; i++) digits[i] = this.digitOf(sym, ticks[i].price);
    this.digitBuffers.set(sym, digits);
  }

  private pushDigit(sym: string, tick: Tick, max: number) {
    const d = this.digitBuffers.get(sym) ?? [];
    d.push(this.digitOf(sym, tick.price));
    if (d.length > max) d.splice(0, d.length - max);
    this.digitBuffers.set(sym, d);
  }

  onTick(cb: TickListener): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  onHistory(cb: HistoryListener): () => void {
    this.historyListeners.add(cb);
    // Replay any histories we already have so late subscribers catch up.
    for (const [sym, ticks] of this.buffers.entries()) cb(sym, ticks);
    return () => this.historyListeners.delete(cb);
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  /** Subscribe to a set of symbols. Returns an unsubscribe fn. */
  subscribe(symbols: string[]): () => void {
    const unique = Array.from(new Set(symbols));
    for (const s of unique) {
      const c = (this.refcount.get(s) ?? 0) + 1;
      this.refcount.set(s, c);
      if (c === 1 && this.ws?.readyState === WebSocket.OPEN) {
        this.sendHistoryRequest(s);
        this.sendSubscribeRequest(s);
      }
      const existing = this.buffers.get(s);
      if (existing && existing.length) {
        queueMicrotask(() => {
          this.historyListeners.forEach((l) => l(s, existing));
        });
      }
    }
    this.ensureConnection();
    this.hookEnv();

    return () => {
      for (const s of unique) {
        const c = (this.refcount.get(s) ?? 1) - 1;
        if (c <= 0) {
          this.refcount.delete(s);
          this.forgetSymbol(s);
        } else {
          this.refcount.set(s, c);
        }
      }
    };
  }

  private setStatus(s: BusStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  private ensureConnection() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.connect();
  }

  private connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      this.setStatus("error");
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.setStatus("live");
      this.reconnectDelay = 1000;
      this.subIds.clear();
      this.lastMessageAt = Date.now();
      for (const sym of this.refcount.keys()) {
        this.sendHistoryRequest(sym);
        this.sendSubscribeRequest(sym);
      }
      this.startPing();
      this.startWatchdog();
    };

    ws.onmessage = (ev) => {
      this.lastMessageAt = Date.now();
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.pong || msg.msg_type === "ping") return;

      if (msg.error) {
        // Subscribe rejected → we still have polling fallback via watchdog.
        return;
      }

      if (msg.msg_type === "tick" && msg.tick) {
        const sym = msg.tick.symbol as string;
        const epoch = Number(msg.tick.epoch);
        const price = Number(msg.tick.quote);
        if (msg.tick.id) this.subIds.set(sym, msg.tick.id);
        if (msg.tick.pip_size !== undefined) this.setPip(sym, Number(msg.tick.pip_size));
        const lastKnown = this.lastEpoch.get(sym) ?? 0;
        if (!Number.isFinite(epoch) || !Number.isFinite(price)) return;
        if (epoch <= lastKnown) return;
        const tk: Tick = { t: epoch * 1000, price };
        const buf = this.buffers.get(sym) ?? [];
        buf.push(tk);
        if (buf.length > MAX_BUFFER) buf.shift();
        this.buffers.set(sym, buf);
        this.pushDigit(sym, tk, MAX_BUFFER);
        this.lastEpoch.set(sym, epoch);
        this.tickListeners.forEach((l) => l(sym, tk));
        return;
      }

      if (msg.msg_type === "history" && msg.history && msg.echo_req?.ticks_history) {
        const sym = msg.echo_req.ticks_history as string;
        if (msg.pip_size !== undefined) this.setPip(sym, Number(msg.pip_size));
        const { prices, times } = msg.history as { prices: number[]; times: number[] };
        const isSeed = (msg.echo_req.count ?? 0) >= HISTORY_COUNT;
        const prev = this.buffers.get(sym) ?? [];
        const lastKnown = this.lastEpoch.get(sym) ?? 0;
        const fresh: Tick[] = [];
        for (let i = 0; i < prices.length; i++) {
          const epoch = times[i];
          if (epoch > lastKnown) fresh.push({ t: epoch * 1000, price: Number(prices[i]) });
        }
        if (isSeed || prev.length === 0) {
          const seed: Tick[] = new Array(prices.length);
          for (let i = 0; i < prices.length; i++) {
            seed[i] = { t: times[i] * 1000, price: Number(prices[i]) };
          }
          const trimmed = seed.length > MAX_BUFFER ? seed.slice(-MAX_BUFFER) : seed;
          this.setBuffer(sym, trimmed);
          if (times.length) this.lastEpoch.set(sym, times[times.length - 1]);
          this.historyListeners.forEach((l) => l(sym, trimmed));
        } else if (fresh.length) {
          const buf = prev.slice();
          for (const tk of fresh) {
            buf.push(tk);
            if (buf.length > MAX_BUFFER) buf.shift();
            this.pushDigit(sym, tk, MAX_BUFFER);
          }
          this.buffers.set(sym, buf);
          this.lastEpoch.set(sym, times[times.length - 1]);
          for (const tk of fresh) this.tickListeners.forEach((l) => l(sym, tk));
        }
      }
    };

    ws.onerror = () => {
      this.setStatus("error");
    };

    ws.onclose = () => {
      this.stopPing();
      this.stopWatchdog();
      this.ws = null;
      this.subIds.clear();
      if (this.refcount.size === 0) {
        this.setStatus("idle");
        return;
      }
      this.setStatus("error");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.refcount.size === 0) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(15_000, this.reconnectDelay * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendHistoryRequest(sym: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        ticks_history: sym,
        adjust_start_time: 1,
        count: HISTORY_COUNT,
        end: "latest",
        style: "ticks",
      }),
    );
  }

  private sendSubscribeRequest(sym: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
  }

  private sendCatchupRequest(sym: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        ticks_history: sym,
        adjust_start_time: 1,
        count: CATCHUP_COUNT,
        end: "latest",
        style: "ticks",
      }),
    );
  }

  private sendForget(subId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ forget: subId }));
  }

  private forgetSymbol(sym: string) {
    const subId = this.subIds.get(sym);
    if (subId) this.sendForget(subId);
    this.subIds.delete(sym);
    this.lastEpoch.delete(sym);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ ping: 1 }));
        } catch {}
      }
    }, 15_000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private startWatchdog() {
    this.stopWatchdog();
    // Every 3s, check symbols that have gone silent for too long. Fire a
    // catch-up history request (cheap) to fill any gap, without disturbing
    // the live subscription.
    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      // Dead-socket detector: no message of any kind for 30s → reconnect.
      if (this.ws?.readyState === WebSocket.OPEN && now - this.lastMessageAt > 30_000) {
        try {
          this.ws.close();
        } catch {}
        return;
      }
      for (const sym of this.refcount.keys()) {
        const lastEpochMs = (this.lastEpoch.get(sym) ?? 0) * 1000;
        if (lastEpochMs && now - lastEpochMs > STALE_TICK_MS) {
          this.sendCatchupRequest(sym);
        }
      }
    }, 3_000);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private hookEnv() {
    if (this.envHooked || typeof window === "undefined") return;
    this.envHooked = true;

    const kick = () => {
      // Reconnect immediately if the socket died; otherwise ask for a catch-up
      // so any gap while the tab was backgrounded fills instantly.
      if (
        !this.ws ||
        this.ws.readyState === WebSocket.CLOSED ||
        this.ws.readyState === WebSocket.CLOSING
      ) {
        this.reconnectDelay = 500;
        this.ensureConnection();
        return;
      }
      if (this.ws.readyState === WebSocket.OPEN) {
        for (const sym of this.refcount.keys()) this.sendCatchupRequest(sym);
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        kick();
        this.requestWakeLock();
      }
    });
    window.addEventListener("online", kick);
    window.addEventListener("focus", kick);
    this.requestWakeLock();
  }

  private async requestWakeLock() {
    try {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (!nav?.wakeLock?.request) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (this.wakeLock) return;
      this.wakeLock = await nav.wakeLock.request("screen");
      this.wakeLock.addEventListener?.("release", () => {
        this.wakeLock = null;
      });
    } catch {
      // wake lock is best-effort; ignore denials
    }
  }
}

export const derivBus = new DerivTickBus();
