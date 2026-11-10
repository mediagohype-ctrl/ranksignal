import { describe, expect, it } from "vitest";
import {
  consecutiveDown, indexingAlert, isNoindex, isSiteFailure, keyOf, mentionDropPoints, missingIndexablePages, namedByPrompt, newUrgentIssues,
  newlyNoindex, questionChangeAlert, questionChanges, scoreDrop, scoreDropAlert, weekOverWeek,
} from "@/lib/alerts/rules";
import {
  ALERT_RULE_IDS, DEFAULT_ALERT_CONFIG, alertConfigInputSchema, alertLimitsFor, clampThreshold, readAlertConfig, threshold,
} from "@/lib/alerts/config";

describe("alert config", () => {
  it("defaults every rule on with the documented thresholds", () => {
    const c = readAlertConfig(null);
    for (const id of ALERT_RULE_IDS) expect(c.rules[id].enabled).toBe(true);
    expect(threshold(c, "score_drop")).toBe(5);
    expect(threshold(c, "site_down")).toBe(2);
    expect(threshold(c, "ai_mention_drop")).toBe(10);
    expect(threshold(c, "search_clicks_drop")).toBe(30);
    expect(c.channels).toEqual({ inApp: true, email: true, whatsapp: true });
    expect(c.digest).toBe("instant");
    expect(c).toEqual(DEFAULT_ALERT_CONFIG);
  });

  it("clamps thresholds and drops junk from stored JSON", () => {
    const c = readAlertConfig({
      rules: { score_drop: { enabled: false, threshold: 999 }, bogus: { enabled: true }, site_down: { enabled: true, threshold: 0 } },
      channels: { email: false },
      recipients: ["u1", "u1", 5, ""],
      digest: "weekly",
    });
    expect(c.rules.score_drop).toEqual({ enabled: false, threshold: 50 });
    expect(c.rules.site_down.threshold).toBe(1);
    expect(c.channels).toEqual({ inApp: true, email: false, whatsapp: true });
    expect(c.recipients).toEqual(["u1"]);
    expect(c.digest).toBe("instant");
    expect(clampThreshold("new_urgent_problem", 3)).toBeUndefined();
  });

  it("input schema rejects unknown rules and keys", () => {
    const ok = { rules: { score_drop: { enabled: true, threshold: 7 } }, channels: { inApp: true, email: true, whatsapp: false }, recipients: [], digest: "daily" };
    expect(alertConfigInputSchema.safeParse(ok).success).toBe(true);
    expect(alertConfigInputSchema.safeParse({ ...ok, rules: { nope: { enabled: true } } }).success).toBe(false);
    expect(alertConfigInputSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it("has plan limits for every plan and falls back to trial", () => {
    expect(alertLimitsFor("agency").maxRecipients).toBeGreaterThan(alertLimitsFor("starter").maxRecipients);
    expect(alertLimitsFor("unknown")).toEqual(alertLimitsFor("trial"));
  });
});

describe("score drop", () => {
  it("fires at or above the threshold only", () => {
    expect(scoreDrop(70, 65, 5)).toBe(5);
    expect(scoreDrop(70, 66, 5)).toBeNull();
    expect(scoreDrop(60, 70, 5)).toBeNull();
    expect(scoreDrop(null, 50, 5)).toBeNull();
  });
  it("words the alert plainly and marks big drops urgent", () => {
    const a = scoreDropAlert({ projectId: "p1", projectName: "Shop", prev: 80, curr: 68, drop: 12, after: "crawl" });
    expect(a.severity).toBe("urgent");
    expect(a.title).toContain("12 points");
    expect(a.body).toContain("from 80 to 68");
    expect(a.link).toBe("/app/projects/p1/report");
  });
});

describe("new urgent problems", () => {
  it("only counts high-impact issues that weren't high before", () => {
    const prev = [{ id: "a", title: "A", impact: "high" }, { id: "b", title: "B", impact: "medium" }];
    const curr = [{ id: "a", title: "A", impact: "high" }, { id: "b", title: "B", impact: "high" }, { id: "c", title: "C", impact: "high" }, { id: "d", title: "D", impact: "low" }];
    expect(newUrgentIssues(prev, curr).map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("site down", () => {
  it("needs N downs in a row, newest first", () => {
    expect(consecutiveDown([{ down: true }, { down: true }, { down: false }], 2)).toBe(true);
    expect(consecutiveDown([{ down: true }, { down: false }, { down: true }], 2)).toBe(false);
    expect(consecutiveDown([{ down: true }], 2)).toBe(false);
  });
  it("doesn't treat plan limits as the site being down", () => {
    expect(isSiteFailure("Monthly credit quota exceeded")).toBe(false);
    expect(isSiteFailure("Your free trial has ended")).toBe(false);
    expect(isSiteFailure("getaddrinfo ENOTFOUND shop.example")).toBe(true);
    expect(isSiteFailure(null)).toBe(true);
  });
});

describe("AI visibility", () => {
  it("mention drop is measured in percentage points", () => {
    expect(mentionDropPoints(0.5, 0.39, 10)).toBe(11);
    expect(mentionDropPoints(0.5, 0.45, 10)).toBeNull();
    expect(mentionDropPoints(null, 0.1, 10)).toBeNull();
  });
  it("question changes only compare questions asked in both checks", () => {
    const prev = namedByPrompt([
      { promptId: "q1", text: "best cafe", brandMentioned: false },
      { promptId: "q1", text: "best cafe", brandMentioned: true },
      { promptId: "q2", text: "cheap cafe", brandMentioned: true },
      { promptId: "q3", text: "old q", brandMentioned: false },
    ]);
    const curr = namedByPrompt([
      { promptId: "q1", text: "best cafe", brandMentioned: false },
      { promptId: "q2", text: "cheap cafe", brandMentioned: true },
      { promptId: "q3", text: "old q", brandMentioned: true },
      { promptId: "q4", text: "new q", brandMentioned: true },
    ]);
    const ch = questionChanges(prev, curr);
    expect(ch.lost.map((p) => p.promptId)).toEqual(["q1"]);
    expect(ch.gained.map((p) => p.promptId)).toEqual(["q3"]);
    const a = questionChangeAlert({ projectId: "p", projectName: "X", ...ch });
    expect(a.severity).toBe("warning");
    expect(a.body).toContain("“best cafe”");
    expect(a.dedupeKey).toBe(keyOf(["+q3", "-q1"]));
  });
});

describe("indexing", () => {
  const prev = [
    { url: "https://a.in/", statusCode: 200, robotsMeta: null },
    { url: "https://a.in/x", statusCode: 200, robotsMeta: "index,follow" },
    { url: "https://a.in/y", statusCode: 200, robotsMeta: null },
    { url: "https://a.in/z", statusCode: 404, robotsMeta: null },
    { url: "https://a.in/n", statusCode: 200, robotsMeta: "noindex" },
  ];
  const curr = [
    { url: "https://a.in/", statusCode: 200, robotsMeta: null },
    { url: "https://a.in/x", statusCode: 200, robotsMeta: "NOINDEX, follow" },
    { url: "https://a.in/n", statusCode: 200, robotsMeta: "noindex" },
  ];
  it("detects pages that newly became noindex", () => {
    expect(isNoindex("none")).toBe(true);
    expect(newlyNoindex(prev, curr)).toEqual(["https://a.in/x"]);
  });
  it("lists indexable pages that disappeared (robots.txt candidates)", () => {
    expect(missingIndexablePages(prev, curr)).toEqual(["https://a.in/y"]);
  });
  it("is urgent when the whole site is blocked", () => {
    const a = indexingAlert({ projectId: "p", projectName: "X", noindex: [], robotsBlocked: [], blocksEveryone: true });
    expect(a.severity).toBe("urgent");
    expect(a.title).toContain("whole site");
  });
});

describe("Search Console week over week", () => {
  const days = (start: string, values: number[]) =>
    values.map((clicks, i) => ({ date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), clicks }));
  it("compares the last 7 days with the 7 before", () => {
    const r = weekOverWeek(days("2026-10-01", [...Array(7).fill(10), ...Array(7).fill(6)]));
    expect(r).toMatchObject({ previous: 70, current: 42, endDate: "2026-10-14" });
    expect(r!.pct).toBeCloseTo(-0.4);
  });
  it("ignores tiny or patchy data", () => {
    expect(weekOverWeek(days("2026-10-01", [...Array(7).fill(1), ...Array(7).fill(0)]))).toBeNull();
    expect(weekOverWeek(days("2026-10-10", [10, 10, 10]))).toBeNull();
    expect(weekOverWeek([])).toBeNull();
  });
});

describe("dedupe keys", () => {
  it("are order-independent and bounded", () => {
    expect(keyOf(["b", "a"])).toBe(keyOf(["a", "b"]));
    expect(keyOf(Array.from({ length: 50 }, (_, i) => `https://example.com/page-${i}`)).length).toBe(32);
    expect(keyOf([])).toBe("none");
  });
});
