import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/history")({
  head: () => ({ meta: [{ title: "Trade History — Precision Edge" }] }),
  component: HistoryPage,
});

type Trade = {
  id: string;
  contract_id: string | null;
  symbol: string;
  contract_type: string;
  stake: number;
  payout: number | null;
  profit: number | null;
  status: string;
  is_virtual: boolean;
  loginid: string | null;
  purchased_at: string | null;
  created_at: string;
};

function HistoryPage() {
  const [rows, setRows] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("trades")
        .select(
          "id, contract_id, symbol, contract_type, stake, payout, profit, status, is_virtual, loginid, purchased_at, created_at",
        )
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const closed = rows.filter((r) => r.profit !== null);
  const wins = closed.filter((r) => (r.profit ?? 0) > 0).length;
  const totalPL = closed.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Trade History</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total trades" value={String(rows.length)} />
        <Stat label="Closed" value={String(closed.length)} />
        <Stat
          label="Win rate"
          value={`${winRate.toFixed(1)}%`}
          tone={winRate >= 55 ? "bull" : "bear"}
        />
        <Stat label="Total P/L" value={totalPL.toFixed(2)} tone={totalPL >= 0 ? "bull" : "bear"} />
      </div>

      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No trades yet. Place your first trade on the{" "}
            <a className="text-[var(--neon)] underline" href="/app/trading">
              Trading page
            </a>
            .
          </div>
        ) : (
          <div className="text-xs">
            <div className="grid grid-cols-8 gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-secondary/30">
              <div>When</div>
              <div>Account</div>
              <div>Symbol</div>
              <div>Type</div>
              <div>Stake</div>
              <div>Payout</div>
              <div>P/L</div>
              <div>Status</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-8 gap-2 px-4 py-2 border-b border-border/20 tabular items-center"
              >
                <div className="text-muted-foreground">
                  {new Date(r.purchased_at ?? r.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>
                  {r.loginid ?? "—"}
                  {r.is_virtual && (
                    <span className="ml-1 text-[9px] text-[var(--accent)]">DEMO</span>
                  )}
                </div>
                <div>{r.symbol}</div>
                <div>{r.contract_type}</div>
                <div>{Number(r.stake).toFixed(2)}</div>
                <div>{r.payout !== null ? Number(r.payout).toFixed(2) : "—"}</div>
                <div
                  className={
                    r.profit === null
                      ? "text-muted-foreground"
                      : Number(r.profit) >= 0
                        ? "text-[var(--bull)]"
                        : "text-[var(--bear)]"
                  }
                >
                  {r.profit === null
                    ? "—"
                    : (Number(r.profit) >= 0 ? "+" : "") + Number(r.profit).toFixed(2)}
                </div>
                <div className="uppercase text-[10px] tracking-widest">{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  const color =
    tone === "bull"
      ? "text-[var(--bull)]"
      : tone === "bear"
        ? "text-[var(--bear)]"
        : "text-foreground";
  return (
    <div className="glass rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`tabular text-xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
