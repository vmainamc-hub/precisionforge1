import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadXml } from "@/lib/deriv/dbot-xml";
import { Upload, Download, Trash2, FileCode2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/bot-library")({
  head: () => ({ meta: [{ title: "DBot Library — Precision Edge" }] }),
  component: BotLibraryPage,
});

type Bot = {
  id: string;
  name: string;
  description: string | null;
  xml: string;
  source: string;
  created_at: string;
};

function BotLibraryPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await (supabase.from as any)("bots")
      .select("*")
      .order("created_at", { ascending: false });
    setBots((data ?? []) as Bot[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const xml = await file.text();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await (supabase.from as any)("bots").insert({
        user_id: userData.user.id,
        name: file.name.replace(/\.xml$/i, ""),
        description: null,
        xml,
        source: "upload",
      });
      await load();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    await (supabase.from as any)("bots").delete().eq("id", id);
    await load();
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCode2 size={22} className="text-[var(--neon)]" /> DBot Library
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload, save and download DBot-compatible XML strategies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            onChange={onUpload}
            className="hidden"
          />
          <button
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-md bg-secondary hover:bg-secondary/70 text-sm flex items-center gap-2"
          >
            <Upload size={14} /> Upload XML
          </button>
          <Link
            to="/app/bot-builder"
            className="px-4 py-2 rounded-md bg-[var(--neon)] text-[var(--primary-foreground)] font-medium text-sm flex items-center gap-2"
          >
            <Plus size={14} /> Build new
          </Link>
        </div>
      </div>

      {bots.length === 0 ? (
        <div className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">
          No bots yet. Upload a DBot XML or create one in the Bot Builder.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bots.map((b) => (
            <div key={b.id} className="glass rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {b.source} · {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
                  {(b.xml.length / 1024).toFixed(1)}kb
                </span>
              </div>
              {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => downloadXml(b.name, b.xml)}
                  className="flex-1 h-8 rounded-md bg-secondary hover:bg-secondary/70 text-xs flex items-center justify-center gap-1"
                >
                  <Download size={11} /> Download
                </button>
                <button
                  onClick={() => remove(b.id)}
                  className="w-8 h-8 rounded-md bg-[var(--bear)]/20 text-[var(--bear)] hover:bg-[var(--bear)]/30 flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
