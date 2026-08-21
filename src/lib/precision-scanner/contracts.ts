// Contract definitions for the Multimarket Precision Scanner.
export type PrecisionContractId = "OVER1" | "OVER2" | "OVER3" | "UNDER6" | "UNDER7" | "UNDER8";

export type PrecisionContractDef = {
  id: PrecisionContractId;
  label: string;
  side: "OVER" | "UNDER";
  barrier: number;
  fullWinners: number[];
  keyWinners: number[];
  losers: number[];
  gateDigit: number;
};

export const CONTRACT_DEFS: Record<PrecisionContractId, PrecisionContractDef> = {
  OVER1: {
    id: "OVER1",
    label: "Over 1",
    side: "OVER",
    barrier: 1,
    fullWinners: [2, 3, 4, 5, 6, 7, 8, 9],
    keyWinners: [2, 3, 4, 5, 6],
    losers: [0, 1],
    gateDigit: 0,
  },
  OVER2: {
    id: "OVER2",
    label: "Over 2",
    side: "OVER",
    barrier: 2,
    fullWinners: [3, 4, 5, 6, 7, 8, 9],
    keyWinners: [3, 4, 5, 6, 7],
    losers: [0, 1, 2],
    gateDigit: 0,
  },
  OVER3: {
    id: "OVER3",
    label: "Over 3",
    side: "OVER",
    barrier: 3,
    fullWinners: [4, 5, 6, 7, 8, 9],
    keyWinners: [4, 5, 6, 7, 8],
    losers: [0, 1, 2, 3],
    gateDigit: 0,
  },
  UNDER6: {
    id: "UNDER6",
    label: "Under 6",
    side: "UNDER",
    barrier: 6,
    fullWinners: [0, 1, 2, 3, 4, 5],
    keyWinners: [1, 2, 3, 4, 5],
    losers: [6, 7, 8, 9],
    gateDigit: 9,
  },
  UNDER7: {
    id: "UNDER7",
    label: "Under 7",
    side: "UNDER",
    barrier: 7,
    fullWinners: [0, 1, 2, 3, 4, 5, 6],
    keyWinners: [2, 3, 4, 5, 6],
    losers: [7, 8, 9],
    gateDigit: 9,
  },
  UNDER8: {
    id: "UNDER8",
    label: "Under 8",
    side: "UNDER",
    barrier: 8,
    fullWinners: [0, 1, 2, 3, 4, 5, 6, 7],
    keyWinners: [3, 4, 5, 6, 7],
    losers: [8, 9],
    gateDigit: 9,
  },
};

export const PRECISION_CONTRACTS: PrecisionContractId[] = [
  "OVER1",
  "OVER2",
  "OVER3",
  "UNDER6",
  "UNDER7",
  "UNDER8",
];

/** Win check for a resolved tick digit. */
export function isWinningDigit(id: PrecisionContractId, digit: number): boolean {
  const def = CONTRACT_DEFS[id];
  return def.side === "OVER" ? digit > def.barrier : digit < def.barrier;
}
