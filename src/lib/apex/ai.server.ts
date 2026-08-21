// APEX SENTINEL — AI reasoning implementation (server only).
// The AI never produces numbers. It receives structured quantitative evidence
// and returns interpretation only: Analyst -> Devil's Advocate -> Chief.
import { z } from "zod";

const evidenceSchema = z.object({
  engine: z.string(),
  label: z.string(),
  detail: z.string(),
  weight: z.number(),
  n: z.number(),
});

export const briefSchema = z.object({
  symbol: z.string(),
  market: z.string(),
  contract: z.string(),
  opportunity: z.number(),
  confidence: z.number(),
  edgePct: z.number(),
  edgeLowerBoundPct: z.number(),
  quality: z.number(),
  stability: z.number(),
  freshness: z.number(),
  danger: z.number(),
  contradiction: z.number(),
  phase: z.string(),
  regime: z.string(),
  sampleTicks: z.number(),
  empiricalWinPct: z.number(),
  theoreticalWinPct: z.number(),
  supports: z.array(evidenceSchema),
  conflicts: z.array(evidenceSchema),
  runnerUps: z.array(z.object({ market: z.string(), contract: z.string(), score: z.number() })),
  globalDanger: z.number(),

  // ---- Refinement evidence ----
  adjustedWinPct: z.number(),
  winRateIntervalPct: z.tuple([z.number(), z.number()]),
  rateConfidence: z.string(),
  evidenceGrade: z.string(),
  statisticalNotes: z.array(z.string()),
  losingDigits: z.array(z.number()),
  losingDigitThreats: z.array(
    z.object({
      digit: z.number(),
      score: z.number(),
      state: z.string(),
      drivers: z.array(z.string()),
    }),
  ),
  groupThreat: z.number(),
  threatState: z.string(),
  recurrence: z.string(),
  pressureAsymmetry: z.number(),
  criticalConflicts: z.array(z.string()),
  criticalDetail: z.string(),
  barStructure: z.string(),
  increasingDigits: z.array(z.number()),
  decreasingDigits: z.array(z.number()),
  models: z.array(
    z.object({
      label: z.string(),
      status: z.string(),
      probabilityPct: z.number(),
      oosAccuracyPct: z.number(),
      baseRatePct: z.number(),
      testN: z.number(),
      note: z.string(),
    }),
  ),
  modelAgreement: z.number(),
  modelDisagreement: z.string(),
  forwardState: z.object({
    direction: z.string(),
    uncertainty: z.number(),
    horizonTicks: z.number(),
    statement: z.string(),
    risk: z.string(),
    analogueSupport: z.string(),
  }),
  fakeEdgeFailures: z.array(z.string()),
  fakeEdgeVerdict: z.string(),
  battle: z.string(),
  historicalAnalogue: z.string(),
});

export type ApexBrief = z.infer<typeof briefSchema>;

export interface ApexReasoning {
  analyst: string;
  devilsAdvocate: string;
  chief: string;
  available: boolean;
  error?: string;
}

const RULES = `You are part of a quantitative market-intelligence terminal for Deriv synthetic indices.
STRICT RULES:
- Never predict a specific next digit and never claim certainty.
- Never invent probabilities, percentages or scores. Only reference numbers given to you.
- Never describe a model as validated unless its supplied status says VALIDATED. If it says NOT VALIDATED, say so plainly.
- Reason about DIGIT GROUPS: which digits win this contract, which lose it, and which side is gaining pressure.
- Always address the losing digits by name and say whether they are becoming dangerous.
- Treat small samples as weak evidence and say when a pattern is merely unusual rather than useful.
- Speak in relative, uncertainty-aware terms: "current evidence favours X relative to alternatives".
- Be concise, professional and specific. No markdown headings, no bullet symbols, max 130 words.`;

async function callModel(system: string, user: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `${RULES}\n${system}` },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function runReasoningChain(data: ApexBrief): Promise<ApexReasoning> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return {
      analyst: "",
      devilsAdvocate: "",
      chief: "",
      available: false,
      error: "AI unavailable — quantitative engines remain fully operational.",
    };
  }

  const facts = JSON.stringify(data, null, 1);

  try {
    const analyst = await callModel(
      "Role: PRIMARY ANALYST. Explain why this contract currently ranks first. Structure your answer as: what the winning digit group is doing; what the losing digits are doing and whether they are becoming dangerous; what the validated models and statistics actually support; and what would invalidate this.",
      facts,
      apiKey,
    );
    const devilsAdvocate = await callModel(
      "Role: DEVIL'S ADVOCATE. Attack this ranking. Ask whether the edge is just a short-window hit rate, whether the sample is large enough, whether losing digits are quietly building, whether critical digit structures contradict the direction, and whether any model is genuinely validated. Name the strongest specific reason this could be a fake edge.",
      `${facts}\n\nPRIMARY ANALYST SAID:\n${analyst}`,
      apiKey,
    );
    const chief = await callModel(
      "Role: CHIEF INTELLIGENCE. Resolve the disagreement using only the supplied evidence. State the losing-digit threat explicitly, state the level of uncertainty, and end with a clear stance: PROCEED WITH CAUTION, MONITOR, or STAND DOWN.",
      `${facts}\n\nANALYST:\n${analyst}\n\nDEVIL'S ADVOCATE:\n${devilsAdvocate}`,
      apiKey,
    );
    return { analyst, devilsAdvocate, chief, available: true };
  } catch (err) {
    return {
      analyst: "",
      devilsAdvocate: "",
      chief: "",
      available: false,
      error:
        err instanceof Error
          ? `AI interpretation unavailable (${err.message.slice(0, 120)}) — quantitative engines unaffected.`
          : "AI interpretation unavailable — quantitative engines unaffected.",
    };
  }
}
