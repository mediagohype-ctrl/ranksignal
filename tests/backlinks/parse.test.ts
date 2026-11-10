// Backlinks: pure parsers (realistic DataForSEO v3 sample payloads), snapshot diff, CSV, error classification, limits
// and the request shapes the service sends.
import { describe, expect, it } from "vitest";
import {
  diffReferringDomains, isoDay, parseAnchors, parseBacklinks, parseDomainIntersection, parseNewLost, parseReferringDomains, parseSummary,
  rank100, readSnapshotData,
} from "@/lib/backlinks/parse";
import { anchorsCsv, backlinksCsv, csvCell, linkGapCsv, referringDomainsCsv } from "@/lib/backlinks/csv";
import { isBacklinksAccessError } from "@/lib/backlinks/errors";
import { ANCHORS_RESULT, BACKLINKS_RESULT, DOMAINS_RESULT, INTERSECTION_RESULT, NEW_LOST_RESULT, SUMMARY_RESULT } from "./samples";
import { BACKLINK_REFRESH_DAYS, BACKLINK_UNITS_PER_REFRESH, frequencyLabel, refreshDaysFor, refreshesLeft } from "@/lib/backlinks/limits";

describe("backlink parsers", () => {
  it("reads the summary with a followed / nofollow split and the 0–100 strength", () => {
    const s = parseSummary(SUMMARY_RESULT)!;
    expect(s).toMatchObject({ backlinks: 1240, referringDomains: 96, rank: 38, brokenBacklinks: 17, nofollow: 240, dofollow: 1000, spamScore: 4, firstSeen: "2019-03-02" });
    expect(parseSummary([])).toBeNull();
    expect(parseSummary([{ backlinks: "lots" }])).toMatchObject({ backlinks: null, dofollow: null, rank: null });
  });

  it("scales old 0–1000 ranks and cleans dates", () => {
    expect(rank100(38)).toBe(38);
    expect(rank100(600)).toBe(60);
    expect(rank100(-1)).toBeNull();
    expect(isoDay("2026-11-02 00:00:00 +00:00")).toBe("2026-11-02");
    expect(isoDay("yesterday")).toBeNull();
  });

  it("parses linking sites, dropping junk and duplicates", () => {
    const r = parseReferringDomains(DOMAINS_RESULT);
    expect(r.total).toBe(96);
    expect(r.items.map((d) => d.domain)).toEqual(["timesofindia.com", "justdial.com"]);
    expect(r.items[0]).toMatchObject({ rank: 92, backlinks: 3, dofollow: 2, firstSeen: "2025-01-04" });
    expect(r.items[1].dofollow).toBeNull();
  });

  it("parses links: only http(s) pages, words tidied, follow flags kept", () => {
    const r = parseBacklinks(BACKLINKS_RESULT);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ domainFrom: "blog.example.org", anchor: "Acme Dental", dofollow: true, domainRank: 41, pageTitle: "Best dentists in Pune" });
    expect(r.items[1]).toMatchObject({ domainFrom: "dir.example.com", anchor: null, dofollow: false, isBroken: true, domainRank: 60, kind: "image" });
  });

  it("parses anchors and new/lost weeks (sorted oldest first)", () => {
    expect(parseAnchors(ANCHORS_RESULT).items).toEqual([
      { anchor: "acme dental", backlinks: 300, referringDomains: 40, firstSeen: "2020-01-01" },
      { anchor: null, backlinks: 12, referringDomains: 4, firstSeen: null },
    ]);
    const weeks = parseNewLost(NEW_LOST_RESULT);
    expect(weeks.map((w) => w.date)).toEqual(["2026-10-26", "2026-11-02"]);
    expect(weeks[1]).toMatchObject({ newDomains: 3, lostDomains: 1, newBacklinks: 10, lostBacklinks: 2 });
  });

  it("parses the link gap with which competitors each site links to, most overlap first", () => {
    const r = parseDomainIntersection(INTERSECTION_RESULT, { "1": "rival.in", "2": "other.com" });
    expect(r.total).toBe(57);
    expect(r.items).toEqual([
      { domain: "pune-directory.in", rank: 33, backlinks: 7, linksTo: ["rival.in", "other.com"] },
      { domain: "news.example.com", rank: 80, backlinks: 1, linksTo: ["rival.in"] },
      { domain: "blogger.example", rank: 12, backlinks: 3, linksTo: ["other.com"] },
    ]);
  });

  it("reads stored snapshots defensively", () => {
    expect(readSnapshotData(null).referringDomains).toEqual([]);
    expect(readSnapshotData({ referringDomains: "x", sectionErrors: ["anchors", 3] })).toMatchObject({ referringDomains: [], sectionErrors: ["anchors"] });
  });
});

describe("new & lost linking sites", () => {
  const a = { domain: "a.com", rank: 10, backlinks: 1, dofollow: 1, firstSeen: "2020-01-01", spamScore: null };
  const b = { ...a, domain: "b.com", firstSeen: "2026-11-01" };
  const c = { ...a, domain: "c.com" };
  it("compares with the previous refresh", () => {
    const d = diffReferringDomains([a, b], { list: [a, c], takenAt: "2026-11-01T00:00:00.000Z" });
    expect(d.gained.map((x) => x.domain)).toEqual(["b.com"]);
    expect(d.gone.map((x) => x.domain)).toEqual(["c.com"]);
    expect(d.comparedWith).toBe("2026-11-01T00:00:00.000Z");
  });
  it("on the first refresh, 'new' means first seen in the last 30 days", () => {
    const d = diffReferringDomains([a, b], null, new Date("2026-11-10T00:00:00Z"));
    expect(d.gained.map((x) => x.domain)).toEqual(["b.com"]);
    expect(d.gone).toEqual([]);
  });
});

describe("CSV export", () => {
  it("escapes cells and neutralises formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(true)).toBe("yes");
    expect(csvCell(null)).toBe("");
  });
  it("builds each list's CSV with a header row", () => {
    const domains = parseReferringDomains(DOMAINS_RESULT).items;
    expect(referringDomainsCsv(domains).split("\r\n")[0]).toBe("Linking site,Strength (0-100),Links to you,Followed links,First seen");
    expect(referringDomainsCsv(domains)).toContain("timesofindia.com,92,3,2,2025-01-04");
    expect(backlinksCsv(parseBacklinks(BACKLINKS_RESULT).items)).toContain("Acme Dental");
    expect(anchorsCsv(parseAnchors(ANCHORS_RESULT).items)).toContain("(no words, e.g. an image)");
    expect(linkGapCsv(parseDomainIntersection(INTERSECTION_RESULT, { "1": "rival.in", "2": "other.com" }).items)).toContain("rival.in | other.com");
  });
});

describe("errors and limits", () => {
  it("recognises 'no Backlinks subscription' answers", () => {
    expect(isBacklinksAccessError({ statusCode: 40204, message: "x" })).toBe(true);
    expect(isBacklinksAccessError({ message: "DataForSEO task error 40xxx: Access denied. Visit Plans and Subscriptions" })).toBe(true);
    expect(isBacklinksAccessError({ statusCode: 50000, message: "Internal error" })).toBe(false);
    expect(isBacklinksAccessError(null)).toBe(false);
  });
  it("sets refresh frequency per plan and counts refreshes from units", () => {
    expect(BACKLINK_REFRESH_DAYS).toEqual({ trial: null, starter: 30, growth: 7, agency: 7 });
    expect(refreshDaysFor("mystery")).toBeNull();
    expect(BACKLINK_UNITS_PER_REFRESH).toBe(1);
    expect(refreshesLeft(3)).toBe(3);
    expect(frequencyLabel(7)).toMatch(/every week/);
    expect(frequencyLabel(null)).toMatch(/No automatic/);
  });
});
