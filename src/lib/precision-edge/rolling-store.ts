// Rolling data store — one instance per market. Incremental, never rebuilds.
import type { Tick } from "./types";

export class RollingStore {
  readonly market: string;
  readonly maxSize: number;
  private buffer: Tick[] = [];
  private lastDigitCache: number[] = [];

  constructor(market: string, maxSize = 1000) {
    this.market = market;
    this.maxSize = maxSize;
  }

  /** Seed once from historical ticks (e.g. Deriv ticks_history). */
  seed(ticks: Tick[]) {
    this.buffer = ticks.slice(-this.maxSize);
    this.lastDigitCache = this.buffer.map((t) => digit(t.price));
  }

  /** Push a single live tick. O(1) amortised. */
  push(tick: Tick) {
    this.buffer.push(tick);
    this.lastDigitCache.push(digit(tick.price));
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
      this.lastDigitCache.shift();
    }
  }

  size() {
    return this.buffer.length;
  }
  ticks() {
    return this.buffer;
  }
  digits() {
    return this.lastDigitCache;
  }

  /** Latest N ticks (or fewer if not enough data yet). */
  window(n: number): Tick[] {
    return this.buffer.slice(-n);
  }

  digitWindow(n: number): number[] {
    return this.lastDigitCache.slice(-n);
  }

  latest(): Tick | null {
    return this.buffer[this.buffer.length - 1] ?? null;
  }
}

export function digit(price: number): number {
  return Math.abs(Math.round(price * 100)) % 10;
}
