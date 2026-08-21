import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/deriv-callback")({
  head: () => ({ meta: [{ title: "Connecting Deriv…" }] }),
  component: DerivCallback,
});

// Deriv OAuth returns: ?acct1=CR123&token1=xxx&cur1=USD&acct2=VRTC456&token2=yyy&cur2=USD ...
function parseAccounts(search: string) {
  const p = new URLSearchParams(search);
  const out: { loginid: string; token: string; currency: string }[] = [];
  for (let i = 1; i < 20; i++) {
    const loginid = p.get(`acct${i}`);
    const token = p.get(`token${i}`);
    if (!loginid || !token) break;
    out.push({ loginid, token, currency: p.get(`cur${i}`) ?? "" });
  }
  return out;
}

function DerivCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Connecting your Deriv account…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const accts = parseAccounts(window.location.search);
        if (accts.length === 0) {
          setErr("No accounts returned by Deriv.");
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setErr("Not signed in.");
          return;
        }
        const userId = userData.user.id;

        const rows = accts.map((a) => ({
          user_id: userId,
          loginid: a.loginid,
          token: a.token,
          currency: a.currency,
          is_virtual: a.loginid.startsWith("VR") || a.loginid.startsWith("VRTC"),
        }));
        const { error: upErr } = await supabase
          .from("deriv_accounts")
          .upsert(rows, { onConflict: "user_id,loginid" });
        if (upErr) throw upErr;

        const { data: active } = await supabase
          .from("deriv_accounts")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (!active) {
          const first = accts[0];
          await supabase
            .from("deriv_accounts")
            .update({ is_active: true })
            .eq("user_id", userId)
            .eq("loginid", first.loginid);
        }
        await supabase.from("profiles").update({ deriv_connected: true }).eq("id", userId);
        setMsg(`Connected ${accts.length} account${accts.length > 1 ? "s" : ""}.`);

        try {
          localStorage.setItem("precision-edge:deriv-connected", `${Date.now()}`);
        } catch {}

        // If opened as popup, notify parent and close.
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(
              { type: "deriv_oauth_accounts", count: accts.length },
              window.location.origin,
            );
          } catch {}
          setTimeout(() => window.close(), 400);
        } else {
          setTimeout(() => navigate({ to: "/app/settings" }), 1200);
        }
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="glass rounded-xl p-8 max-w-md w-full text-center space-y-3">
        {err ? (
          <>
            <div className="text-lg font-semibold text-[var(--bear)]">Connection failed</div>
            <div className="text-sm text-muted-foreground">{err}</div>
            <button
              onClick={() => navigate({ to: "/app/settings" })}
              className="mt-2 px-4 py-2 rounded-md bg-secondary hover:bg-secondary/70 text-sm"
            >
              Back to settings
            </button>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin mx-auto text-[var(--neon)]" size={28} />
            <div className="text-sm">{msg}</div>
          </>
        )}
      </div>
    </div>
  );
}
