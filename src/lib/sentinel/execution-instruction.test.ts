// Tests the SINGLE execution-instruction resolver: Entry Point and Entry
// Trigger must never yield contradictory instructions.
import { describe, expect, it } from "vitest";
import { resolveExecutionInstruction } from "./execution-instruction";
import type { EntryPointReport } from "./entry-point";
import type { EntryTriggerReport } from "./entry-trigger";

function ep(status: EntryPointReport["status"], digit: number | null): EntryPointReport {
  return {
    status,
    preferred: digit === null ? null : ({ digit } as EntryPointReport["preferred"]),
  } as EntryPointReport;
}

function trig(over: Partial<EntryTriggerReport>): EntryTriggerReport {
  return {
    verdict: "FIRST TOUCH FAVOURED",
    preferredTouch: "FIRST",
    nextTouchIsFirst: true,
    nextTouchAligned: true,
    instruction: "measured",
    ...over,
  } as EntryTriggerReport;
}

describe("resolveExecutionInstruction", () => {
  it("blocks when the safety layer blocks", () => {
    const r = resolveExecutionInstruction({ entryPoint: ep("ENTER NOW", 3), blocked: true });
    expect(r.state).toBe("BLOCKED");
    expect(r.actionable).toBe(false);
  });

  it("never fabricates a digit when none is validated", () => {
    const r = resolveExecutionInstruction({ entryPoint: ep("UNVALIDATED", null), blocked: false });
    expect(r.state).toBe("WAIT FOR VALIDATED ENTRY DIGIT");
    expect(r.entryDigit).toBeNull();
  });

  it("defers to Entry Point when trigger history is insufficient", () => {
    const r = resolveExecutionInstruction({
      entryPoint: ep("ARMED", 7),
      entryTrigger: trig({ verdict: "INSUFFICIENT TRIGGER HISTORY", preferredTouch: null }),
      blocked: false,
    });
    expect(r.state).toBe("INSUFFICIENT TRIGGER HISTORY");
    expect(r.actionable).toBe(true);
  });

  it("resolves ENTER NOW + misaligned touch into SKIP NEXT TOUCH, not both", () => {
    const r = resolveExecutionInstruction({
      entryPoint: ep("ENTER NOW", 5),
      entryTrigger: trig({ nextTouchAligned: false, nextTouchIsFirst: false }),
      blocked: false,
    });
    expect(r.state).toBe("SKIP NEXT TOUCH");
    expect(r.actionable).toBe(false);
    expect(r.headline).not.toContain("ENTER NOW");
  });

  it("keeps ENTER NOW when the print is the favoured cohort", () => {
    const r = resolveExecutionInstruction({
      entryPoint: ep("ENTER NOW", 5),
      entryTrigger: trig({ nextTouchAligned: true }),
      blocked: false,
    });
    expect(r.state).toBe("ENTER NOW");
    expect(r.entryDigit).toBe(5);
    expect(r.actionable).toBe(true);
  });

  it("waits for the favoured touch when armed but misaligned", () => {
    const r = resolveExecutionInstruction({
      entryPoint: ep("ARMED", 2),
      entryTrigger: trig({
        preferredTouch: "SUBSEQUENT",
        nextTouchAligned: false,
        nextTouchIsFirst: true,
      }),
      blocked: false,
    });
    expect(r.state).toBe("WAIT FOR SUBSEQUENT TOUCH");
  });
});
