import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDerivAccount } from "@/lib/deriv/account-context";
import { useStream } from "@/lib/stream-context";
import { supabase } from "@/integrations/supabase/client";
import { PriceChart } from "@/components/PriceChart";
import { Panel } from "@/components/Panel";
import { TrendingUp, TrendingDown, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/trading")({
  head: () => ({ meta: [{ title: "Manual Trading — Precision Edge" }] }),
  component: TradingPage,
});

const CONTRACT_TYPES: { code: string; label: string; group: string; pair?: string }[] = [
  { code: "CALL", label: "Rise", group: "Rise/Fall", pair: "PUT" },
  { code: "PUT", label: "Fall", group: "Rise/Fall", pair: "CALL" },
  { code: "DIGITEVEN", label: "Even", group: "Even/Odd" },
  { code: "DIGITODD", label: "Odd", group: "Even/Odd" },
  { code: "DIGITOVER", label: "Over", group: "Over/Under" },
  { code: "DIGITUNDER", label: "Under", group: "Over/Under" },
  { code: "DIGITMATCH", label: "Matches", group: "Matches/Differs" },
  { code: "DIGITDIFF", label: "Differs", group: "Matches/Differs" },
];

function TradingPage() {
  const { account, client, status, balance, currency, portfolio, refreshPortfolio } =
    useDerivAccount();
  const stream = useStream();
  const [contract, setContract] = useState("CALL");
  const [stake, setStake] = useState<number>(1);
  const [duration, setDuration] = useState<number>(5);
  const [durUnit, setDurUnit] = useState<string>("t");
  const [barrier, setBarrier] = useState<string>("5");
  const [proposal, setProposal] = useState<{
    ask_price?: number;
    payout?: number;
    spot?: number;
  } | null>(null);
  const [proposalErr, setProposalErr] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const needsBarrier =
    contract === "DIGITOVER" ||
    contract === "DIGITUNDER" ||
    contract === "DIGITMATCH" ||
    contract === "DIGITDIFF";

  // Live proposal subscription
  useEffect(() => {
    setProposal(null);
    setProposalErr(null);
    if (!client || status !== "open") return;
    let subId = "";
    let cancelled = false;
    const params: any = {
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: contract,
      currency: currency || "USD",
      duration,
      duration_unit: durUnit,
      symbol: stream.symbol,
    };
    if (needsBarrier) params.barrier = barrier;

    client
      .subscribe(params, (m) => {
        if (cancelled) return;
        if (m.error) {
          setProposalErr(m.error.message);
          return;
        }
        if (m.proposal) {
          setProposal({
            ask_price: Number(m.proposal.ask_price),
            payout: Number(m.proposal.payout),
            spot: Number(m.proposal.spot),
          });
          setProposalErr(null);
        }
      })
      .then((r) => {
        subId = r.subId;
      })
      .catch((e) => setProposalErr(e.message));

    return () => {
      cancelled = true;
      if (subId) client.forget(subId);
    };
  }, [
    client,
    status,
    stake,
    contract,
    duration,
    durUnit,
    barrier,
    stream.symbol,
    currency,
    needsBarrier,
  ]);

  async function buy() {
    if (!client || !proposal) return;
    setBuying(true);
    setMsg(null);
    try {
      // Re-request non-subscribed proposal to get a fresh proposal id
      const params: any = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: contract,
        currency: currency || "USD",
        duration,
        duration_unit: durUnit,
        symbol: stream.symbol,
      };
      if (needsBarrier) params.barrier = barrier;
      const p = await client.send(params);
      const propId = p.proposal?.id;
      if (!propId) throw new Error("No proposal id");
      const res = await client.send({ buy: propId, price: p.proposal.ask_price });
      const c = res.buy;
      // Log to trades table
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user && account) {
        await supabase.from("trades").insert({
          user_id: userData.user.id,
          deriv_account_id: account.id,
          loginid: account.loginid,
          contract_id: String(c.contract_id),
          symbol: stream.symbol,
          contract_type: contract,
          stake,
          duration,
          duration_unit: durUnit,
          barrier: needsBarrier ? barrier : null,
          entry_price: c.buy_price,
          payout: c.payout,
          status: "open",
          is_virtual: account.is_virtual,
          purchased_at: new Date().toISOString(),
          meta: { transaction_id: c.transaction_id, longcode: c.longcode },
        });
      }
      setMsg(`Bought ${contract} · Contract ${c.contract_id} · payout ${c.payout}`);
      refreshPortfolio();
    } catch (e: any) {
      setMsg(`Error: ${e.message ?? e}`);
    } finally {
      setBuying(false);
    }
  }

  async function sell(contractId: number) {
    if (!client) return;
    try {
      const res = await client.send({ sell: contractId, price: 0 });
      const sold = res.sell;
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("trades")
          .update({
            status: "sold",
            exit_price: sold.sold_for,
            profit: sold.sold_for - stake,
            closed_at: new Date().toISOString(),
          })
          .eq("user_id", userData.user.id)
          .eq("contract_id", String(contractId));
      }
      refreshPortfolio();
    } catch (e: any) {
      setMsg(`Sell error: ${e.message ?? e}`);
    }
  }

  const groups = useMemo(() => {
    const g: Record<string, typeof CONTRACT_TYPES> = {};
    CONTRACT_TYPES.forEach((c) => {
      (g[c.group] ??= []).push(c);
    });
    return g;
  }, []);

  if (!account) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="glass rounded-xl p-8 text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Connect your Deriv account</h2>
          <p className="text-sm text-muted-foreground">
            Manual trading needs an authorized Deriv account. Head to Settings to connect.
          </p>
          <a
            href="/app/settings"
            className="inline-block mt-2 px-4 py-2 rounded-md bg-[var(--neon)] text-[var(--primary-foreground)] text-sm font-medium"
          >
            Go to settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="Account"
          value={account.loginid}
          hint={account.is_virtual ? "Demo" : "Real"}
        />
        <Metric
          label="Balance"
          value={`${balance?.toFixed(2) ?? "—"} ${currency ?? ""}`}
          tone="bull"
        />
        <Metric
          label="Status"
          value={status.toUpperCase()}
          tone={status === "open" ? "bull" : "bear"}
        />
        <Metric label="Open positions" value={String(portfolio.contracts.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Panel
            title="Live Market"
            subtitle={stream.symbols.find((x) => x.symbol === stream.symbol)?.name ?? stream.symbol}
            accent="cyan"
          >
            <PriceChart ticks={stream.view} />
          </Panel>

          <Panel
            title="Open Positions"
            subtitle={`${portfolio.contracts.length} contracts`}
            accent="magenta"
          >
            {portfolio.contracts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No open contracts.
              </div>
            ) : (
              <div className="text-xs">
                <div className="grid grid-cols-6 gap-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/40">
                  <div>Contract</div>
                  <div>Symbol</div>
                  <div>Type</div>
                  <div>Stake</div>
                  <div>Payout</div>
                  <div className="text-right">Action</div>
                </div>
                {portfolio.contracts.map((c: any) => (
                  <div
                    key={c.contract_id}
                    className="grid grid-cols-6 gap-2 py-2 items-center border-b border-border/20 tabular"
                  >
                    <div>{c.contract_id}</div>
                    <div>{c.symbol}</div>
                    <div>{c.contract_type}</div>
                    <div>{c.buy_price}</div>
                    <div>{c.payout}</div>
                    <div className="text-right">
                      <button
                        onClick={() => sell(c.contract_id)}
                        className="px-2 py-1 rounded bg-[var(--bear)]/20 text-[var(--bear)] text-[11px] hover:bg-[var(--bear)]/30"
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Trade ticket */}
        <div className="glass rounded-xl p-5 space-y-4 h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Trade Ticket</h2>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Contract
            </div>
            {Object.entries(groups).map(([g, items]) => (
              <div key={g} className="space-y-1">
                <div className="text-[10px] text-muted-foreground">{g}</div>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((it) => {
                    const active = contract === it.code;
                    const bull =
                      it.code === "CALL" ||
                      it.code === "DIGITEVEN" ||
                      it.code === "DIGITOVER" ||
                      it.code === "DIGITMATCH";
                    return (
                      <button
                        key={it.code}
                        onClick={() => setContract(it.code)}
                        className={`h-9 rounded-md text-xs font-medium border transition ${active ? (bull ? "bg-[var(--bull)]/25 border-[var(--bull)] text-[var(--bull)]" : "bg-[var(--bear)]/25 border-[var(--bear)] text-[var(--bear)]") : "border-border/50 hover:border-border"}`}
                      >
                        {bull ? (
                          <TrendingUp className="inline mr-1" size={12} />
                        ) : (
                          <TrendingDown className="inline mr-1" size={12} />
                        )}
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Row label="Stake">
            <input
              type="number"
              min={0.35}
              step={0.01}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="tk-input"
            />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="Duration">
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="tk-input"
              />
            </Row>
            <Row label="Unit">
              <select
                value={durUnit}
                onChange={(e) => setDurUnit(e.target.value)}
                className="tk-input"
              >
                <option value="t">Ticks</option>
                <option value="s">Seconds</option>
                <option value="m">Minutes</option>
                <option value="h">Hours</option>
              </select>
            </Row>
          </div>
          {needsBarrier && (
            <Row label="Barrier (digit)">
              <input
                value={barrier}
                onChange={(e) => setBarrier(e.target.value)}
                className="tk-input"
              />
            </Row>
          )}

          <div className="rounded-lg border border-border/50 p-3 text-xs space-y-1 bg-secondary/20">
            {proposalErr ? (
              <div className="text-[var(--bear)]">{proposalErr}</div>
            ) : proposal ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ask price</span>
                  <span className="tabular">{proposal.ask_price?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payout</span>
                  <span className="tabular text-[var(--bull)]">{proposal.payout?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spot</span>
                  <span className="tabular">{proposal.spot?.toFixed(4)}</span>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading proposal…
              </div>
            )}
          </div>

          <button
            onClick={buy}
            disabled={!proposal || buying || status !== "open"}
            className="w-full h-11 rounded-md bg-[var(--neon)] text-[var(--primary-foreground)] font-semibold text-sm disabled:opacity-50"
          >
            {buying ? "Placing…" : `Buy ${contract} · ${stake} ${currency ?? ""}`}
          </button>
          {msg && <div className="text-[11px] text-center text-muted-foreground">{msg}</div>}
        </div>
      </div>
      <style>{`.tk-input{height:34px;width:100%;padding:0 10px;border-radius:6px;background:hsl(var(--secondary)/.4);border:1px solid hsl(var(--border));color:inherit;font-size:13px}`}</style>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
  hint?: string;
}) {
  const color =
    tone === "bull"
      ? "text-[var(--bull)]"
      : tone === "bear"
        ? "text-[var(--bear)]"
        : "text-foreground";
  return (
    <div className="glass rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`tabular text-lg font-semibold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
