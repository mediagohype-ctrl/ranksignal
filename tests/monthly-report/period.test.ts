import { describe, expect, it } from "vitest";
import { PERIOD_TIMEZONE_NOTE, isPeriodClosed, isValidPeriod, periodLabel, periodOf, periodRange, previousPeriod } from "@/lib/monthly-report/period";

describe("period helpers (UTC month boundaries)", () => {
  it("validates YYYY-MM", () => {
    expect(isValidPeriod("2026-10")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("2026-1")).toBe(false);
    expect(isValidPeriod(202610)).toBe(false);
  });

  it("returns a UTC range with an exclusive end, including December rollover", () => {
    expect(periodRange("2026-10")).toEqual({ start: new Date("2026-10-01T00:00:00.000Z"), end: new Date("2026-11-01T00:00:00.000Z") });
    expect(periodRange("2026-12").end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(() => periodRange("bad")).toThrow();
  });

  it("previous period handles January", () => {
    expect(previousPeriod(new Date("2026-11-02T10:00:00Z"))).toBe("2026-10");
    expect(previousPeriod(new Date("2027-01-01T00:00:00Z"))).toBe("2026-12");
  });

  it("uses UTC, not IST: 1 Nov 02:00 IST is still October in UTC", () => {
    // 2026-11-01 02:00 IST = 2026-10-31 20:30 UTC
    const d = new Date("2026-11-01T02:00:00+05:30");
    expect(periodOf(d)).toBe("2026-10");
    expect(isPeriodClosed("2026-10", d)).toBe(false);
    expect(isPeriodClosed("2026-10", new Date("2026-11-01T05:30:00+05:30"))).toBe(true);
    expect(PERIOD_TIMEZONE_NOTE).toMatch(/UTC/);
    expect(PERIOD_TIMEZONE_NOTE).toMatch(/05:30 IST/);
  });

  it("labels periods", () => {
    expect(periodLabel("2026-10")).toBe("October 2026");
  });
});
