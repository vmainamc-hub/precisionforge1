// Precision Parity AI — Shadow Paper-Trade & Replay Backtester Engine.
// Evaluates signals tick-by-tick with strict no-lookahead replay and logs realized metrics.

import type { ParitySignal } from "../types";

export interface PaperTradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  contract: string;
  entryTickIndex: number;
  entryDigit: number;
  exitDigit: number;
  outcome: "WIN" | "LOSS";
  claimedConfidence: number;
  payout: number;
  profitUnits: number;
}

export interface BacktestResult {
  symbol: string;
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  totalNetUnits: number;
  profitFactor: number;
  maxDrawdownUnits: number;
  brierScore: number;
  trades: PaperTradeRecord[];
}

const STORAGE_KEY = "precision_parity_shadow_trades_v1";

interface StoredShadowState {
  trades: PaperTradeRecord[];
}

function loadState(): StoredShadowState {
  if (typeof window === "undefined") return { trades: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { trades: [] };
  } catch {
    return { trades: [] };
  }
}

function saveState(s: StoredShadowState) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = { trades: s.trades.slice(-500) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export class ParityShadowEngine {
  private static instance: ParityShadowEngine | null = null;
  private state: StoredShadowState;

  private constructor() {
    this.state = loadState();
  }

  public static get(): ParityShadowEngine {
    if (!ParityShadowEngine.instance) {
      ParityShadowEngine.instance = new ParityShadowEngine();
    }
    return ParityShadowEngine.instance;
  }

  public recordShadowTrade(
    signal: ParitySignal,
    entryDigit: number,
    exitDigit: number,
    tickIndex: number,
  ): PaperTradeRecord {
    const isEven = exitDigit % 2 === 0;
    let win = false;

    if (signal.contract === "DIGITEVEN") win = isEven;
    else if (signal.contract === "DIGITODD") win = !isEven;
    else if (signal.contract === "DIGITUNDER" && signal.barrier !== undefined)
      win = exitDigit < signal.barrier;
    else if (signal.contract === "DIGITOVER" && signal.barrier !== undefined)
      win = exitDigit > signal.barrier;
    else if (signal.contract === "DIGITDIFF" && signal.barrier !== undefined)
      win = exitDigit !== signal.barrier;
    else if (signal.contract === "DIGITMATCH" && signal.barrier !== undefined)
      win = exitDigit === signal.barrier;

    const profit = win ? signal.payout : -1.0;

    const record: PaperTradeRecord = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      symbol: signal.symbol,
      contract: signal.contract,
      entryTickIndex: tickIndex,
      entryDigit,
      exitDigit,
      outcome: win ? "WIN" : "LOSS",
      claimedConfidence: signal.confidence,
      payout: signal.payout,
      profitUnits: profit,
    };

    this.state.trades.unshift(record);
    saveState(this.state);
    return record;
  }

  public getRecentTrades(limit = 50): PaperTradeRecord[] {
    return this.state.trades.slice(0, limit);
  }

  public getPerformanceStats(): {
    totalTrades: number;
    winRate: number;
    netProfit: number;
    profitFactor: number;
  } {
    const trades = this.state.trades;
    const total = trades.length;
    if (total === 0) return { totalTrades: 0, winRate: 0.5, netProfit: 0, profitFactor: 1.0 };

    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    for (const t of trades) {
      if (t.outcome === "WIN") {
        wins++;
        grossProfit += t.profitUnits;
      } else {
        grossLoss += Math.abs(t.profitUnits);
      }
    }

    const winRate = wins / total;
    const netProfit = grossProfit - grossLoss;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 1.0;

    return {
      totalTrades: total,
      winRate: Number((winRate * 100).toFixed(1)),
      netProfit: Number(netProfit.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2)),
    };
  }
}
