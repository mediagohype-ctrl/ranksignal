import { describe, expect, it } from "vitest";
import { dueTrialNudge, trialEndingSoon, trialNudgeKey } from "@/lib/growth/nudges";
import { fixOfWeekKey, issuePoints, pickFixOfWeek } from "@/lib/growth/fix-of-week";
import { newlyNamedCompetitors } from "@/lib/growth/competitors";
import { badgeUrls, escapeXml, renderBadgeSvg } from "@/lib/growth/badge";
import { formatE164, isE164, normalizeE164 } from "@/lib/growth/e164";
import { isoWeekKey, isSendingHour, isWeeklySendDay } from "@/lib/growth/periods";
import { scoreGain, fixesWaitingText } from "@/lib/growth/whatsapp-updates";
import { generateReferralCode, normalizeReferralCode, referralCodeFromUrl, REFERRAL_ALPHABET } from "@/lib/growth/referral";
import { buildAiGuideFile, buildFaqJsonLd, faqScriptTag, isToolName, toolLeadSource } from "@/lib/growth/tools";
import { aiNamedCounts } from "@/lib/growth/paths";
import type { ReportIssue, SiteReport } from "@/lib/report/types";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-11-01T06:00:00Z");
const end = new Date(start.getTime() + 7 * DAY);
const at = (days: number) => new Date(start.getTime() + days * DAY);

describe("trial nudges", () => {
  it("picks the one nudge due for the day", () => {
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(0.5) })).toBeNull();
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(1) })).toBe("trial_day1");
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(2.9) })).toBe("trial_day1");
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(3) })).toBe("trial_day3");
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(5.4) })).toBe("trial_day3");
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(6) })).toBe("trial_day6");
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(6.99) })).toBe("trial_day6");
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: end, now: at(7) })).toBeNull();
  });

  it("times 'ends tomorrow' from the end of an extended trial, and sends nothing stale in between", () => {
    const extended = new Date(end.getTime() + 30 * DAY);
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: extended, now: at(6) })).toBeNull();
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: extended, now: at(20) })).toBeNull();
    expect(dueTrialNudge({ trialStart: start, trialEndsAt: extended, now: at(36) })).toBe("trial_day6");
  });

  it("flags the staff alert in the last 2 days only", () => {
    expect(trialEndingSoon({ trialEndsAt: end, now: at(4.9) })).toBe(false);
    expect(trialEndingSoon({ trialEndsAt: end, now: at(5) })).toBe(true);
    expect(trialEndingSoon({ trialEndsAt: end, now: at(7) })).toBe(false);
  });

  it("dedupes once per organization", () => {
    expect(trialNudgeKey("org_1")).toBe("org_1");
  });
});

const issue = (id: string, impact: ReportIssue["impact"], effort: ReportIssue["effort"], extra: Partial<ReportIssue> = {}): ReportIssue => ({
  id,
  pillar: "seo",
  title: id,
  whatsWrong: "",
  whyItMatters: "",
  howToFix: [],
  impact,
  effort,
  affectedUrls: [],
  affectedCount: 1,
  ...extra,
});

describe("fix of the week", () => {
  it("picks the highest points per effort", () => {
    const pick = pickFixOfWeek([issue("big-hard", "high", "involved"), issue("med-quick", "medium", "quick"), issue("low-quick", "low", "quick")]);
    expect(pick?.id).toBe("med-quick"); // 5/1 beats 10/4
  });
  it("keeps report order on ties and handles empty lists", () => {
    expect(pickFixOfWeek([issue("a", "high", "moderate"), issue("b", "medium", "quick")])?.id).toBe("a"); // 10/2 = 5/1
    expect(pickFixOfWeek([])).toBeNull();
  });
  it("uses the issue's own points when present", () => {
    expect(issuePoints({ ...issue("x", "low", "quick"), points: 12 } as ReportIssue)).toBe(12);
    expect(pickFixOfWeek([issue("a", "high", "quick"), { ...issue("b", "low", "quick"), points: 20 } as ReportIssue])?.id).toBe("b");
  });
  it("dedupes per org per ISO week", () => {
    expect(fixOfWeekKey("org_1", new Date("2026-11-02T04:00:00Z"))).toBe("org_1:2026-W45");
    expect(fixOfWeekKey("org_1", new Date("2026-11-08T20:00:00Z"))).toBe("org_1:2026-W45");
    expect(fixOfWeekKey("org_1", new Date("2026-11-09T04:00:00Z"))).toBe("org_1:2026-W46");
  });
});

describe("periods", () => {
  it("computes ISO weeks across year boundaries", () => {
    expect(isoWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(isoWeekKey(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01");
  });
  it("sends only 9:00–21:00 India time, weekly on Monday", () => {
    expect(isSendingHour(new Date("2026-11-02T03:29:00Z"))).toBe(false); // 08:59 IST
    expect(isSendingHour(new Date("2026-11-02T03:30:00Z"))).toBe(true); // 09:00 IST
    expect(isSendingHour(new Date("2026-11-02T15:30:00Z"))).toBe(false); // 21:00 IST
    expect(isWeeklySendDay(new Date("2026-11-02T04:00:00Z"))).toBe(true); // Monday 09:30 IST
    expect(isWeeklySendDay(new Date("2026-11-01T20:00:00Z"))).toBe(false); // Monday 01:30 IST
    expect(isWeeklySendDay(new Date("2026-11-03T04:00:00Z"))).toBe(false); // Tuesday
  });
});

describe("competitor alerts", () => {
  const prev = [
    { promptId: "p1", competitorMentions: { Fiverr: 1, Upwork: 0 } },
    { promptId: "p1", competitorMentions: { Freelancer: 2 } },
    { promptId: "p2", competitorMentions: { Upwork: 1 } },
  ];
  it("finds competitors newly named per question", () => {
    const curr = [
      { promptId: "p1", competitorMentions: { fiverr: 2, Upwork: 1 } },
      { promptId: "p2", competitorMentions: { Upwork: 3, Toptal: 1 } },
    ];
    expect(newlyNamedCompetitors(prev, curr)).toEqual([
      { promptId: "p1", competitor: "Upwork" },
      { promptId: "p2", competitor: "Toptal" },
    ]);
  });
  it("ignores questions that are new this run, the brand itself, and junk data", () => {
    const curr = [
      { promptId: "p3", competitorMentions: { Upwork: 1 } },
      { promptId: "p1", competitorMentions: { "Acme Talent": 1, Bad: "x" } },
      { promptId: "p2", competitorMentions: null },
      { promptId: "p2", competitorMentions: ["Upwork"] },
    ];
    expect(newlyNamedCompetitors(prev, curr, ["acme talent"])).toEqual([]);
  });
});

describe("badge", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
    expect(escapeXml("a\u0000b\u001fc")).toBe("abc");
  });
  it("renders a safe SVG with the score", () => {
    const svg = renderBadgeSvg({ score: 82.4, label: `<script>alert(1)</script>`, link: `https://x.test/r/a"onload="b` });
    expect(svg).toContain(">82<");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain(`"onload="`);
    expect(svg.startsWith("<svg")).toBe(true);
  });
  it("shows 'not checked' and clamps out-of-range scores", () => {
    expect(renderBadgeSvg({ score: null })).toContain("not checked");
    expect(renderBadgeSvg({ score: 140 })).toContain(">100<");
  });
  it("builds embed URLs", () => {
    const u = badgeUrls({ token: "a.b.c", appUrl: "https://app.test/" });
    expect(u.svg).toBe("https://app.test/badge/a.b.c.svg");
    expect(u.report).toBe("https://app.test/r/a.b.c");
    expect(u.html).toContain('src="https://app.test/badge/a.b.c.svg"');
  });
});

describe("E.164", () => {
  it("normalises Indian numbers", () => {
    expect(normalizeE164("98765 43210")).toBe("+919876543210");
    expect(normalizeE164("098765-43210")).toBe("+919876543210");
    expect(normalizeE164("91 98765 43210")).toBe("+919876543210");
    expect(normalizeE164("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeE164("0091 9876543210")).toBe("+919876543210");
  });
  it("accepts other countries with +, rejects junk", () => {
    expect(normalizeE164("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizeE164("12345")).toBeNull();
    expect(normalizeE164("5876543210")).toBeNull(); // not an Indian mobile
    expect(normalizeE164("+0123456789")).toBeNull();
    expect(normalizeE164("+91 98765 abc")).toBeNull();
    expect(normalizeE164("+1234567890123456")).toBeNull(); // 16 digits
    expect(normalizeE164(42)).toBeNull();
    expect(isE164("+919876543210")).toBe(true);
    expect(formatE164("+919876543210")).toBe("+91 98765 43210");
  });
});

describe("WhatsApp texts", () => {
  it("only counts real score gains", () => {
    expect(scoreGain(78, 82)).toBe(4);
    expect(scoreGain(82, 82)).toBeNull();
    expect(scoreGain(82, 70)).toBeNull();
    expect(scoreGain(null, 70)).toBeNull();
  });
  it("gets plurals right", () => {
    expect(fixesWaitingText({ projectName: "Shop", count: 1, link: "x" })).toContain("1 fix is waiting");
    expect(fixesWaitingText({ projectName: "Shop", count: 3, link: "x" })).toContain("3 fixes are waiting");
  });
});

describe("referral codes", () => {
  it("generates 8-char codes from the safe alphabet", () => {
    const c = generateReferralCode();
    expect(c).toMatch(new RegExp(`^[${REFERRAL_ALPHABET}]{8}$`));
    expect(generateReferralCode(() => 0)).toBe("AAAAAAAA");
  });
  it("normalises codes and reads them from URLs", () => {
    expect(normalizeReferralCode(" abcd2345 ")).toBe("ABCD2345");
    expect(normalizeReferralCode("ABCD0345")).toBeNull(); // 0 not in alphabet
    expect(normalizeReferralCode("ABC")).toBeNull();
    expect(referralCodeFromUrl("https://app.test/signup?ref=abcd2345")).toBe("ABCD2345");
    expect(referralCodeFromUrl("not a url")).toBeNull();
  });
});

describe("free tools", () => {
  it("builds FAQPage JSON-LD and skips empty rows", () => {
    const data = buildFaqJsonLd([
      { question: " Do you deliver? ", answer: "Yes,\n daily." },
      { question: "", answer: "orphan" },
    ]) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(data.mainEntity).toHaveLength(1);
    expect(data.mainEntity[0]).toMatchObject({ name: "Do you deliver?", acceptedAnswer: { text: "Yes, daily." } });
    expect(buildFaqJsonLd([{ question: "", answer: "" }])).toBeNull();
  });
  it("escapes < so an answer can't close the script tag", () => {
    const tag = faqScriptTag([{ question: "Q", answer: "</script><script>alert(1)</script>" }])!;
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
  });
  it("builds an AI guide file", () => {
    const f = buildAiGuideFile({
      businessName: "Sharma Sweets",
      summary: "Sweets in Jaipur.\nSince 1985.",
      links: [
        { title: "Menu [new]", url: "sharmasweets.in/menu" },
        { title: "Bad", url: "javascript:alert(1)" },
        { title: "", url: "https://x.in" },
      ],
      contact: "Call us",
    });
    expect(f.startsWith("# Sharma Sweets\n\n> Sweets in Jaipur. Since 1985.")).toBe(true);
    expect(f).toContain("- [Menu new](https://sharmasweets.in/menu)");
    expect(f).not.toContain("javascript");
    expect(f).toContain("## Contact");
  });
  it("validates tool names and lead sources", () => {
    expect(isToolName("faq-markup-maker")).toBe(true);
    expect(isToolName("nope")).toBe(false);
    expect(toolLeadSource("ai-guide-file-maker")).toBe("tool:ai-guide-file-maker");
  });
});

describe("AI named counts", () => {
  it("derives X of Y from the stored report", () => {
    const r = { aiVisibility: { measured: true, mentionRate: 0.25, collected: 12, sampleSize: 12 } } as unknown as SiteReport;
    expect(aiNamedCounts(r)).toEqual({ named: 3, total: 12 });
    expect(aiNamedCounts({ aiVisibility: { measured: false, mentionRate: null, sampleSize: 0 } } as unknown as SiteReport)).toBeNull();
  });
});
