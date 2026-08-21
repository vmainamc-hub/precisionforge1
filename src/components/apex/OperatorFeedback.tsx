// APEX SENTINEL — WRITTEN OPERATOR FEEDBACK & TRADE DEBRIEF (additive, guides next signals).
//
// Two strictly separate things live here:
//   TRADE FEEDBACK / REPORT — a post-trade debrief attached to a confirmed WIN/LOSS trade
//                              that directly guides upcoming signals via Channel 1.
//   SIGNAL OBSERVATION       — a note about a signal that was NOT traded.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RankedOpportunity } from "@/lib/apex/types";
import {
  FEEDBACK_CATEGORIES,
  addObservation,
  deleteObservation,
  deleteTradeFeedback,
  listTrades,
  observationsFor,
  saveTradeFeedback,
  tradeFeedbackFor,
  updateObservation,
  type FeedbackCategory,
  type TradeRecord,
} from "@/lib/sentinel/trade-feedback";
import { activeDirectives, interpretFeedbackPreview } from "@/lib/sentinel/immediate-guidance";
import {
  createGlobalVetoRule,
  isExplicitGlobalVetoRequest,
  isExplicitVetoReleaseRequest,
  recordPatternOutcome,
  releaseAllGlobalVetoRules,
} from "@/lib/sentinel/global-veto";
import { buildPatternTags } from "@/lib/sentinel/pattern-tags";
import { useGuidanceRevision, useTradeFeedbackVersion } from "@/components/apex/TradeFeedback";

function fmt(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const LOSS_QUICK_TAGS = [
  {
    label: "Late Entry Timing",
    text: "Entered late due to hesitation / execution delay.",
    cat: "ENTRY TOO LATE" as FeedbackCategory,
  },
  {
    label: "Losing Digit Burst",
    text: "Losing digit burst/spiked repeatedly against contract.",
    cat: "ENTRY DIGIT" as FeedbackCategory,
  },
  {
    label: "Pressure Reversal",
    text: "Losing-side pressure flipped and took control.",
    cat: "PRESSURE REVERSAL" as FeedbackCategory,
  },
  {
    label: "Choppy Market",
    text: "Market was choppy, erratic and volatile.",
    cat: "DANGER" as FeedbackCategory,
  },
  {
    label: "Wrong Entry Digit",
    text: "Selected entry digit failed, avoid and pick runner-up.",
    cat: "ENTRY DIGIT" as FeedbackCategory,
  },
  {
    label: "Market Rotation",
    text: "Market rotated / behavior shifted; fresh proof needed.",
    cat: "MARKET ROTATION" as FeedbackCategory,
  },
  {
    label: "Cool Down / Pause",
    text: "Cool down and pause trading this asset for now.",
    cat: "OTHER" as FeedbackCategory,
  },
];

const WIN_QUICK_TAGS = [
  {
    label: "Clean Execution",
    text: "Clean entry and swift win; setup executed perfectly.",
    cat: "STRONG SIGNAL" as FeedbackCategory,
  },
  {
    label: "Target Digit Solid",
    text: "Entry digit confirmed working consistently.",
    cat: "STRONG SIGNAL" as FeedbackCategory,
  },
  {
    label: "Strong Trend",
    text: "Winning side maintained full pressure control.",
    cat: "STRONG SIGNAL" as FeedbackCategory,
  },
  {
    label: "Pattern Held",
    text: "Observed pattern and psychology held cleanly.",
    cat: "ENTRY QUALITY" as FeedbackCategory,
  },
];

function CategoryPicker({
  value,
  onChange,
}: {
  value: FeedbackCategory | null;
  onChange: (c: FeedbackCategory | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FEEDBACK_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(value === c ? null : c)}
          className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors"
          style={{
            borderColor: value === c ? "var(--neon)" : "var(--border)",
            backgroundColor:
              value === c ? "rgba(var(--neon-rgb, 14, 165, 233), 0.1)" : "transparent",
            color: value === c ? "var(--neon)" : "var(--muted-foreground)",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** Live card showing how the user's report will steer upcoming signals. */
export function GuidanceLivePreview({
  text,
  category,
  snapshot,
  outcome,
}: {
  text: string;
  category: FeedbackCategory | null;
  snapshot: TradeRecord["snapshot"];
  outcome?: TradeRecord["outcome"] | null;
}) {
  const derived = useMemo(
    () => interpretFeedbackPreview(text, category, snapshot, outcome),
    [text, category, snapshot, outcome],
  );

  const isPositive = derived.rankingAdjustment > 0 || derived.entryDigitAdjustment > 0;
  const isNegative = derived.rankingAdjustment < 0 || derived.entryDigitAdjustment < 0;

  return (
    <div className="rounded-md border border-border/80 bg-background/80 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground font-semibold flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--neon)] animate-pulse" />
          How Sentinel will guide upcoming signals
        </span>
        <span
          className="font-mono text-[10px] font-bold"
          style={{
            color: isPositive
              ? "var(--bull)"
              : isNegative
                ? "var(--warn)"
                : "var(--muted-foreground)",
          }}
        >
          Ranking: {derived.rankingAdjustment > 0 ? "+" : ""}
          {derived.rankingAdjustment.toFixed(1)} pts
          {derived.entryDigitAdjustment !== 0
            ? ` · Entry Digit: ${derived.entryDigitAdjustment > 0 ? "+" : ""}${derived.entryDigitAdjustment.toFixed(1)} pts`
            : ""}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-foreground">
        • Directive: <span className="text-foreground/90">{derived.label}</span>
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">
        • Guidance: {derived.guidanceAdvice}
      </p>
    </div>
  );
}

/**
 * Step 2: Post-Trade Report & Debrief Composer.
 * Guides the user in debriefing their WIN or LOSS to immediately influence following signals.
 */
export function TradeDebriefComposer({
  trade,
  onFinish,
}: {
  trade: TradeRecord;
  onFinish?: () => void;
}) {
  const [text, setText] = useState(trade.feedback?.text ?? "");
  const [category, setCategory] = useState<FeedbackCategory | null>(
    trade.feedback?.category ?? null,
  );
  const [saved, setSaved] = useState(false);

  const isLoss = trade.outcome === "LOSS";
  const isWin = trade.outcome === "WIN";
  const tags = isLoss ? LOSS_QUICK_TAGS : isWin ? WIN_QUICK_TAGS : [];

  const handleApplyTag = (tag: (typeof tags)[0]) => {
    if (!text.trim()) {
      setText(tag.text);
    } else if (!text.includes(tag.text)) {
      setText((prev) => `${prev.trim()} ${tag.text}`);
    }
    setCategory(tag.cat);
  };

  const handleSave = () => {
    if (!text.trim()) return;
    const firstSave = !trade.feedback;
    saveTradeFeedback(trade.id, text, category);

    // LEVEL 1/2 GOVERNANCE — explicit operator veto language creates a hard,
    // cross-market pattern rule; ordinary feedback keeps flowing through the
    // bounded immediate-guidance channel only.
    const pattern = {
      tags: buildPatternTags({
        contractId: trade.snapshot.contract,
        side: trade.snapshot.contract.toUpperCase().startsWith("UNDER") ? "UNDER" : "OVER",
        entryDigit: trade.snapshot.entryDigit,
      }),
      contracts: [trade.snapshot.contract],
      entryDigit: trade.snapshot.entryDigit,
    };
    if (firstSave && (trade.outcome === "WIN" || trade.outcome === "LOSS")) {
      recordPatternOutcome(pattern, trade.outcome, trade.snapshot.symbol);
    }
    if (isExplicitVetoReleaseRequest(text)) {
      releaseAllGlobalVetoRules();
    } else if (isExplicitGlobalVetoRequest(text)) {
      createGlobalVetoRule({
        sourceId: trade.id,
        operatorText: text,
        pattern,
        reason: category ? `Operator veto — ${category}` : "Operator veto after reported loss",
        scope: "GLOBAL",
      });
    }
    setSaved(true);
    if (onFinish) onFinish();
  };

  return (
    <div className="rounded-lg border border-border/80 bg-background/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                backgroundColor: isWin
                  ? "rgba(var(--bull-rgb, 34, 197, 94), 0.15)"
                  : "rgba(var(--bear-rgb, 239, 68, 68), 0.15)",
                color: isWin ? "var(--bull)" : "var(--bear)",
              }}
            >
              TRADE RESOLVED: {trade.outcome}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {trade.snapshot.symbol} · {trade.snapshot.contractLabel}
              {trade.snapshot.entryDigit !== null
                ? ` · Entry Digit ${trade.snapshot.entryDigit}`
                : ""}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-foreground">
            Step 2: Write your Trade Report to guide upcoming signals
          </p>
          <p className="text-[10px] text-muted-foreground">
            What you write here is interpreted by Sentinel to adjust candidate ranking and entry
            points for following signals.
          </p>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Quick one-tap observation tags:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => handleApplyTag(tag)}
                className="rounded border border-border/70 bg-card/60 px-2 py-1 text-[10px] hover:border-[var(--neon)] hover:bg-card transition-all text-left"
              >
                + {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isLoss
              ? "Describe what happened... (e.g. 'Digit 7 spiked twice then reversed', 'I entered 1 tick late', 'Market was very choppy')."
              : "Describe what went well... (e.g. 'Clean win, digit 4 held perfect pressure', 'Trend follow-through was smooth')."
          }
          rows={3}
          className="text-xs leading-relaxed"
        />
        <div className="pt-1">
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
      </div>

      {text.trim() && (
        <GuidanceLivePreview
          text={text}
          category={category}
          snapshot={trade.snapshot}
          outcome={trade.outcome}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-[11px] font-semibold"
            disabled={!text.trim()}
            onClick={handleSave}
          >
            {saved ? "Report saved · Guidance Active" : "Apply Report & Guide Next Signals"}
          </Button>
          {onFinish && (
            <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onFinish}>
              {saved || !text.trim() ? "Done" : "Cancel"}
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {saved
            ? "✓ Guidance in effect across future signal generation passes"
            : "Reports stay active for 30 minutes with graceful decay"}
        </p>
      </div>
    </div>
  );
}

function Composer({
  title,
  placeholder,
  initialText,
  initialCategory,
  onSave,
  onCancel,
}: {
  title: string;
  placeholder: string;
  initialText?: string;
  initialCategory?: FeedbackCategory | null;
  onSave: (text: string, category: FeedbackCategory | null) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [category, setCategory] = useState<FeedbackCategory | null>(initialCategory ?? null);
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 text-xs"
      />
      <div className="mt-2">
        <CategoryPicker value={category} onChange={setCategory} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-[11px]"
          disabled={!text.trim()}
          onClick={() => onSave(text, category)}
        >
          Save feedback & guide signals
        </Button>
        {onCancel ? (
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <p className="text-[10px] text-muted-foreground">
          Optional. A category is never required — free text is always enough.
        </p>
      </div>
    </div>
  );
}

function SavedNote({
  text,
  category,
  ts,
  tradeRecord,
  onEdit,
  onDelete,
}: {
  text: string;
  category: FeedbackCategory | null;
  ts: number;
  tradeRecord?: TradeRecord | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  useGuidanceRevision();
  const liveDirectives = activeDirectives();
  const matchedDirective = tradeRecord
    ? liveDirectives.find((d) => d.sourceId === `trade:${tradeRecord.id}`)
    : null;

  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--bull)] font-semibold">
          ✓ Trade Report Active · Guiding Signals
        </p>
        {matchedDirective && (
          <span className="font-mono text-[10px] text-[var(--warn)] font-medium">
            Expires{" "}
            {new Date(matchedDirective.expiresAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-foreground font-normal">&ldquo;{text}&rdquo;</p>

      {matchedDirective && (
        <div className="rounded bg-card/60 p-2 border border-border/50 text-[10px]">
          <p className="font-medium text-foreground">
            • Directive in force: {matchedDirective.label}
          </p>
          <p className="text-muted-foreground">• {matchedDirective.guidanceAdvice}</p>
          <p className="mt-0.5 font-mono text-muted-foreground">
            Score adjustment: {matchedDirective.rankingAdjustment > 0 ? "+" : ""}
            {matchedDirective.rankingAdjustment.toFixed(1)} pts
            {matchedDirective.entryDigitAdjustment !== 0
              ? ` · Entry Digit: ${matchedDirective.entryDigitAdjustment > 0 ? "+" : ""}${matchedDirective.entryDigitAdjustment.toFixed(1)} pts`
              : ""}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
        <span>
          Recorded {fmt(ts)}
          {category ? ` · ${category}` : ""}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={onEdit}>
            Edit Report
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Written note on an explicitly marked trade. */
export function TradeFeedbackNoteEditor({ tradeId }: { tradeId: string }) {
  useTradeFeedbackVersion();
  const [editing, setEditing] = useState(false);
  const note = tradeFeedbackFor(tradeId);
  const trade = listTrades().find((t) => t.id === tradeId) ?? null;

  if (note && !editing) {
    return (
      <SavedNote
        text={note.text}
        category={note.category}
        ts={note.updatedAt ?? note.ts}
        tradeRecord={trade}
        onEdit={() => setEditing(true)}
        onDelete={() => deleteTradeFeedback(tradeId)}
      />
    );
  }

  if (trade && (trade.outcome === "WIN" || trade.outcome === "LOSS") && (editing || !note)) {
    return (
      <TradeDebriefComposer trade={trade} onFinish={note ? () => setEditing(false) : undefined} />
    );
  }

  return (
    <Composer
      title="Operator feedback"
      placeholder="Tell Sentinel what happened..."
      initialText={note?.text}
      initialCategory={note?.category ?? null}
      onSave={(text, category) => {
        saveTradeFeedback(tradeId, text, category);
        setEditing(false);
      }}
      onCancel={note ? () => setEditing(false) : undefined}
    />
  );
}

/** Note about a signal the operator did NOT trade. Never an outcome. */
export function SignalObservationEditor({ item }: { item: RankedOpportunity }) {
  useTradeFeedbackVersion();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const notes = observationsFor(item.symbol, item.contract.id);

  return (
    <div className="space-y-2">
      {open ? (
        <Composer
          title="Signal observation · not a trade"
          placeholder="I did not trade this. What did you notice? (Guides subsequent signals without recording trade outcome)"
          onSave={(text, category) => {
            addObservation(item, text, category);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[11px]"
            onClick={() => setOpen(true)}
          >
            Add observation
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Observations are recorded as notes only — they guide upcoming signals without counting
            as a WIN or LOSS.
          </p>
        </div>
      )}

      {notes.length ? (
        <div className="space-y-2">
          {notes.slice(0, 5).map((o) =>
            editingId === o.observationId ? (
              <Composer
                key={o.observationId}
                title="Edit observation"
                placeholder="Update your observation..."
                initialText={o.text}
                initialCategory={o.category}
                onSave={(text, category) => {
                  updateObservation(o.observationId, text, category);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SavedNote
                key={o.observationId}
                text={o.text}
                category={o.category}
                ts={o.updatedAt ?? o.ts}
                onEdit={() => setEditingId(o.observationId)}
                onDelete={() => deleteObservation(o.observationId)}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
