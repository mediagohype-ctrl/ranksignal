import { describe, expect, it } from "vitest";
import {
  approvalsNotice, filterUnsent, jobFailedNotice, plainFailureReason, reportReadyNotice, visibilityReadyNotice,
} from "@/lib/notifications/templates";

const base = { organizationId: "o1", projectId: "p1", projectName: "Acme" };

describe("filterUnsent (dedupe)", () => {
  const a = reportReadyNotice({ ...base, crawlRunId: "c1", pagesCrawled: 10, openBySeverity: { high: 2 } });
  const b = jobFailedNotice({ ...base, kind: "crawl", runId: "c2", error: "boom", errorClass: "transient" });

  it("drops notices already stored with the same org + type + link", () => {
    expect(filterUnsent([a, b], [{ organizationId: "o1", type: "report_ready", link: a.link }])).toEqual([b]);
  });
  it("keeps a notice when only type or org differ", () => {
    expect(filterUnsent([a], [{ organizationId: "o1", type: "job_failed", link: a.link }])).toEqual([a]);
    expect(filterUnsent([a], [{ organizationId: "o2", type: "report_ready", link: a.link }])).toEqual([a]);
  });
  it("dedupes within a batch (lookback overlap)", () => {
    expect(filterUnsent([a, { ...a }, b], [])).toHaveLength(2);
  });
});

describe("templates", () => {
  it("report ready summarises open findings by severity and links to the report", () => {
    const n = reportReadyNotice({ ...base, crawlRunId: "c1", pagesCrawled: 1, openBySeverity: { critical: 1, low: 3 } });
    expect(n.link).toBe("/app/projects/p1/report?run=c1");
    expect(n.body).toContain("1 page");
    expect(n.body).toContain("4 problems to fix: 1 urgent, 3 nice to have");
  });
  it("visibility notice shows rates and labels simulated data", () => {
    const n = visibilityReadyNotice({
      ...base, visibilityRunId: "v1", metrics: { mentionRate: 0.384, citationRate: 0.1, simulated: true }, partial: false,
    });
    expect(n.body).toContain("38%");
    expect(n.body).toContain("10%");
    expect(n.body).toMatch(/simulated/i);
  });
  it("website results: counts the report's grouped issues, never says 'full report' before the AI check", () => {
    const issues = [{ impact: "high" }, { impact: "medium" }, { impact: "medium" }, { impact: "low" }];
    const n = reportReadyNotice({ ...base, crawlRunId: "c1", pagesCrawled: 12, issues, openBySeverity: { high: 40 } });
    expect(n.title).toBe("Your website results are ready — Acme");
    expect(n.body).toContain("4 problems to fix: 1 urgent, 2 important, 1 nice to have");
    expect(JSON.stringify(n)).not.toMatch(/full report/i);
  });
  it("AI results: own title, real question count and answers collected vs expected", () => {
    const n = visibilityReadyNotice({
      ...base, visibilityRunId: "v1", metrics: { mentionRate: 0.2, citationRate: 0.1, collected: 123 }, partial: true, questions: 25, expected: 125,
    });
    expect(n.title).toBe("Your AI results are ready — Acme");
    expect(n.email.paragraphs[0]).toContain("25 questions");
    expect(n.email.paragraphs[0]).toContain("123 answers");
    expect(n.body).toContain("123 of 125 answers");
  });
  it("approvals notice pluralises", () => {
    expect(approvalsNotice({ ...base, workflowRunId: "w", count: 1 }).title).toMatch(/^1 change needs/);
    expect(approvalsNotice({ ...base, workflowRunId: "w", count: 3 }).title).toMatch(/^3 changes need /);
  });
  it("failure reasons are plain and never leak raw errors", () => {
    expect(plainFailureReason("Interrupted (server restart)", "transient")).toMatch(/interrupted/i);
    expect(plainFailureReason("Insufficient credits", "quota")).toMatch(/usage limit/);
    expect(plainFailureReason("Today's AI budget is used up. The rest of the AI check will run tomorrow.", "quota")).toMatch(/finish the rest of your AI check tomorrow/);
    expect(plainFailureReason("Today's AI budget is used up.", "quota")).not.toMatch(/plan's usage limit/);
    expect(plainFailureReason("getaddrinfo ENOTFOUND acme.test", "permanent")).toMatch(/couldn't reach/);
    expect(plainFailureReason("TypeError: x is undefined at /srv/app.js", "transient")).not.toContain("TypeError");
  });
});
