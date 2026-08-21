import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TERMINAL_CONFIG,
  ENTRY_HORIZONS,
  WEIGHT_LABELS,
  weightPct,
  type TerminalConfig,
} from "@/lib/precision-edge/terminal";

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">{label}</span>
        <span className="tabular text-muted-foreground">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function SettingsDrawer({
  open,
  onOpenChange,
  config,
  setConfig,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: TerminalConfig;
  setConfig: (c: TerminalConfig) => void;
}) {
  const patch = (p: Partial<TerminalConfig>) => setConfig({ ...config, ...p });
  const setWeight = (key: string, v: number) =>
    setConfig({ ...config, weights: { ...config.weights, [key]: v } });

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

        <div className="mt-6 space-y-6 px-1">
          <Row label="Recommendation threshold" value={String(config.threshold)}>
            <Slider
              min={50}
              max={90}
              step={1}
              value={[config.threshold]}
              onValueChange={([v]) => patch({ threshold: v })}
            />
          </Row>
          <Row label="Minimum market health" value={String(config.minMarketHealth)}>
            <Slider
              min={30}
              max={90}
              step={1}
              value={[config.minMarketHealth]}
              onValueChange={([v]) => patch({ minMarketHealth: v })}
            />
          </Row>
          <Row label="Min consecutive zone digits" value={String(config.minZoneDigits)}>
            <Slider
              min={1}
              max={6}
              step={1}
              value={[config.minZoneDigits]}
              onValueChange={([v]) => patch({ minZoneDigits: v })}
            />
          </Row>
          <Row label="Hysteresis (top-pick switch delta)" value={config.hysteresis.toFixed(1)}>
            <Slider
              min={0}
              max={15}
              step={0.5}
              value={[config.hysteresis]}
              onValueChange={([v]) => patch({ hysteresis: v })}
            />
          </Row>

          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">Auto-scan at refresh interval</span>
            <Switch checked={config.autoScan} onCheckedChange={(v) => patch({ autoScan: v })} />
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              AI entry horizon
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Expected time between AI recommendation and DBot entry. Used by the Entry Window
              Prediction Engine.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ENTRY_HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => patch({ entryHorizon: h })}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs tabular transition-colors",
                    config.entryHorizon === h
                      ? "border-[var(--primary)]/60 bg-[var(--primary)]/15 text-[var(--primary)]"
                      : "border-border/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {h}s
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Engine weights
            </div>
            {WEIGHT_LABELS.map(({ key, label }) => (
              <Row key={key} label={label} value={`${weightPct(config.weights, key)}%`}>
                <Slider
                  min={0}
                  max={30}
                  step={1}
                  value={[config.weights[key] ?? 0]}
                  onValueChange={([v]) => setWeight(key, v)}
                />
              </Row>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setConfig(DEFAULT_TERMINAL_CONFIG)}
          >
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
