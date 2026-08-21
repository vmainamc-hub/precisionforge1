import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/apex/EvidencePanel";
import { marketProfiles, type Bucket, type MarketProfile } from "@/lib/apex/profiles";
import { engineEffectiveness, type EngineRecord } from "@/lib/apex/engine-effectiveness";
import { calibrationTable } from "@/lib/apex/memory";

const card = "rounded-xl border border-border bg-card p-4";

function rate(b: Bucket) {
  return `${((b.wins / b.n) * 100).toFixed(1)}% (N=${b.n})`;
}

function BucketList({
  title,
  items,
  empty,
  tone = "var(--bull)",
}: {
  title: string;
  items: Bucket[];
  empty: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {items.length ? (
        <ul className="mt-1 space-y-0.5">
          {items.map((b) => (
            <li key={b.key} className="text-[11px] text-foreground">
              <span className="font-mono" style={{ color: tone }}>
                {rate(b)}
              </span>{" "}
              {b.key}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function ProfileCard({ p, scope }: { p: MarketProfile; scope: "MARKET" | "GLOBAL" }) {
  const dangerous = Object.entries(p.dangerousDigits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <div className={card}>
      <SectionTitle
        hint={`${p.trades} resolved · ${scope === "GLOBAL" ? "secondary prior only" : "isolated to this market"}`}
      >
        {p.name}
      </SectionTitle>
      {p.trades === 0 ? (
        <p className="text-xs text-muted-foreground">
          No resolved contract outcomes yet — this market starts with no learned behaviour and
          builds its own profile.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {p.wins} wins / {p.losses} losses · net {p.netPnl.toFixed(2)} stake units.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <BucketList
              title="Best contracts"
              items={marketProfiles.best(p.contracts)}
              empty="Sample too small."
            />
            <BucketList
              title="Best entry conditions"
              items={marketProfiles.best(p.entryConditions)}
              empty="No entry condition has enough resolutions yet."
            />
            <BucketList
              title="Best regimes"
              items={marketProfiles.best(p.regimes)}
              empty="Sample too small."
            />
            <BucketList
              title="Best psychology configurations"
              items={marketProfiles.best(p.psychology)}
              empty="Psychology configurations still accumulating outcomes."
            />
            <BucketList
              title="Weakest patterns"
              items={marketProfiles.worst(p.contracts)}
              empty="Sample too small."
              tone="var(--bear)"
            />
            <BucketList
              title="Score calibration"
              items={marketProfiles.best(p.scoreBands, 8, 5)}
              empty="Sample too small."
            />
          </div>
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Dangerous digits (resolved losses on)
            </div>
            <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--bear)" }}>
              {dangerous.length
                ? dangerous.map(([d, c]) => `${d}×${c}`).join("  ")
                : "none recorded"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/** "WHAT SENTINEL HAS LEARNED" — market-specific first, global as a prior. */
export function LearningDashboard() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = marketProfiles.subscribe(() => setTick((t) => t + 1));
    const t = setInterval(() => setTick((x) => x + 1), 8000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  const markets = marketProfiles.all();
  const global = marketProfiles.global();
  const engines: EngineRecord[] = engineEffectiveness();
  const calibration = calibrationTable();

  return (
    <div className="space-y-5">
      <div className={card}>
        <SectionTitle hint="persisted — survives restart">What Sentinel has learned</SectionTitle>
        <p className="text-xs text-muted-foreground">
          Learning is stored per market and per contract. A market never inherits another market's
          statistics; global learning below is a secondary prior computed by aggregating the
          individual records.
        </p>
      </div>

      <ProfileCard p={global} scope="GLOBAL" />

      {markets.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {markets.map((p) => (
            <ProfileCard key={p.symbol} p={p} scope="MARKET" />
          ))}
        </div>
      ) : (
        <div className={card}>
          <p className="text-xs text-muted-foreground">
            No market has resolved a contract-simulated trade yet. Profiles appear as soon as the
            per-market simulators resolve their first entries.
          </p>
        </div>
      )}

      <div className={card}>
        <SectionTitle hint="measured against real contract outcomes">
          Engine effectiveness
        </SectionTitle>
        {engines.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 pr-3">Engine</th>
                  <th className="py-1 pr-3">Resolved</th>
                  <th className="py-1 pr-3">Win rate</th>
                  <th className="py-1 pr-3">Expectancy</th>
                  <th className="py-1 pr-3">Trend</th>
                  <th className="py-1 pr-3">Effect</th>
                  <th className="py-1">Influence</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {engines.map((e) => (
                  <tr key={e.engine} className="border-t border-border/60">
                    <td className="py-1 pr-3 text-foreground">{e.engine}</td>
                    <td className="py-1 pr-3">{e.n}</td>
                    <td className="py-1 pr-3">{e.n ? `${(e.winRate * 100).toFixed(1)}%` : "—"}</td>
                    <td
                      className="py-1 pr-3"
                      style={{ color: e.expectancy >= 0 ? "var(--bull)" : "var(--bear)" }}
                    >
                      {e.n ? `${e.expectancy >= 0 ? "+" : ""}${e.expectancy.toFixed(3)}` : "—"}
                    </td>
                    <td
                      className="py-1 pr-3"
                      style={{ color: e.deteriorationPp >= 0 ? "var(--bull)" : "var(--bear)" }}
                    >
                      {e.n
                        ? `${e.deteriorationPp >= 0 ? "+" : ""}${e.deteriorationPp.toFixed(1)}pp`
                        : "—"}
                    </td>
                    <td className="py-1 pr-3">{e.effect}</td>
                    <td className="py-1">{e.influence.toFixed(2)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Engine effectiveness needs resolved outcomes before it can report.
          </p>
        )}
      </div>

      <div className={card}>
        <SectionTitle hint="observed vs claimed">Confidence calibration</SectionTitle>
        {calibration.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {calibration.map((c) => (
              <div key={c.decile} className="rounded-md border border-border/60 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.decile * 10}-{c.decile * 10 + 9}
                </div>
                <div className="font-mono text-[11px] text-foreground">
                  {(c.rate * 100).toFixed(1)}% (N={c.n})
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Calibration is still accumulating observations.
          </p>
        )}
      </div>
    </div>
  );
}
