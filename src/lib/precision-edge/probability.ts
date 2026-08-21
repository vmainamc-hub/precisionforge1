// Candidate probability helpers — pure. Used by Probability engine and
// Recommendation engine to score any contract type consistently.
import type { CandidateContract, Tick } from "./types";
import { digit } from "./rolling-store";

export function contractWinProb(ticks: Tick[], c: CandidateContract): number {
  if (ticks.length === 0) return 0;
  let wins = 0;
  const digits = ticks.map((t) => digit(t.price));
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    switch (c.type) {
      case "UNDER":
        if (c.barrier !== undefined && d < c.barrier) wins++;
        break;
      case "OVER":
        if (c.barrier !== undefined && d > c.barrier) wins++;
        break;
      case "MATCHES":
        if (c.barrier !== undefined && d === c.barrier) wins++;
        break;
      case "DIFFERS":
        if (c.barrier !== undefined && d !== c.barrier) wins++;
        break;
      case "EVEN":
        if (d % 2 === 0) wins++;
        break;
      case "ODD":
        if (d % 2 === 1) wins++;
        break;
      case "RISE":
      case "FALL": {
        if (i === 0) continue;
        const up = ticks[i].price > ticks[i - 1].price;
        if ((c.type === "RISE" && up) || (c.type === "FALL" && !up)) wins++;
        break;
      }
    }
  }
  const denom =
    c.type === "RISE" || c.type === "FALL" ? Math.max(1, ticks.length - 1) : ticks.length;
  return wins / denom;
}

export function defaultCandidates(): CandidateContract[] {
  const cs: CandidateContract[] = [];
  for (let b = 4; b <= 8; b++) cs.push({ type: "UNDER", barrier: b, label: `Under ${b}` });
  for (let b = 1; b <= 5; b++) cs.push({ type: "OVER", barrier: b, label: `Over ${b}` });
  cs.push({ type: "EVEN", label: "Even" });
  cs.push({ type: "ODD", label: "Odd" });
  cs.push({ type: "RISE", label: "Rise" });
  cs.push({ type: "FALL", label: "Fall" });
  return cs;
}
