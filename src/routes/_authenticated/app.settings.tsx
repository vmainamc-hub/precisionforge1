import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DERIV_OAUTH_URL, DERIV_APP_ID } from "@/lib/deriv/api";
import { useDerivAccount } from "@/lib/deriv/account-context";
import { CheckCircle2, Circle, Trash2, LogIn, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Precision Edge" }] }),
  component: SettingsPage,
});

type Row = {
  id: string;
  loginid: string;
  currency: string | null;
  is_virtual: boolean;
  is_active: boolean;
  balance: number | null;
};

function SettingsPage() {
  const { refreshAccount, status, balance } = useDerivAccount();
  const [rows, setRows] = useState<Row[]>([]);
  const [prefs, setPrefs] = useState<{
    min_confidence: number;
    alert_sound: boolean;
    risk_profile: string;
    max_daily_loss: number | null;
    max_stake: number | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const [accts, prefsRes] = await Promise.all([
      supabase
        .from("deriv_accounts")
        .select("id, loginid, currency, is_virtual, is_active, balance")
        .eq("user_id", userData.user.id)
        .order("created_at"),
      supabase
        .from("user_preferences")
        .select("min_confidence, alert_sound, risk_profile, max_daily_loss, max_stake")
        .eq("user_id", userData.user.id)
        .maybeSingle(),
    ]);
    setRows(accts.data ?? []);
    if (prefsRes.data)
      setPrefs({
        min_confidence: Number(prefsRes.data.min_confidence),
        alert_sound: prefsRes.data.alert_sound,
        risk_profile: prefsRes.data.risk_profile,
        max_daily_loss:
          prefsRes.data.max_daily_loss !== null ? Number(prefsRes.data.max_daily_loss) : null,
        max_stake: prefsRes.data.max_stake !== null ? Number(prefsRes.data.max_stake) : null,
      });
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const refreshConnectedAccounts = async () => {
      await load();
      await refreshAccount();
      setConnectNotice(null);
    };

    const messageHandler = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type !== "deriv_oauth_accounts") return;
      refreshConnectedAccounts();
    };

    const storageHandler = (ev: StorageEvent) => {
      if (ev.key !== "precision-edge:deriv-connected") return;
      refreshConnectedAccounts();
    };

    const focusHandler = () => {
      if (connectNotice) load();
    };

    window.addEventListener("message", messageHandler);
    window.addEventListener("storage", storageHandler);
    window.addEventListener("focus", focusHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("focus", focusHandler);
    };
  }, [connectNotice, refreshAccount]);

  function connectDeriv() {
    const redirect = `${window.location.origin}/app/deriv-callback`;
    const url = DERIV_OAUTH_URL(redirect);
    setConnectNotice(
      "Deriv opened in a new tab. Sign in there, then return here once Deriv sends you back to Precision Edge.",
    );

    // Deriv blocks iframe/popup-style windows, so open OAuth as a normal top-level tab.
    // Never assign window.location here; Precision Edge must stay on the settings page.
    const tab = window.open(url, "_blank");
    if (!tab) {
      setConnectNotice(
        "Your browser blocked the Deriv sign-in tab. Allow popups for this site, then press Connect Deriv again.",
      );
    } else {
      try {
        tab.focus();
      } catch {}
    }
  }

  async function setActive(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase
      .from("deriv_accounts")
      .update({ is_active: false })
      .eq("user_id", userData.user.id);
    await supabase.from("deriv_accounts").update({ is_active: true }).eq("id", id);
    await load();
    await refreshAccount();
  }

  async function remove(id: string) {
    await supabase.from("deriv_accounts").delete().eq("id", id);
    await load();
    await refreshAccount();
  }

  async function savePrefs() {
    if (!prefs) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("user_preferences").upsert({ user_id: userData.user.id, ...prefs });
    setSaving(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Deriv connection, trading limits, and preferences.
        </p>
      </div>

      {/* Deriv connection */}
      <section className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap size={18} className="text-[var(--neon)]" /> Deriv Connection
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Connect via Deriv OAuth to enable live trading. App ID:{" "}
              <span className="tabular">{DERIV_APP_ID}</span>
            </p>
          </div>
          <button
            onClick={connectDeriv}
            className="px-4 py-2 rounded-md bg-[var(--neon)] text-[var(--primary-foreground)] font-medium text-sm flex items-center gap-2 hover:opacity-90"
          >
            <LogIn size={14} /> {rows.length ? "Add / Reconnect" : "Connect Deriv"}
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border/60 rounded-lg p-6 text-center">
            No Deriv accounts connected yet.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {rows.map((r) => (
              <div key={r.id} className="py-3 flex items-center gap-3">
                <button onClick={() => setActive(r.id)} title="Set active">
                  {r.is_active ? (
                    <CheckCircle2 size={18} className="text-[var(--bull)]" />
                  ) : (
                    <Circle size={18} className="text-muted-foreground hover:text-foreground" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="text-sm font-semibold tabular">
                    {r.loginid}{" "}
                    <span
                      className={`ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${r.is_virtual ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--bull)]/20 text-[var(--bull)]"}`}
                    >
                      {r.is_virtual ? "Demo" : "Real"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Balance:{" "}
                    <span className="tabular">
                      {r.is_active && balance !== null
                        ? balance.toFixed(2)
                        : (r.balance?.toFixed(2) ?? "—")}
                    </span>{" "}
                    {r.currency}
                    {r.is_active && (
                      <span className="ml-2 uppercase tracking-widest text-[9px] text-[var(--neon)]">
                        · {status}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  className="text-muted-foreground hover:text-[var(--bear)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {connectNotice && (
          <div className="text-xs text-[var(--neon)] border border-[var(--neon)]/30 bg-[var(--neon)]/10 rounded-lg px-3 py-2">
            {connectNotice}
          </div>
        )}
      </section>

      {/* Trading preferences */}
      {prefs && (
        <section className="glass rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Trading Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Field label="Min signal confidence (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={prefs.min_confidence}
                onChange={(e) => setPrefs({ ...prefs, min_confidence: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Risk profile">
              <select
                value={prefs.risk_profile}
                onChange={(e) => setPrefs({ ...prefs, risk_profile: e.target.value })}
                className="input"
              >
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </Field>
            <Field label="Max stake per trade">
              <input
                type="number"
                min={0}
                step={0.01}
                value={prefs.max_stake ?? ""}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    max_stake: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="input"
                placeholder="unset"
              />
            </Field>
            <Field label="Max daily loss">
              <input
                type="number"
                min={0}
                step={0.01}
                value={prefs.max_daily_loss ?? ""}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    max_daily_loss: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="input"
                placeholder="unset"
              />
            </Field>
            <label className="flex items-center gap-2 col-span-full">
              <input
                type="checkbox"
                checked={prefs.alert_sound}
                onChange={(e) => setPrefs({ ...prefs, alert_sound: e.target.checked })}
              />
              <span>Play sound on high-confidence signals</span>
            </label>
          </div>
          <button
            onClick={savePrefs}
            disabled={saving}
            className="mt-2 px-4 py-2 rounded-md bg-secondary hover:bg-secondary/70 text-sm"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </section>
      )}
      <style>{`.input{height:36px;padding:0 10px;border-radius:6px;background:hsl(var(--secondary)/.4);border:1px solid hsl(var(--border));color:inherit;font-size:13px;width:100%}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
