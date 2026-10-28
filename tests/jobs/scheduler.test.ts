import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/billing/access", () => ({ getOrgAccess: vi.fn() }));
vi.mock("@/lib/billing/ai-limits", () => ({ getVisibilityRunAllowance: vi.fn() }));
vi.mock("@/lib/prompts/service", () => ({ currentPromptSetVersion: vi.fn() }));
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchRunNotifications: vi.fn() }));

import { effectiveIntervalDays, isScanDue, scheduleIdempotencyKey } from "@/lib/jobs/scheduler";
import { readSchedule } from "@/lib/dashboard/project-schema";

const DAY = 86_400_000;
const now = new Date("2026-10-28T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

describe("readSchedule", () => {
  it("defaults to weekly crawl + monthly visibility when absent", () => {
    expect(readSchedule(null)).toEqual({ crawl: "weekly", visibility: "monthly" });
    expect(readSchedule({ schedule: { crawl: "off" } })).toEqual({ crawl: "off", visibility: "monthly" });
    expect(readSchedule({ schedule: { crawl: "hourly", visibility: "weekly" } })).toEqual({ crawl: "weekly", visibility: "weekly" });
  });
});

describe("isScanDue", () => {
  const base = { minScanIntervalDays: 1, hasActiveRun: false, now };
  it("is never due when off or when a run is active", () => {
    expect(isScanDue({ ...base, frequency: "off", lastRunAt: null })).toBe(false);
    expect(isScanDue({ ...base, frequency: "weekly", lastRunAt: ago(30), hasActiveRun: true })).toBe(false);
  });
  it("is due when there has never been a run", () => {
    expect(isScanDue({ ...base, frequency: "monthly", lastRunAt: null })).toBe(true);
  });
  it("weekly: due after 7 days (with small slack), not before", () => {
    expect(isScanDue({ ...base, frequency: "weekly", lastRunAt: ago(6) })).toBe(false);
    expect(isScanDue({ ...base, frequency: "weekly", lastRunAt: ago(7) })).toBe(true);
    expect(isScanDue({ ...base, frequency: "weekly", lastRunAt: new Date(ago(7).getTime() + 10 * 60_000) })).toBe(true);
    expect(isScanDue({ ...base, frequency: "weekly", lastRunAt: new Date(ago(7).getTime() + 3 * 3600_000) })).toBe(false);
  });
  it("monthly: due after 30 days", () => {
    expect(isScanDue({ ...base, frequency: "monthly", lastRunAt: ago(29) })).toBe(false);
    expect(isScanDue({ ...base, frequency: "monthly", lastRunAt: ago(30) })).toBe(true);
  });
  it("respects the plan's minimum interval", () => {
    expect(effectiveIntervalDays("weekly", 14)).toBe(14);
    expect(effectiveIntervalDays("off", 14)).toBeNull();
    expect(isScanDue({ ...base, minScanIntervalDays: 14, frequency: "weekly", lastRunAt: ago(10) })).toBe(false);
    expect(isScanDue({ ...base, minScanIntervalDays: 14, frequency: "weekly", lastRunAt: ago(14) })).toBe(true);
  });
});

describe("scheduleIdempotencyKey", () => {
  it("is stable per kind/project/UTC day", () => {
    expect(scheduleIdempotencyKey("crawl", "p1", now)).toBe("sched:crawl:p1:2026-10-28");
    expect(scheduleIdempotencyKey("visibility", "p1", new Date("2026-10-28T23:59:00Z"))).toBe("sched:visibility:p1:2026-10-28");
  });
});
