// A month with nothing done leads with the next fix, not a report of zeros (audit fix 16), and the monthly report
// counts problems the same way as every other screen (fix 9).
import { describe, expect, it } from "vitest";
import { classifyProblems, nothingDone } from "@/lib/monthly-report/compute";
import { monthlyNudge, monthlyReportEmail, monthlyReportNotice } from "@/lib/monthly-report/email";
import type { MonthlyReportPayload } from "@/lib/monthly-report/types";

const emptyIssues = { fixed: { total: 0, top: [] }, new: { total: 0, top: [] }, openBySeverity: { critical: 0, high: 6, medium: 10, low: 8, info: 0, total: 24 } };

function payload(over: Partial<MonthlyReportPayload> = {}): MonthlyReportPayload {
  return {
    version: "monthly-1", period: "2026-10", periodLabel: "October 2026",
    range: { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z", timezone: "UTC" }, generatedAt: "2026-11-01T00:00:00.000Z",
    project: { id: "p1", name: "Acme", brand: "Acme", domain: "acme.example", websiteUrl: "https://acme.example" }, serviceTier: null,
    dataSources: { crawlSnapshots: 1, visibilitySnapshots: 0, visibilityRuns: 0, providers: [], summarySource: "template" },
    headline: { gains: [], risks: [], nextActions: [] },
    scores: { start: { at: null, overall: null, grade: null }, end: { at: null, overall: 49, grade: "F" }, overallDelta: null, pillars: [], baselineFromPreviousPeriod: false },
    aiVisibility: { measured: false, startRunAt: null, endRunAt: null, start: null, end: null, likeForLike: null, engines: [], competitorShare: [], promptsWon: [], promptsLost: [] },
    issues: emptyIssues,
    topFix: { id: "geo-entity_clarity", title: "AI has to guess who you are", minutes: 15, points: 5 },
    work: { shipped: [], byPerformer: { agency: 0, client: 0, system: 0 } },
    nextMonth: [], wrongAnswers: [], attribution: "a", notes: [],
    ...over,
  };
}

describe("nothing-done month", () => {
  it("leads with the real top fix and a free call, never a line of zeros", () => {
    const p = payload();
    expect(nothingDone(p)).toBe(true);
    const n = monthlyNudge(p)!;
    expect(n.headline).toBe("You haven't fixed anything yet.");
    expect(n.fix).toBe("Fix #1 — “AI has to guess who you are” — takes about 15 minutes and adds 5 points to your score.");
    const mail = monthlyReportEmail(p, "summary", "https://app.test");
    expect(mail.text).not.toMatch(/Work done: 0|Problems fixed: 0/);
    expect(mail.text).toContain("Or let our team do it: book a free call: https://app.test/");
    expect(mail.text).toContain("Start fix #1");
    expect(mail.text).toContain("/app/projects/p1/todo/geo-entity_clarity");
    expect(monthlyReportNotice(p).body).not.toMatch(/0 items done/);
  });
  it("offers the referral with its real terms (no 'give a month')", () => {
    const mail = monthlyReportEmail(payload(), "summary", "https://app.test");
    expect(mail.text).toContain("Invite a business, get a free month");
    expect(mail.text).toContain("starts paying, you get one month free");
    expect(mail.text).not.toMatch(/give a month/i);
  });
  it("a month with work done keeps the normal report", () => {
    const p = payload({ work: { shipped: [{ kind: "task", title: "x", category: "c", performedBy: "client", completedAt: "2026-10-05T00:00:00Z" }], byPerformer: { agency: 0, client: 1, system: 0 } } });
    expect(monthlyNudge(p)).toBeNull();
    expect(monthlyReportEmail(p, "summary", "https://app.test").text).toContain("Work done: 1.");
  });
});

describe("classifyProblems — problem types, not pages", () => {
  const row = (id: string, impact: string, affectedCount = 10) => ({ id, title: id, impact, affectedCount });
  it("open = end report list; fixed / new = list differences", () => {
    const r = classifyProblems([row("b", "high"), row("c", "medium"), row("d", "low")], [row("a", "high", 40), row("b", "high")], null);
    expect(r.openBySeverity).toEqual({ critical: 0, high: 1, medium: 1, low: 1, info: 0, total: 3 });
    expect(r.fixed.total).toBe(1);
    expect(r.fixed.top[0]).toMatchObject({ code: "a", count: 40 });
    expect(r.new.total).toBe(2);
  });
});
