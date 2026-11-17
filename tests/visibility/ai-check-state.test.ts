import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/billing/ai-limits", () => ({ getRunPromptCap: async () => 50, aiLimitMessage: () => "", sizeRunToAllowance: () => ({ questions: 0, engines: 0 }) }));
vi.mock("@/lib/providers/visibility/registry", () => ({ getAvailableProviders: async () => [] }));
vi.mock("@/lib/snapshots", () => ({ writeSnapshot: async () => {} }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: async () => ({}) }));

import { aiCheckCopy, aiCheckInFlight, aiCheckStateOf, aiProgressLabel, readDeferral, withLiveAiSentence } from "@/lib/visibility/run-state";
import { deferralDecision, finalRunStatus, MAX_AI_DEFERRALS } from "@/lib/visibility/job";
import { AiBudgetError, aiBudgetPeriod, isAiBudgetExhausted } from "@/lib/billing/ai-budget";
import { firstMentionNotice, mentioningTools, pausedNotice } from "@/lib/visibility/notify";
import { plainFailureReason, visibilityReadyNotice } from "@/lib/notifications/templates";

const now = new Date("2026-11-15T10:00:00Z");
const run = { id: "v1", status: "queued", collected: 1, sampleSize: 75 };

describe("AI check state (running vs waiting until tomorrow)", () => {
  it("is 'waiting_tomorrow' while the resume workflow is queued for later with a deferral marker", () => {
    const wf = { state: "queued", runAfter: new Date("2026-11-16T00:07:00Z"), input: { deferrals: 1, deferReason: "daily" } };
    const s = aiCheckStateOf(run, wf, { now });
    expect(s).toMatchObject({ state: "waiting_tomorrow", collected: 1, expected: 75, reason: "daily", deferrals: 1, resumeAt: "2026-11-16T00:07:00.000Z" });
    expect(aiCheckInFlight(s)).toBe(true);
    const copy = aiCheckCopy(s)!;
    expect(copy.detail).toBe(
      "We collected 1 of 75 answers so far. Today's AI limit is reached, so we'll collect the rest automatically tomorrow. Nothing you need to do.",
    );
    expect(copy.detail).not.toContain("email");
  });

  it("is 'running' once the resume time has passed, or without a marker", () => {
    const wf = { state: "queued", runAfter: new Date("2026-11-15T09:00:00Z"), input: { deferrals: 1 } };
    expect(aiCheckStateOf({ ...run, status: "running", collected: 12 }, wf, { now }).state).toBe("running");
    expect(aiCheckStateOf(run, { state: "queued", runAfter: new Date("2026-11-20T00:00:00Z"), input: {} }, { now }).state).toBe("running");
    const s = aiCheckStateOf({ ...run, status: "running", collected: 12 }, null, { now });
    expect(aiProgressLabel(s)).toBe("12 of 75 answers in");
    expect(aiCheckCopy(s, { willEmail: true })!.detail).toContain("We'll email you when it's done.");
  });

  it("maps finished / failed / none", () => {
    expect(aiCheckStateOf({ ...run, status: "succeeded_with_warnings" }, null).state).toBe("done");
    expect(aiCheckStateOf({ ...run, status: "failed" }, null).state).toBe("failed");
    expect(aiCheckStateOf({ ...run, status: "cancelled" }, null).state).toBe("failed");
    expect(aiCheckStateOf(null, null).state).toBe("none");
    expect(aiCheckCopy(aiCheckStateOf(null, null))).toBeNull();
    expect(aiProgressLabel({ collected: 0, expected: 0 })).toBe("Getting started…");
  });

  it("reads the deferral marker defensively and swaps the stale 'not asked yet' sentence", () => {
    expect(readDeferral(null)).toEqual({ deferrals: 0, reason: "daily" });
    expect(readDeferral({ deferrals: "2", deferReason: "monthly" })).toEqual({ deferrals: 2, reason: "monthly" });
    const text = "Score 58. We haven't asked real AI assistants about you yet — run an AI check to see how often they name Acme. Bye.";
    expect(withLiveAiSentence(text, { title: "Your AI check is running", short: "12 of 75 answers in" })).toBe(
      "Score 58. Your AI check is running (12 of 75 answers in). Bye.",
    );
    expect(withLiveAiSentence(text, null)).toBe(text);
  });
});

describe("deferrals are limited", () => {
  it("waits for tomorrow on the daily limit, up to MAX_AI_DEFERRALS times", () => {
    expect(deferralDecision({ priorDeferrals: 0, reason: "daily", now })).toBe("defer");
    expect(deferralDecision({ priorDeferrals: MAX_AI_DEFERRALS - 1, reason: "daily", now })).toBe("defer");
    expect(deferralDecision({ priorDeferrals: MAX_AI_DEFERRALS, reason: "daily", now })).toBe("stop");
  });
  it("stops at once on the monthly limit, unless tomorrow is a new month", () => {
    expect(deferralDecision({ priorDeferrals: 0, reason: "monthly", now })).toBe("stop");
    expect(deferralDecision({ priorDeferrals: 0, reason: "monthly", now: new Date("2026-11-30T20:00:00Z") })).toBe("defer");
  });
  it("finishes with what was collected", () => {
    expect(finalRunStatus({ collected: 0, failures: 0, stoppedByLimit: true })).toBe("failed");
    expect(finalRunStatus({ collected: 1, failures: 0, stoppedByLimit: true })).toBe("succeeded_with_warnings");
    expect(finalRunStatus({ collected: 75, failures: 0, stoppedByLimit: false })).toBe("succeeded");
    expect(finalRunStatus({ collected: 70, failures: 5, stoppedByLimit: false })).toBe("succeeded_with_warnings");
  });
  it("tells the daily cap from the monthly cap", () => {
    expect(aiBudgetPeriod(new AiBudgetError("x", "platform"))).toBe("daily");
    expect(aiBudgetPeriod(new AiBudgetError("x", "workspace"))).toBe("daily");
    const monthly = new AiBudgetError("x", "workspace", true);
    expect(aiBudgetPeriod(monthly)).toBe("monthly");
    expect(isAiBudgetExhausted(monthly)).toBe(true);
  });
});

describe("owner messages", () => {
  it("pause notice says how many answers came in and that nothing is needed", () => {
    const n = pausedNotice({ projectName: "Pubesto", collected: 1, expected: 75, reason: "daily" });
    expect(n.body).toBe(
      "We collected 1 of 75 AI answers so far. Today's AI limit is reached, so we'll collect the rest automatically tomorrow. There's nothing you need to do.",
    );
    expect(n.email.subject).toBe("Your AI check for Pubesto will finish tomorrow");
  });
  it("explains a check stopped by the limit (with and without answers)", () => {
    expect(plainFailureReason("AI limit reached several days in a row: the AI check was stopped with no answers", "quota")).toContain("back in your allowance");
    const ok = visibilityReadyNotice({
      organizationId: "o",
      projectId: "p",
      projectName: "Acme",
      visibilityRunId: "v",
      metrics: { collected: 40, mentionRate: 0.1, citationRate: 0 },
      partial: true,
      expected: 75,
      stoppedByLimit: true,
    });
    expect(ok.body).toContain("we got 40 of 75 answers");
    expect(ok.body).toContain("back in your AI answers for this month");
  });
});

describe("first mention", () => {
  const rows = [
    { provider: "openrouter:openai/gpt-4o", brandMentioned: true, simulated: false },
    { provider: "openrouter:openai/gpt-4o", brandMentioned: true, simulated: false },
    { provider: "perplexity", brandMentioned: true, simulated: false },
    { provider: "gemini", brandMentioned: false, simulated: false },
    { provider: "simulated", brandMentioned: true, simulated: true },
  ];
  it("names the real AI tools, most mentions first, ignoring sample answers", () => {
    expect(mentioningTools(rows)).toEqual(["ChatGPT", "Perplexity"]);
    expect(firstMentionNotice({ rows, mentionedBefore: false })?.title).toBe("ChatGPT and Perplexity named you for the first time!");
    expect(firstMentionNotice({ rows: [rows[0]], mentionedBefore: false })?.title).toBe("ChatGPT named you for the first time!");
  });
  it("only the first time, and never for sample-only data", () => {
    expect(firstMentionNotice({ rows, mentionedBefore: true })).toBeNull();
    expect(firstMentionNotice({ rows: [rows[4]], mentionedBefore: false })).toBeNull();
    expect(firstMentionNotice({ rows: [rows[3]], mentionedBefore: false })).toBeNull();
  });
});
