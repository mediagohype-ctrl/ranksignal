import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/billing/access", () => ({ getOrgAccess: vi.fn() }));
vi.mock("@/lib/prompts/service", () => ({ currentPromptSetVersion: vi.fn() }));
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchRunNotifications: vi.fn() }));

import { canStartScheduledAiCheck } from "@/lib/jobs/scheduler";
import { aiScheduleChosen, defaultAiFrequency, mergeSettingsPatch, readSchedule } from "@/lib/dashboard/project-schema";
import { aiCheckConfirmText, estimateAiCheck } from "@/lib/billing/ai-limits";
import { answersPerCheck, getPlanWithAiLimits, questionsPerCheck } from "@/lib/billing/plans";
import { computeAiAllowance, IN_FLIGHT_RUN_STATUSES } from "@/lib/billing/allowance";

const starter = { planId: "starter", serviceTier: null };
const trial = { planId: "trial", serviceTier: null };

describe("weekly AI checks by default", () => {
  it("is weekly when the plan's monthly AI answers cover four checks; the trial stays monthly", () => {
    expect(getPlanWithAiLimits("starter").aiAnswersPerMonth).toBeGreaterThanOrEqual(4 * answersPerCheck("starter"));
    expect(defaultAiFrequency(starter)).toBe("weekly");
    expect(defaultAiFrequency(trial)).toBe("monthly");
    expect(defaultAiFrequency(null)).toBe("monthly");
    // Done-for-you clients ask every AI tool, so 300 answers don't cover a weekly check of 25 × 5.
    expect(defaultAiFrequency({ planId: "starter", serviceTier: "grow" })).toBe("monthly");
  });

  it("applies to new projects (stored default 'monthly') and projects that never chose", () => {
    expect(readSchedule(null, starter).visibility).toBe("weekly");
    expect(readSchedule({ schedule: { crawl: "weekly", visibility: "monthly" } }, starter).visibility).toBe("weekly");
    expect(readSchedule({ schedule: { crawl: "weekly", visibility: "monthly" } }, trial).visibility).toBe("monthly");
  });

  it("keeps an explicit choice", () => {
    expect(readSchedule({ schedule: { visibility: "off" } }, starter).visibility).toBe("off");
    expect(readSchedule({ schedule: { visibility: "monthly" }, aiScheduleChosen: true }, starter).visibility).toBe("monthly");
    const plan = { name: "Do it myself", maxPagesPerCrawl: 250, minScanIntervalDays: 7 };
    const { next } = mergeSettingsPatch({ schedule: { crawl: "weekly", visibility: "monthly" } }, { schedule: { visibility: "monthly" } }, plan);
    expect(aiScheduleChosen(next)).toBe(true);
    expect(readSchedule(next, starter).visibility).toBe("monthly");
  });
});

describe("automatic AI checks skip quietly when the month's answers run out", () => {
  it("starts only when a full check fits", () => {
    expect(canStartScheduledAiCheck(300, 75)).toBe(true);
    expect(canStartScheduledAiCheck(75, 75)).toBe(true);
    expect(canStartScheduledAiCheck(74, 75)).toBe(false);
    expect(canStartScheduledAiCheck(0, 0)).toBe(false);
  });
  it("a weekly schedule on Do it myself fits exactly four checks a month", () => {
    const per = answersPerCheck("starter");
    let left = getPlanWithAiLimits("starter").aiAnswersPerMonth;
    let ran = 0;
    for (let week = 0; week < 5; week++) {
      if (!canStartScheduledAiCheck(left, per)) continue;
      left -= per;
      ran++;
    }
    expect(ran).toBe(4);
  });
});

describe("the 'Check AI' confirmation", () => {
  it("shows the real numbers for a full check", () => {
    const e = estimateAiCheck({ left: 225, activeQuestions: 30, questionsPerCheck: questionsPerCheck("starter"), engines: 3 });
    expect(e).toMatchObject({ answers: 75, questions: 25, engines: 3, partial: false });
    expect(aiCheckConfirmText(e)).toBe("This uses 75 of your 225 AI answers left this month. Continue?");
  });
  it("says how many questions will be asked when fewer answers are left", () => {
    const e = estimateAiCheck({ left: 30, activeQuestions: 25, questionsPerCheck: 25, engines: 3 });
    expect(e).toMatchObject({ answers: 30, questions: 10, partial: true });
    expect(aiCheckConfirmText(e)).toBe(
      "You have 30 AI answers left this month — not enough for a full check (75). We'll ask 10 of your 25 questions on 3 AI tools. This uses 30 of your 30 AI answers left this month. Continue?",
    );
  });
  it("trial wording, and nothing to confirm for free sample answers or no answers left", () => {
    expect(aiCheckConfirmText(estimateAiCheck({ left: 30, activeQuestions: 10, questionsPerCheck: 10, engines: 3, monthly: false }))).toBe(
      "This uses 30 of your 30 AI answers left in your free trial. Continue?",
    );
    expect(aiCheckConfirmText(estimateAiCheck({ left: 30, activeQuestions: 10, questionsPerCheck: 10, engines: 0 }))).toBeNull();
    expect(aiCheckConfirmText(estimateAiCheck({ left: 0, activeQuestions: 10, questionsPerCheck: 10, engines: 3 }))).toBeNull();
  });
});

describe("a failed or cancelled check gives back the answers it was holding", () => {
  it("only queued/running checks hold answers", () => {
    expect(IN_FLIGHT_RUN_STATUSES).toEqual(["queued", "running"]);
    expect(IN_FLIGHT_RUN_STATUSES).not.toContain("failed");
    expect(IN_FLIGHT_RUN_STATUSES).not.toContain("cancelled");
  });
  it("while waiting it holds the rest; once failed only the answers collected count", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    // Waiting for tomorrow: 1 of 75 collected, 74 still held.
    const waiting = computeAiAllowance({ cap: 300, collected: 1, inFlight: [{ sampleSize: 75, collected: 1, failed: 0 }], trial: false, now });
    expect(waiting.left).toBe(225);
    // Stopped / failed: it is no longer in flight, so only the 1 real answer counts.
    const failed = computeAiAllowance({ cap: 300, collected: 1, inFlight: [], trial: false, now });
    expect(failed.left).toBe(299);
  });
});
