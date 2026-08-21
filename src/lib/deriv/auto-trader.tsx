// Auto-trader engine. Consumes signals from StreamProvider and fires
// Deriv `buy` calls via the authorized DerivClient. Respects per-symbol +
// per-source cooldowns, min-confidence gate, daily-loss guard,
// consecutive-loss guard, TP/SL, and demo-only flag.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDerivAccount } from "./account-context";
import { useStream } from "@/lib/stream-context";

export type AutoSources = {
  under7: boolean;
  over2: boolean;
  advUnder7: boolean;
  advOver2: boolean;
};

export type AutoSettings = {
  enabled: boolean;
  sources: AutoSources;
  stake: number;
  duration_ticks: number;
  min_confidence: number;
  max_daily_loss: number | null;
  max_consecutive_losses: number;
  take_profit: number | null;
  stop_loss: number | null;
  demo_only: boolean;
};

const DEFAULT: AutoSettings = {
  enabled: false,
  sources: { under7: true, over2: true, advUnder7: true, advOver2: true },
  stake: 1,
  duration_ticks: 5,
  min_confidence: 75,
  max_daily_loss: null,
  max_consecutive_losses: 5,
  take_profit: null,
  stop_loss: null,
  demo_only: true,
};

export type AutoLog = {
  id: string;
  ts: number;
  source: string;
  symbol: string;
  contract_type: string;
  stake: number;
  duration: number;
  barrier?: string;
  status: "sent" | "bought" | "won" | "lost" | "error" | "skipped";
  message?: string;
  contract_id?: string;
  profit?: number;
};

type Ctx = {
  settings: AutoSettings;
  updateSettings: (s: Partial<AutoSettings>) => Promise<void>;
  save: () => Promise<void>;
  loading: boolean;
  logs: AutoLog[];
  running: boolean;
  clearLogs: () => void;
  dailyPL: number;
  consecutiveLosses: number;
  haltReason: string | null;
};

const AutoCtx = createContext<Ctx | null>(null);

export function AutoTraderProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AutoSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AutoLog[]>([]);
  const [dailyPL, setDailyPL] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [haltReason, setHaltReason] = useState<string | null>(null);
  const stream = useStream();
  const { account, client, status } = useDerivAccount();

  // Load persisted settings
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data } = await (supabase.from as any)("auto_trade_settings")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      const d = data as any;
      if (d) {
        setSettings({
          enabled: d.enabled,
          sources: d.sources as AutoSources,
          stake: Number(d.stake),
          duration_ticks: d.duration_ticks,
          min_confidence: d.min_confidence,
          max_daily_loss: d.max_daily_loss !== null ? Number(d.max_daily_loss) : null,
          max_consecutive_losses: d.max_consecutive_losses,
          take_profit: d.take_profit !== null ? Number(d.take_profit) : null,
          stop_loss: d.stop_loss !== null ? Number(d.stop_loss) : null,
          demo_only: d.demo_only,
        });
      }
      setLoading(false);
    })();
  }, []);

  // Track today's realized PL from trades table (auto trades only)
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("trades")
        .select("profit")
        .eq("user_id", userData.user.id)
        .eq("auto_trade", true)
        .gte("purchased_at", since.toISOString());
      const sum = (data ?? []).reduce((s: number, r: any) => s + (Number(r.profit) || 0), 0);
      setDailyPL(sum);
    })();
  }, [logs.length]);

  async function save() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await (supabase.from as any)("auto_trade_settings").upsert({
      user_id: userData.user.id,
      enabled: settings.enabled,
      sources: settings.sources,
      stake: settings.stake,
      duration_ticks: settings.duration_ticks,
      min_confidence: settings.min_confidence,
      max_daily_loss: settings.max_daily_loss,
      max_consecutive_losses: settings.max_consecutive_losses,
      take_profit: settings.take_profit,
      stop_loss: settings.stop_loss,
      demo_only: settings.demo_only,
    });
  }
  async function updateSettings(patch: Partial<AutoSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  // Per-signal dedupe (source|symbol|ts). Per-symbol source cooldown 60s to
  // avoid overtrading if the same signal re-emits on rerenders.
  const seen = useRef<Set<string>>(new Set());
  const symbolCooldown = useRef<Record<string, number>>({});

  function log(entry: Omit<AutoLog, "id" | "ts">) {
    setLogs((prev) =>
      [{ id: crypto.randomUUID(), ts: Date.now(), ...entry }, ...prev].slice(0, 200),
    );
  }

  function updateLog(id: string, patch: Partial<AutoLog>) {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  // Halt reason evaluation
  useEffect(() => {
    if (!settings.enabled) {
      setHaltReason(null);
      return;
    }
    if (settings.demo_only && account && !account.is_virtual) {
      setHaltReason(
        "Demo-only mode is on and active account is Real. Switch account or disable demo-only.",
      );
      return;
    }
    if (settings.max_daily_loss !== null && dailyPL <= -Math.abs(settings.max_daily_loss)) {
      setHaltReason(`Daily loss limit reached (${dailyPL.toFixed(2)}).`);
      return;
    }
    if (consecutiveLosses >= settings.max_consecutive_losses) {
      setHaltReason(`Consecutive-loss guard tripped (${consecutiveLosses}).`);
      return;
    }
    if (settings.take_profit !== null && dailyPL >= settings.take_profit) {
      setHaltReason(`Take-profit hit (${dailyPL.toFixed(2)}).`);
      return;
    }
    if (settings.stop_loss !== null && dailyPL <= -Math.abs(settings.stop_loss)) {
      setHaltReason(`Stop-loss hit (${dailyPL.toFixed(2)}).`);
      return;
    }
    setHaltReason(null);
  }, [settings, account, dailyPL, consecutiveLosses]);

  const running = settings.enabled && status === "open" && !!client && !!account && !haltReason;

  // Enqueue a trade
  async function fire(
    source: string,
    symbol: string,
    contract_type: string,
    extra: { barrier?: string; conf?: number } = {},
  ) {
    if (!running || !client || !account) return;
    const key = `${source}:${symbol}:${contract_type}:${extra.barrier ?? ""}`;
    const now = Date.now();
    if ((symbolCooldown.current[key] ?? 0) + 30_000 > now) return;
    symbolCooldown.current[key] = now;

    const logId = crypto.randomUUID();
    const initial: AutoLog = {
      id: logId,
      ts: now,
      source,
      symbol,
      contract_type,
      stake: settings.stake,
      duration: settings.duration_ticks,
      barrier: extra.barrier,
      status: "sent",
      message: `conf ${extra.conf ?? "?"}%`,
    };
    setLogs((prev) => [initial, ...prev].slice(0, 200));

    try {
      const params: any = {
        proposal: 1,
        amount: settings.stake,
        basis: "stake",
        contract_type,
        currency: account.currency ?? "USD",
        duration: settings.duration_ticks,
        duration_unit: "t",
        symbol,
      };
      if (extra.barrier !== undefined) params.barrier = extra.barrier;
      const p = await client.send(params);
      const propId = p.proposal?.id;
      if (!propId) throw new Error("no proposal id");
      const res = await client.send({ buy: propId, price: p.proposal.ask_price });
      const c = res.buy;
      updateLog(logId, {
        status: "bought",
        contract_id: String(c.contract_id),
        message: `payout ${c.payout}`,
      });

      // Persist to trades
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await (supabase.from as any)("trades").insert({
          user_id: userData.user.id,
          deriv_account_id: account.id,
          loginid: account.loginid,
          contract_id: String(c.contract_id),
          symbol,
          contract_type,
          stake: settings.stake,
          duration: settings.duration_ticks,
          duration_unit: "t",
          barrier: extra.barrier ?? null,
          entry_price: c.buy_price,
          payout: c.payout,
          status: "open",
          is_virtual: account.is_virtual,
          purchased_at: new Date().toISOString(),
          auto_trade: true,
          signal_source: source,
          meta: {
            transaction_id: c.transaction_id,
            longcode: c.longcode,
            confidence: extra.conf ?? null,
          },
        });
      }

      // Subscribe to contract outcome
      let subId = "";
      const { subId: sid } = await client.subscribe(
        { proposal_open_contract: 1, contract_id: c.contract_id },
        async (msg) => {
          const poc = msg.proposal_open_contract;
          if (!poc || !poc.is_sold) return;
          const profit = Number(poc.profit);
          const won = profit > 0;
          updateLog(logId, { status: won ? "won" : "lost", profit });
          setConsecutiveLosses((n) => (won ? 0 : n + 1));
          const { data: uD } = await supabase.auth.getUser();
          if (uD.user) {
            await supabase
              .from("trades")
              .update({
                status: won ? "won" : "lost",
                profit,
                exit_price: poc.sell_price,
                closed_at: new Date().toISOString(),
              })
              .eq("user_id", uD.user.id)
              .eq("contract_id", String(c.contract_id));
          }
          client.forget(subId);
        },
      );
      subId = sid;
    } catch (e: any) {
      updateLog(logId, { status: "error", message: e.message ?? String(e) });
    }
  }

  // Watch signals
  useEffect(() => {
    if (!running) return;
    const { scan, advScan } = stream;

    // Under 7 multi-market
    if (settings.sources.under7) {
      for (const m of scan.matches) {
        const key = `u7:${m.symbol}:${m.ts}`;
        if (seen.current.has(key) || m.conf < settings.min_confidence) continue;
        seen.current.add(key);
        fire("under7", m.symbol, "DIGITUNDER", { barrier: "7", conf: m.conf });
      }
    }
    // Over 2 multi-market
    if (settings.sources.over2) {
      for (const m of scan.over2Matches) {
        const key = `o2:${m.symbol}:${m.ts}`;
        if (seen.current.has(key) || m.conf < settings.min_confidence) continue;
        seen.current.add(key);
        fire("over2", m.symbol, "DIGITOVER", { barrier: "2", conf: m.conf });
      }
    }
    // Advanced scanners
    if (settings.sources.advUnder7 && advScan?.under7Signals) {
      for (const s of advScan.under7Signals) {
        const key = `au7:${s.id}`;
        if (seen.current.has(key) || s.conf < settings.min_confidence) continue;
        seen.current.add(key);
        fire("adv-under7", s.symbol, "DIGITUNDER", { barrier: "7", conf: s.conf });
      }
    }
    if (settings.sources.advOver2 && advScan?.over2Signals) {
      for (const s of advScan.over2Signals) {
        const key = `ao2:${s.id}`;
        if (seen.current.has(key) || s.conf < settings.min_confidence) continue;
        seen.current.add(key);
        fire("adv-over2", s.symbol, "DIGITOVER", { barrier: "2", conf: s.conf });
      }
    }
  }, [
    running,
    stream.scan,
    stream.advScan,
    settings.sources,
    settings.min_confidence,
    settings.stake,
    settings.duration_ticks,
  ]);

  const value: Ctx = useMemo(
    () => ({
      settings,
      updateSettings,
      save,
      loading,
      logs,
      running,
      clearLogs: () => setLogs([]),
      dailyPL,
      consecutiveLosses,
      haltReason,
    }),
    [settings, loading, logs, running, dailyPL, consecutiveLosses, haltReason],
  );

  return <AutoCtx.Provider value={value}>{children}</AutoCtx.Provider>;
}

export function useAutoTrader() {
  const v = useContext(AutoCtx);
  if (!v) throw new Error("useAutoTrader must be inside AutoTraderProvider");
  return v;
}
