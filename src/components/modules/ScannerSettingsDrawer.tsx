import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CONTRACT_DEFS, PRECISION_CONTRACTS } from "@/lib/precision-scanner/contracts";
import type { ScannerWeights } from "@/lib/precision-scanner/scoring";
import {
  patchScannerSettings,
  resetScannerSettings,
  setWeight,
  useScannerSettings,
} from "@/hooks/useScannerSettings";

function SettingSlider({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium">{label}</span>
        <span className="tabular text-[12px] font-semibold text-[var(--neon)]">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}

const WEIGHT_KEYS: { key: keyof ScannerWeights; label: string; color: string }[] = [
  { key: "manipulation", label: "Manipulation", color: "var(--warn)" },
  { key: "edge", label: "Edge", color: "var(--bull)" },
  { key: "persistence", label: "Persistence", color: "var(--accent)" },
  { key: "pressure", label: "Pressure", color: "var(--neon)" },
];

export function ScannerSettingsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const s = useScannerSettings();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Scanner settings</SheetTitle>
          <SheetDescription>
            Tune the thresholds a setup must clear before a signal fires.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <section className="space-y-4">
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Minimum thresholds
            </h4>
            <SettingSlider
              label="Min final score"
              description="Signals below this composite score are suppressed"
              value={s.minFinalScore}
              min={40}
              max={95}
              step={1}
              onChange={(v) => patchScannerSettings({ minFinalScore: v })}
            />
            <SettingSlider
              label="Max manipulation"
              description="Block setups in distorted markets"
              value={s.maxManipulation}
              min={5}
              max={50}
              step={1}
              onChange={(v) => patchScannerSettings({ maxManipulation: v })}
            />
            <SettingSlider
              label="Coloured digits in zone"
              description="How many building (coloured) digits must sit inside the winning zone — none may sit outside"
              value={s.minBuildingWinners}
              min={2}
              max={6}
              step={1}
              onChange={(v) => patchScannerSettings({ minBuildingWinners: v })}
            />
            <SettingSlider
              label="Min edge"
              description="Winning digits must exceed their fair share by this much"
              value={s.minEdgePct}
              min={0}
              max={5}
              step={0.1}
              suffix="%"
              onChange={(v) => patchScannerSettings({ minEdgePct: Number(v.toFixed(1)) })}
            />
            <SettingSlider
              label="Min persistence"
              description="How long the setup must have been holding"
              value={s.minPersistence}
              min={10}
              max={80}
              step={5}
              onChange={(v) => patchScannerSettings({ minPersistence: v })}
            />
            <SettingSlider
              label="Signal lock duration"
              description="How long a signal stays pinned before it can be removed"
              value={Math.round(s.lockDurationMs / 1000)}
              min={30}
              max={300}
              step={15}
              suffix="s"
              onChange={(v) => patchScannerSettings({ lockDurationMs: v * 1000 })}
            />
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Final score weights
            </h4>
            <div className="flex h-2 overflow-hidden rounded-full">
              {WEIGHT_KEYS.map((w) => (
                <span
                  key={w.key}
                  style={{ width: `${s.weights[w.key] * 100}%`, backgroundColor: w.color }}
                />
              ))}
            </div>
            {WEIGHT_KEYS.map((w) => (
              <SettingSlider
                key={w.key}
                label={`${w.label} weight`}
                description="Other weights rebalance automatically"
                value={Math.round(s.weights[w.key] * 100)}
                min={5}
                max={50}
                step={5}
                suffix="%"
                onChange={(v) => setWeight(w.key, v / 100)}
              />
            ))}
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Contracts to monitor
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {PRECISION_CONTRACTS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-[12px]">
                  <Checkbox
                    checked={s.enabledContracts[c]}
                    onCheckedChange={(v) =>
                      patchScannerSettings({
                        enabledContracts: { ...s.enabledContracts, [c]: Boolean(v) },
                      })
                    }
                  />
                  {CONTRACT_DEFS[c].label}
                </label>
              ))}
            </div>
          </section>

          <Button variant="secondary" className="w-full" onClick={() => resetScannerSettings()}>
            Restore defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
