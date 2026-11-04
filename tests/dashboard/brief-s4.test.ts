// Brief v1, stream S4: role names, settings defaults, time zones, "Recommended instead", score history points.
import { describe, expect, it } from "vitest";
import { roleLabel } from "@/components/app/role-label";
import {
  isAutoFixOn, isPaused, mergeSettingsPatch, patchNeedsAdmin, projectPatchSchema, readFacts, readNotificationPrefs, readSchedule,
  wantsEmail,
} from "@/lib/dashboard/project-schema";
import { isValidTimeZone, mePatchSchema } from "@/lib/user-prefs";
import {
  correctionTaskTitle, groupByQuestion, joinNames, recommendedInstead, runProviders, wrongFacts, type AnswerObservation,
} from "@/lib/dashboard/ai-answers";
import { buildScorePoints, scoreChange, type ScoreRow } from "@/components/app/history/score-points";

const plan = { name: "Starter", maxPagesPerCrawl: 250, minScanIntervalDays: 7 };

describe("roleLabel", () => {
  it("shows Owner / Can approve / View only", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("admin")).toBe("Can approve");
    expect(roleLabel("member")).toBe("Can approve");
    expect(roleLabel("viewer")).toBe("View only");
    expect(roleLabel(null)).toBe("");
    expect(roleLabel("support_agent")).toBe("Support agent");
  });
});

describe("settings defaults", () => {
  it("emails on, schedules on, auto-fix off, paused off for a new project", () => {
    for (const settings of [null, undefined, {}, { notifications: {} }]) {
      expect(readNotificationPrefs(settings)).toEqual({ email: true, monthlyReport: true, fixesWaiting: true, checkFailed: true });
      expect(readSchedule(settings)).toEqual({ crawl: "weekly", visibility: "monthly" });
      expect(isAutoFixOn(settings)).toBe(false);
      expect(isPaused(settings)).toBe(false);
    }
  });

  it("reads switched-off emails, auto-fix and pause", () => {
    const s = { notifications: { monthlyReport: false }, automation: { allowClassB: ["update_title"] }, paused: true };
    expect(readNotificationPrefs(s).monthlyReport).toBe(false);
    expect(readNotificationPrefs(s).checkFailed).toBe(true);
    expect(isAutoFixOn(s)).toBe(true);
    expect(isPaused(s)).toBe(true);
  });

  it("wantsEmail needs both the all-emails switch and the event's own switch", () => {
    expect(wantsEmail({}, "monthlyReport")).toBe(true);
    expect(wantsEmail({ notifications: { email: false } }, "monthlyReport")).toBe(false);
    expect(wantsEmail({ notifications: { email: false } }, null)).toBe(false);
    expect(wantsEmail({ notifications: { checkFailed: false } }, "checkFailed")).toBe(false);
    expect(wantsEmail({ notifications: { checkFailed: false } }, null)).toBe(true);
  });

  it("merges one email switch without dropping the others, and records pause", () => {
    const inc = projectPatchSchema.parse({ settings: { notifications: { fixesWaiting: false }, paused: true } }).settings!;
    const { next, changed } = mergeSettingsPatch({ notifications: { email: true, monthlyReport: false }, share: { token: "x" } }, inc, plan);
    expect(next.notifications).toEqual({ email: true, monthlyReport: false, fixesWaiting: false });
    expect(next.paused).toBe(true);
    expect(next.share).toEqual({ token: "x" });
    expect(changed).toEqual(expect.arrayContaining(["settings.notifications", "settings.paused"]));
  });

  it("pausing needs the Owner or an admin; email switches don't", () => {
    expect(patchNeedsAdmin(projectPatchSchema.parse({ settings: { paused: true } }))).toBe(true);
    expect(patchNeedsAdmin(projectPatchSchema.parse({ settings: { notifications: { monthlyReport: false } } }))).toBe(false);
  });

  it("accepts business facts and rejects unknown keys", () => {
    expect(projectPatchSchema.parse({ facts: { name: " Acme ", city: "Pune", sells: "Cakes" } }).facts).toEqual({
      name: "Acme",
      city: "Pune",
      sells: "Cakes",
    });
    expect(projectPatchSchema.safeParse({ facts: { name: "A", owner: "x" } }).success).toBe(false);
    expect(readFacts({ name: "Acme", city: 3 })).toEqual({ name: "Acme" });
    expect(readFacts(null)).toEqual({});
  });
});

describe("time zones", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it("validates the PATCH /api/me body", () => {
    expect(mePatchSchema.parse({ timeZone: "Europe/London" })).toEqual({ timeZone: "Europe/London" });
    expect(mePatchSchema.parse({ expertMode: true })).toEqual({ expertMode: true });
    expect(mePatchSchema.safeParse({ timeZone: "Not/AZone" }).success).toBe(false);
    expect(mePatchSchema.safeParse({}).success).toBe(false);
    expect(mePatchSchema.safeParse({ expertMode: true, isStaff: true }).success).toBe(false);
  });
});

let seq = 0;
const obs = (o: Partial<AnswerObservation>): AnswerObservation => ({
  id: `o${seq++}`,
  promptId: "p1",
  prompt: "Best freelance site?",
  provider: "openai",
  platformLabel: "ChatGPT",
  brandMentioned: false,
  brandCited: false,
  brandRecommended: false,
  competitorMentions: {},
  rawResponse: "",
  citations: [],
  simulated: false,
  ...o,
});

describe("recommendedInstead", () => {
  it("lists names from answers that didn't name you, most-named first", () => {
    const r = recommendedInstead([
      obs({ competitorMentions: { Upwork: 2, Freelancer: 1 } }),
      obs({ competitorMentions: { freelancer: 2, Fiverr: 1 } }),
      obs({ brandMentioned: true, competitorMentions: { Toptal: 5 } }),
    ]);
    expect(r).toEqual(["Freelancer", "Upwork", "Fiverr"]);
  });

  it("ignores your own names, the brand key and zero counts; caps the list", () => {
    const r = recommendedInstead([obs({ competitorMentions: { Acme: 3, __brand__: 2, Upwork: 0, A: 1, B: 1, C: 1, D: 1 } })], ["acme"]);
    expect(r).toEqual(["A", "B", "C"]);
  });
});

describe("groupByQuestion", () => {
  it("groups by question, marks named when any AI named you, prefers real answers", () => {
    const qs = groupByQuestion([
      obs({ promptId: "p1", brandMentioned: true }),
      obs({ promptId: "p1", provider: "gemini", competitorMentions: { Upwork: 1 } }),
      obs({ promptId: "p2", prompt: "Cheap logo design?", competitorMentions: { Fiverr: 1 } }),
      obs({ promptId: "p3", simulated: true, brandMentioned: true }),
    ]);
    expect(qs.map((q) => [q.promptId, q.named, q.namedCount, q.answers.length])).toEqual([
      ["p1", true, 1, 2],
      ["p2", false, 0, 1],
    ]);
    expect(qs[1].recommendedInstead).toEqual(["Fiverr"]);
  });

  it("falls back to sample answers when there are no real ones", () => {
    expect(groupByQuestion([obs({ simulated: true })])).toHaveLength(1);
  });
});

describe("AI answers helpers", () => {
  it("joins engine names and reads stored providers", () => {
    expect(joinNames(["ChatGPT", "Claude", "ChatGPT", "Gemini"])).toBe("ChatGPT, Claude and Gemini");
    expect(joinNames(["Grok"])).toBe("Grok");
    expect(joinNames([])).toBe("");
    expect(runProviders(["openai", 3, "", "gemini"])).toEqual(["openai", "gemini"]);
    expect(runProviders(null)).toEqual([]);
  });

  it("collects wrong facts, skipping sample runs and duplicates", () => {
    const m = {
      brandKnowledge: [
        { provider: "openai", inaccuracies: ["Closed on Sundays", "closed on sundays "] },
        { provider: "simulated", inaccuracies: ["x"] },
      ],
    };
    expect(wrongFacts(m)).toEqual([{ engine: "openai", statement: "Closed on Sundays" }]);
    expect(wrongFacts({ ...m, simulated: true })).toEqual([]);
    expect(wrongFacts(null)).toEqual([]);
  });

  it("makes a task title that fits 200 characters", () => {
    expect(correctionTaskTitle("Founded in 1990")).toBe("Correct what AI says: Founded in 1990");
    const long = correctionTaskTitle("x".repeat(500));
    expect(long.length).toBe(200);
    expect(long.endsWith("…")).toBe(true);
  });
});

const row = (o: Partial<ScoreRow>): ScoreRow => ({
  id: `r${seq++}`,
  at: "2026-10-01T00:00:00Z",
  crawlRunId: "c1",
  overall: 50,
  seo: 60,
  aeo: 40,
  geo: 30,
  brand: 20,
  promptSetVersion: 1,
  methodologyVersion: "v1",
  ...o,
});

describe("buildScorePoints", () => {
  it("adds a point when an AI check changes the score, so the last point matches Home", () => {
    const { points } = buildScorePoints([
      row({ at: "2026-10-01T00:00:00Z", overall: 50 }),
      row({ at: "2026-10-01T01:00:00Z", overall: 50 }), // AI check, same score: no new point
      row({ at: "2026-10-02T00:00:00Z", overall: 58, geo: 45 }), // AI check changed the score
      row({ at: "2026-10-09T00:00:00Z", crawlRunId: "c2", overall: 63 }),
    ]);
    expect(points.map((p) => p.overall)).toEqual([50, 58, 63]);
    expect(scoreChange(points)).toBe(13);
  });

  it("marks question-list and method changes; no change with one point", () => {
    const { points, markers } = buildScorePoints([
      row({}),
      row({ crawlRunId: "c2", promptSetVersion: 2, methodologyVersion: "v2", overall: 55 }),
    ]);
    expect(markers.map((m) => m.kind).sort()).toEqual(["methodology", "prompt_set"]);
    expect(scoreChange(points.slice(0, 1))).toBeNull();
  });
});
