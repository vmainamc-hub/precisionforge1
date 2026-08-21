// Canonical FinalSignal Interface for Precision Parity AI
// Every page, card, scanner, and diagnostic renders this one unified shape.

export interface EngineVote {
  engine: string;
  side: "EVEN" | "ODD" | "NEUTRAL";
  strength: number;
  sampleSize: number;
  detail: string;
}

export interface FinalSignal {
  market: { symbol: string; displayName: string };
  action: "BUY_EVEN" | "BUY_ODD" | "NO_TRADE";
  entryFormula: string;
  focusDigitOrPattern?: { digit?: number; pattern?: string; note: string };
  validity: { minutes: number; expiresAt: string };
  confidence: number;
  edgePercentagePoints: number;
  reasoning: string[];
  vetoes: { engine: string; reason: string }[];
  engineVotes: EngineVote[];
}
