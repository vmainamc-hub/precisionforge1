import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CONTRACT_LABELS,
  ENGINE_LABELS,
  ENTRY_HORIZONS,
  BOT_VETO_LABELS,
  type ContractKey,
  type EngineWeights,
  type PrecisionSettings,
  weightPct,
} from "@/hooks/usePrecisionSettings";

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">{label}</span>
        {value !== undefined && <span className="tabular text-muted-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function SettingsDrawerV2({
  open,
  onOpenChange,
  settings,
  patch,
  setWeight,
  toggleBot,
  toggleVeto,
  reset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: PrecisionSettings;
  patch: (p: Partial<PrecisionSettings>) => void;
  setWeight: (k: keyof EngineWeights, v: number) => void;
  toggleBot: (k: ContractKey, v: boolean) => void;
  toggleVeto: (k: string, v: boolean) => void;
  reset: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto glass border-border/50"
      >
        <SheetHeader>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Settings
          </div>
          <SheetTitle className="text-xl">Scanner configuration</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1 pb-6">
          <Row label="Recommendation threshold" value={String(settings.threshold)}>
            <Slider
              min={50}
              max={95}
              step={1}
              value={[settings.threshold]}
              onValueChange={([v]) => patch({ threshold: v })}
            />
          </Row>

          <Row label="Refresh interval" value={`${settings.refreshMs}ms`}>
            <Slider
              min={1000}
              max={30000}
              step={500}
              value={[settings.refreshMs]}
              onValueChange={([v]) => patch({ refreshMs: v })}
            />
          </Row>

          <Row label="Lookback window" value={`${settings.lookbackTicks} ticks`}>
            <Slider
              min={200}
              max={1500}
              step={50}
              value={[settings.lookbackTicks]}
              onValueChange={([v]) => patch({ lookbackTicks: v })}
            />
          </Row>

          <Row label="Minimum market health" value={String(settings.minMarketHealth)}>
            <Slider
              min={30}
              max={95}
              step={1}
              value={[settings.minMarketHealth]}
              onValueChange={([v]) => patch({ minMarketHealth: v })}
            />
          </Row>

          <Row label="Minimum persistence" value={String(settings.minPersistence)}>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[settings.minPersistence]}
              onValueChange={([v]) => patch({ minPersistence: v })}
            />
          </Row>

          <Row label="Minimum stability" value={String(settings.minStability)}>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[settings.minStability]}
              onValueChange={([v]) => patch({ minStability: v })}
            />
          </Row>

          <Row label="Minimum bot compatibility" value={String(settings.minBotCompatibility)}>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[settings.minBotCompatibility]}
              onValueChange={([v]) => patch({ minBotCompatibility: v })}
            />
          </Row>

          <Row label="Min consecutive zone digits" value={String(settings.minZoneDigits)}>
            <Slider
              min={1}
              max={6}
              step={1}
              value={[settings.minZoneDigits]}
              onValueChange={([v]) => patch({ minZoneDigits: v })}
            />
          </Row>

          <Row label="Hysteresis (top-pick switch delta)" value={settings.hysteresis.toFixed(1)}>
            <Slider
              min={0}
              max={20}
              step={0.5}
              value={[settings.hysteresis]}
              onValueChange={([v]) => patch({ hysteresis: v })}
            />
          </Row>

          <Row label="Signal minimum lifetime" value={`${settings.minHoldSeconds}s`}>
            <Slider
              min={30}
              max={300}
              step={5}
              value={[settings.minHoldSeconds]}
              onValueChange={([v]) => patch({ minHoldSeconds: v })}
            />
          </Row>

          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">Auto-scan at refresh interval</span>
            <Switch checked={settings.autoScan} onCheckedChange={(v) => patch({ autoScan: v })} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">
              Only recommend contracts matching an enabled bot
            </span>
            <Switch
              checked={settings.onlyEnabledBot}
              onCheckedChange={(v) => patch({ onlyEnabledBot: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              AI entry horizon
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Expected time between AI recommendation and DBot entry.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ENTRY_HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => patch({ entryHorizon: h })}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs tabular transition-colors",
                    settings.entryHorizon === h
                      ? "border-[var(--primary)]/60 bg-[var(--primary)]/15 text-[var(--primary)]"
                      : "border-border/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {h}s
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Bot profiles
            </div>
            {(Object.keys(CONTRACT_LABELS) as ContractKey[]).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{CONTRACT_LABELS[k]}</span>
                <Switch
                  checked={settings.enabledBots[k]}
                  onCheckedChange={(v) => toggleBot(k, v)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Engine weights
            </div>
            {ENGINE_LABELS.map(({ key, label }) => (
              <Row
                key={key}
                label={`${label} — ${weightPct(settings.weights, key)}%`}
                value={String(settings.weights[key])}
              >
                <Slider
                  min={0}
                  max={30}
                  step={1}
                  value={[settings.weights[key]]}
                  onValueChange={([v]) => setWeight(key, v)}
                />
              </Row>
            ))}
          </div>

          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Equilibrium Doctrine · Primary law
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A signal is only produced when Over 4 / Under 5 sit at 50% within the tolerance below,
              measured over the full window. Anything outside is a hard block — no exceptions.
            </p>
            <Row
              label="Equilibrium tolerance"
              value={`50% ± ${settings.equilibriumTolerance.toFixed(2)}%`}
            >
              <Slider
                min={0.1}
                max={4}
                step={0.05}
                value={[settings.equilibriumTolerance]}
                onValueChange={([v]) => patch({ equilibriumTolerance: v })}
              />
            </Row>
            <Row
              label="Edge balance tolerance (0,1 vs 8,9)"
              value={`± ${settings.edgeImbalanceTolerance.toFixed(1)}pp`}
            >
              <Slider
                min={0.5}
                max={8}
                step={0.1}
                value={[settings.edgeImbalanceTolerance]}
                onValueChange={([v]) => patch({ edgeImbalanceTolerance: v })}
              />
            </Row>
            <Row label="Measurement window" value={`${settings.botWindowTicks} ticks`}>
              <Slider
                min={200}
                max={1000}
                step={50}
                value={[settings.botWindowTicks]}
                onValueChange={([v]) => patch({ botWindowTicks: v })}
              />
            </Row>
            <Row
              label="Min simulated win rate"
              value={`${(settings.minSimWinRate * 100).toFixed(0)}%`}
            >
              <Slider
                min={0.4}
                max={0.9}
                step={0.01}
                value={[settings.minSimWinRate]}
                onValueChange={([v]) => patch({ minSimWinRate: v })}
              />
            </Row>
            <Row
              label="Max equilibrium drift"
              value={`${settings.maxDriftVelocity.toFixed(2)}pp/100t`}
            >
              <Slider
                min={0.2}
                max={5}
                step={0.1}
                value={[settings.maxDriftVelocity]}
                onValueChange={([v]) => patch({ maxDriftVelocity: v })}
              />
            </Row>
            <Row label="Martingale ladder depth" value={`${settings.martingaleDepth} steps`}>
              <Slider
                min={1}
                max={12}
                step={1}
                value={[settings.martingaleDepth]}
                onValueChange={([v]) => patch({ martingaleDepth: v })}
              />
            </Row>
            <Row
              label="Min calibration reliability"
              value={`${(settings.minCalibrationReliability * 100).toFixed(0)}%`}
            >
              <Slider
                min={0}
                max={0.9}
                step={0.05}
                value={[settings.minCalibrationReliability]}
                onValueChange={([v]) => patch({ minCalibrationReliability: v })}
              />
            </Row>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Veto stack
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Each veto is a hard block on the bot verdict. Switch one off and the engine stops
              using it when deciding whether the bot may run.
            </p>
            {BOT_VETO_LABELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{label}</span>
                <Switch
                  checked={settings.botVetoes[key] !== false}
                  onCheckedChange={(v) => toggleVeto(key, v)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Hard gates · Edge / Manipulation / Fluctuation / Persistence
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pass/fail vetoes applied to every market, every path, including the global scanner. A
              setup failing any one of them is discarded outright — no confidence shaving, no
              overrides. Tighter values mean fewer, higher-quality trades.
            </p>
            <Row label="Max manipulation" value={`${settings.maxManipulation}%`}>
              <Slider
                min={5}
                max={60}
                step={1}
                value={[settings.maxManipulation]}
                onValueChange={([v]) => patch({ maxManipulation: v })}
              />
            </Row>
            <Row
              label="Min persistence (winning streak)"
              value={`${settings.minPersistenceTicks} ticks`}
            >
              <Slider
                min={0}
                max={12}
                step={1}
                value={[settings.minPersistenceTicks]}
                onValueChange={([v]) => patch({ minPersistenceTicks: v })}
              />
            </Row>
            <Row label="Min replay edge / trade" value={`${settings.minEdgePct.toFixed(1)}%`}>
              <Slider
                min={-20}
                max={8}
                step={0.5}
                value={[settings.minEdgePct]}
                onValueChange={([v]) => patch({ minEdgePct: v })}
              />
            </Row>
            <Row label="Fluctuation tolerance" value={settings.fluctuationTolerance.toFixed(2)}>
              <Slider
                min={0.05}
                max={1}
                step={0.01}
                value={[settings.fluctuationTolerance]}
                onValueChange={([v]) => patch({ fluctuationTolerance: v })}
              />
            </Row>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Fluctuation measures how far the Over-4% reading disagrees across the measurement
              windows. 0.20 ≈ 1pp of spread; anything above the tolerance is vetoed as an unstable
              tape.
            </p>
          </div>

          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Noise filter
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Removes flicker without locking out trades: a setup must survive several consecutive
              scans, clear a fused-score floor, and respect a short cooldown after the previous
              signal expires.
            </p>
            <Row label="Confirmation scans" value={`${settings.confirmationScans} scans`}>
              <Slider
                min={1}
                max={6}
                step={1}
                value={[settings.confirmationScans]}
                onValueChange={([v]) => patch({ confirmationScans: v })}
              />
            </Row>
            <Row label="Min signal score" value={String(settings.minSignalScore)}>
              <Slider
                min={0}
                max={90}
                step={1}
                value={[settings.minSignalScore]}
                onValueChange={([v]) => patch({ minSignalScore: v })}
              />
            </Row>
            <Row label="Cooldown after signal" value={`${settings.signalCooldownSeconds}s`}>
              <Slider
                min={0}
                max={180}
                step={5}
                value={[settings.signalCooldownSeconds]}
                onValueChange={([v]) => patch({ signalCooldownSeconds: v })}
              />
            </Row>
          </div>

          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Reasoning (V3)
            </div>
            <Row label="Minimum sub-edges (of 7)" value={String(settings.minSubEdges)}>
              <Slider
                min={2}
                max={7}
                step={1}
                value={[settings.minSubEdges]}
                onValueChange={([v]) => patch({ minSubEdges: v })}
              />
            </Row>
            <Row
              label="Historical agreement floor"
              value={settings.historicalAgreementMin.toFixed(2)}
            >
              <Slider
                min={0.3}
                max={0.95}
                step={0.01}
                value={[settings.historicalAgreementMin]}
                onValueChange={([v]) => patch({ historicalAgreementMin: v })}
              />
            </Row>
            <Row
              label="Migration stability floor"
              value={settings.migrationStabilityMin.toFixed(2)}
            >
              <Slider
                min={0.1}
                max={0.95}
                step={0.01}
                value={[settings.migrationStabilityMin]}
                onValueChange={([v]) => patch({ migrationStabilityMin: v })}
              />
            </Row>
            <Row
              label="Pattern similarity boost"
              value={settings.patternSimilarityBoost.toFixed(2)}
            >
              <Slider
                min={0}
                max={0.5}
                step={0.01}
                value={[settings.patternSimilarityBoost]}
                onValueChange={([v]) => patch({ patternSimilarityBoost: v })}
              />
            </Row>
          </div>

          <Button variant="outline" className="w-full" onClick={reset}>
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
