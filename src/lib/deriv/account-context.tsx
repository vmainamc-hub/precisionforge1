// Global authenticated Deriv account context shared by every /app/* page.
// - Loads the user's active deriv_account row from Cloud
// - Opens an authorized DerivClient
// - Streams live balance
// - Exposes buy(), sell(), proposal helpers, portfolio refresh
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { DerivClient } from "./api";

type Account = {
  id: string;
  loginid: string;
  token: string;
  currency: string | null;
  is_virtual: boolean;
  balance: number | null;
};

type Portfolio = { contracts: any[] };

type Ctx = {
  account: Account | null;
  status: "idle" | "connecting" | "open" | "closed" | "error";
  balance: number | null;
  currency: string | null;
  portfolio: Portfolio;
  refreshAccount: () => Promise<void>;
  refreshPortfolio: () => Promise<void>;
  client: DerivClient | null;
  loading: boolean;
};

const DerivCtx = createContext<Ctx | null>(null);

export function DerivAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<Ctx["status"]>("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio>({ contracts: [] });
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<DerivClient | null>(null);
  const balSubId = useRef<string>("");

  const refreshAccount = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setAccount(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("deriv_accounts")
      .select("id, loginid, token, currency, is_virtual, balance")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle();
    setAccount(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // Connect / reconnect when active account changes
  useEffect(() => {
    if (!account) {
      clientRef.current?.close();
      clientRef.current = null;
      setStatus("idle");
      setBalance(null);
      setCurrency(null);
      return;
    }
    const c = new DerivClient(account.token);
    c.onStatus(setStatus);
    clientRef.current = c;
    let cancelled = false;
    (async () => {
      try {
        const auth = await c.connect();
        if (cancelled) return;
        setCurrency(auth.authorize?.currency ?? account.currency ?? null);
        // Subscribe to balance stream
        const { subId } = await c.subscribe({ balance: 1 }, (msg) => {
          if (msg.balance?.balance !== undefined) {
            setBalance(Number(msg.balance.balance));
            supabase
              .from("deriv_accounts")
              .update({ balance: Number(msg.balance.balance) })
              .eq("id", account.id)
              .then(() => {});
          }
        });
        balSubId.current = subId;
      } catch (e) {
        console.error("Deriv connect failed", e);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (balSubId.current) c.forget(balSubId.current);
      c.close();
    };
  }, [account?.id, account?.token]);

  const refreshPortfolio = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    try {
      const res = await c.send({ portfolio: 1 });
      setPortfolio({ contracts: res.portfolio?.contracts ?? [] });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (status !== "open") return;
    refreshPortfolio();
    const t = setInterval(refreshPortfolio, 5000);
    return () => clearInterval(t);
  }, [status, refreshPortfolio]);

  return (
    <DerivCtx.Provider
      value={{
        account,
        status,
        balance,
        currency,
        portfolio,
        refreshAccount,
        refreshPortfolio,
        client: clientRef.current,
        loading,
      }}
    >
      {children}
    </DerivCtx.Provider>
  );
}

export function useDerivAccount() {
  const v = useContext(DerivCtx);
  if (!v) throw new Error("useDerivAccount must be inside DerivAccountProvider");
  return v;
}
