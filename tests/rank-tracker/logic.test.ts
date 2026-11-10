import { describe, expect, it } from "vitest";
import {
  RANK_TRACKER_FREQUENCY, RANK_TRACKER_MAX_KEYWORDS, maxTrackedKeywordsFor, rankFrequencyFor,
} from "@/lib/rank-tracker/limits";
import {
  buildSerpTask, checkAtOrBefore, cleanDevice, cleanKeywordList, cleanLocationId, isKeywordDue, manualCheckAvailableAt, positionChange, rankingsCsv, summarise,
} from "@/lib/rank-tracker/logic";

const DAY = 86_400_000;

describe("plan limits", () => {
  it("has the agreed schedule and keyword caps", () => {
    expect(RANK_TRACKER_FREQUENCY).toEqual({ trial: "weekly", starter: "weekly", growth: "daily", agency: "daily" });
    expect(RANK_TRACKER_MAX_KEYWORDS).toEqual({ trial: 10, starter: 50, growth: 300, agency: 1500 });
    expect(rankFrequencyFor("mystery")).toBe("weekly");
    expect(maxTrackedKeywordsFor(null)).toBe(10);
  });
});

describe("input cleaning", () => {
  it("normalises, de-duplicates and caps keywords", () => {
    const r = cleanKeywordList("Dentist in Pune\n\n dentist  in pune \n" + "x".repeat(90) + "\nroot canal\nbraces", 2);
    expect(r.keywords).toEqual(["dentist in pune", "root canal"]);
    expect(r.invalid).toBe(1);
    expect(r.overflow).toBe(1);
  });
  it("falls back to safe location and device values", () => {
    expect(cleanLocationId("in-pune")).toBe("in-pune");
    expect(cleanLocationId("mars")).toBe("in");
    expect(cleanDevice("desktop")).toBe("desktop");
    expect(cleanDevice("tablet")).toBe("mobile");
  });
});

describe("schedule", () => {
  const now = new Date("2026-11-10T06:00:00Z");
  it("checks new keywords straight away and respects daily/weekly intervals", () => {
    expect(isKeywordDue({ lastCheckedAt: null, frequency: "weekly", now })).toBe(true);
    expect(isKeywordDue({ lastCheckedAt: new Date(now.getTime() - 23.5 * 3_600_000), frequency: "daily", now })).toBe(true); // 1h slack
    expect(isKeywordDue({ lastCheckedAt: new Date(now.getTime() - 20 * 3_600_000), frequency: "daily", now })).toBe(false);
    expect(isKeywordDue({ lastCheckedAt: new Date(now.getTime() - 3 * DAY), frequency: "weekly", now })).toBe(false);
    expect(isKeywordDue({ lastCheckedAt: new Date(now.getTime() - 7 * DAY), frequency: "weekly", now })).toBe(true);
  });
  it("allows Check now once a day", () => {
    expect(manualCheckAvailableAt(null, 24, now)).toBeNull();
    expect(manualCheckAvailableAt(new Date(now.getTime() - 2 * 3_600_000), 24, now)?.toISOString()).toBe("2026-11-11T04:00:00.000Z");
    expect(manualCheckAvailableAt(new Date(now.getTime() - 25 * 3_600_000), 24, now)).toBeNull();
  });
});

describe("DataForSEO task", () => {
  it("sends keyword, location, language, device and depth 100", () => {
    expect(buildSerpTask({ keyword: "dentist in pune", locationId: "in-pune", device: "mobile", language: "hi" })).toEqual({
      keyword: "dentist in pune",
      location_name: "Pune,Maharashtra,India",
      language_code: "hi",
      device: "mobile",
      os: "android",
      depth: 100,
    });
    expect(buildSerpTask({ keyword: "x", locationId: "in", device: "desktop" })).toMatchObject({ location_code: 2356, language_code: "en", device: "desktop", os: "windows" });
  });
});

describe("changes and summary", () => {
  it("counts places moved, treating 'not in top 100' as 101", () => {
    expect(positionChange(3, 7, true)).toBe(4);
    expect(positionChange(9, 4, true)).toBe(-5);
    expect(positionChange(null, 8, true)).toBe(-93);
    expect(positionChange(40, null, true)).toBe(61);
    expect(positionChange(5, undefined, false)).toBeNull();
  });
  it("picks the check at or before a date from a newest-first list", () => {
    const c = [{ checkedAt: new Date("2026-11-10") }, { checkedAt: new Date("2026-11-03") }, { checkedAt: new Date("2026-10-27") }];
    expect(checkAtOrBefore(c, new Date("2026-11-04"))).toBe(c[1]);
    expect(checkAtOrBefore(c, new Date("2026-10-01"))).toBeUndefined();
  });
  it("summarises positions", () => {
    const s = summarise([
      { position: 1, checked: true, weekChange: 2 },
      { position: 8, checked: true, weekChange: -1 },
      { position: 25, checked: true, weekChange: 0 },
      { position: null, checked: true, weekChange: null },
      { position: null, checked: false, weekChange: null },
    ]);
    expect(s).toEqual({ tracked: 5, checked: 4, averagePosition: 11.3, top3: 1, top10: 2, notRanking: 1, movedUp: 1, movedDown: 1 });
    expect(summarise([]).averagePosition).toBeNull();
  });
});

describe("CSV export", () => {
  it("writes plain-English cells and guards against formula injection", () => {
    const csv = rankingsCsv([
      { keyword: "=cmd()", location: "Pune", device: "mobile", position: 4, change: -2, best: 3, url: "https://acme.in/a,b", features: ["ai_overview"], above: ["a.com (#1)"], checkedAt: "2026-11-10T06:00:00.000Z" },
      { keyword: "new one", location: "All of India", device: "desktop", position: null, change: null, best: null, url: null, features: [], above: [], checkedAt: null },
    ]);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toMatch(/^Keyword,Location,Device,Position/);
    expect(lines[1]).toBe(`'=cmd(),Pune,mobile,4,down 2,3,"https://acme.in/a,b",ai_overview,a.com (#1),2026-11-10T06:00:00.000Z`);
    expect(lines[2]).toContain("Not checked yet");
  });
});
