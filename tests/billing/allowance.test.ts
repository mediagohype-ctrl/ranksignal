import { describe, expect, it } from "vitest";
import { computeAiAllowance, nextUtcMonthStart, outstandingAnswers } from "@/lib/billing/allowance";

const NOW = new Date("2026-11-04T10:00:00Z");

describe("AI answers allowance math", () => {
  it("used = collected + answers still expected by checks in progress; used + left = cap", () => {
    const a = computeAiAllowance({ cap: 1_200, collected: 300, inFlight: [{ sampleSize: 200, collected: 50, failed: 10 }], trial: false, now: NOW });
    expect(a).toEqual({ used: 440, cap: 1_200, left: 760, resetsAt: new Date("2026-12-01T00:00:00Z") });
    expect(a.used + a.left).toBe(a.cap);
  });
  it("never goes below 0 left, and shows used capped at the plan", () => {
    const a = computeAiAllowance({ cap: 300, collected: 290, inFlight: [{ sampleSize: 75, collected: 0, failed: 0 }], trial: false, now: NOW });
    expect(a).toMatchObject({ used: 300, left: 0 });
  });
  it("finished or over-collected runs hold nothing", () => {
    expect(outstandingAnswers({ sampleSize: 30, collected: 28, failed: 2 })).toBe(0);
    expect(outstandingAnswers({ sampleSize: 30, collected: 31, failed: 0 })).toBe(0);
    expect(outstandingAnswers({ sampleSize: 0, collected: 0, failed: 0 })).toBe(0);
  });
  it("trial answers don't reset (resetsAt null)", () => {
    const a = computeAiAllowance({ cap: 30, collected: 12, inFlight: [], trial: true, now: NOW });
    expect(a).toEqual({ used: 12, cap: 30, left: 18, resetsAt: null });
  });
  it("resets at the start of the next UTC month (December rolls the year)", () => {
    expect(nextUtcMonthStart(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
