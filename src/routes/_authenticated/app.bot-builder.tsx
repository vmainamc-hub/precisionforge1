import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toDBotXml, downloadXml, type BuilderStrategy } from "@/lib/deriv/dbot-xml";
import { useStream } from "@/lib/stream-context";
import { Wand2, Save, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/bot-builder")({
  head: () => ({ meta: [{ title: "Bot Builder — Precision Edge" }] }),
  component: BotBuilderPage,
});

const CONTRACTS = [
  { code: "CALL", label: "Rise" },
  { code: "PUT", label: "Fall" },
  { code: "DIGITEVEN", label: "Even" },
  { code: "DIGITODD", label: "Odd" },
  { code: "DIGITOVER", label: "Over" },
  { code: "DIGITUNDER", label: "Under" },
  { code: "DIGITMATCH", label: "Matches" },
  { code: "DIGITDIFF", label: "Differs" },
];

function BotBuilderPage() {
  const nav = useNavigate();
  const { symbols } = useStream();
  const [strat, setStrat] = useState<BuilderStrategy>({
    name: "My Strategy",
    description: "",
    market: "R_100",
    contract_type: "DIGITUNDER",
    stake: 1,
    duration: 5,
    duration_unit: "t",
    prediction: 7,
    martingale: 1,
    take_profit: null,
    stop_loss: null,
  });
  const [saving, setSaving] = useState(false);
  const xml = toDBotXml(strat);
  const needsBarrier = ["DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF"].includes(
    strat.contract_type,
  );

  async function saveBot() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await (supabase.from as any)("bots").insert({
        user_id: userData.user.id,
        name: strat.name,
        description: strat.description || null,
        xml,
        source: "builder",
      });
      nav({ to: "/app/bot-library" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 size={22} className="text-[var(--neon)]" /> Bot Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Compose a strategy visually — exports to DBot-compatible XML.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest">Strategy</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Name" full>
              <input
                value={strat.name}
                onChange={(e) => setStrat({ ...strat, name: e.target.value })}
                className="tk-input"
              />
            </Field>
            <Field label="Description" full>
              <input
                value={strat.description}
                onChange={(e) => setStrat({ ...strat, description: e.target.value })}
                className="tk-input"
              />
            </Field>
            <Field label="Market">
              <select
                value={strat.market}
                onChange={(e) => setStrat({ ...strat, market: e.target.value })}
                className="tk-input"
              >
                {symbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contract type">
              <select
                value={strat.contract_type}
                onChange={(e) => setStrat({ ...strat, contract_type: e.target.value })}
                className="tk-input"
              >
                {CONTRACTS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stake">
              <input
                type="number"
                min={0.35}
                step={0.01}
                value={strat.stake}
                onChange={(e) => setStrat({ ...strat, stake: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Duration">
              <input
                type="number"
                min={1}
                value={strat.duration}
                onChange={(e) => setStrat({ ...strat, duration: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Unit">
              <select
                value={strat.duration_unit}
                onChange={(e) => setStrat({ ...strat, duration_unit: e.target.value as any })}
                className="tk-input"
              >
                <option value="t">Ticks</option>
                <option value="s">Seconds</option>
                <option value="m">Minutes</option>
                <option value="h">Hours</option>
              </select>
            </Field>
            {needsBarrier && (
              <Field label="Prediction (0-9)">
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={strat.prediction ?? 5}
                  onChange={(e) => setStrat({ ...strat, prediction: Number(e.target.value) })}
                  className="tk-input"
                />
              </Field>
            )}
            <Field label="Martingale ×">
              <input
                type="number"
                min={1}
                step={0.1}
                value={strat.martingale ?? 1}
                onChange={(e) => setStrat({ ...strat, martingale: Number(e.target.value) })}
                className="tk-input"
              />
            </Field>
            <Field label="Take profit">
              <input
                type="number"
                step={0.01}
                value={strat.take_profit ?? ""}
                onChange={(e) =>
                  setStrat({
                    ...strat,
                    take_profit: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="tk-input"
                placeholder="unset"
              />
            </Field>
            <Field label="Stop loss">
              <input
                type="number"
                step={0.01}
                value={strat.stop_loss ?? ""}
                onChange={(e) =>
                  setStrat({
                    ...strat,
                    stop_loss: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="tk-input"
                placeholder="unset"
              />
            </Field>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={saveBot}
              disabled={saving}
              className="flex-1 h-10 rounded-md bg-[var(--neon)] text-[var(--primary-foreground)] font-medium text-sm flex items-center justify-center gap-2"
            >
              <Save size={13} /> {saving ? "Saving…" : "Save to library"}
            </button>
            <button
              onClick={() => downloadXml(strat.name, xml)}
              className="h-10 px-4 rounded-md bg-secondary hover:bg-secondary/70 text-sm flex items-center gap-2"
            >
              <Download size={13} /> XML
            </button>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-2">DBot XML preview</h2>
          <pre className="text-[10px] font-mono bg-secondary/40 rounded-md p-3 overflow-auto max-h-[540px] whitespace-pre">
            {xml}
          </pre>
        </div>
      </div>
      <style>{`.tk-input{height:34px;width:100%;padding:0 10px;border-radius:6px;background:hsl(var(--secondary)/.4);border:1px solid hsl(var(--border));color:inherit;font-size:13px}`}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
