// Keyword research + SERP checker: pure parsers, labels, filters and CSV, built from realistic DataForSEO v3 payloads.
import { describe, expect, it } from "vitest";
import {
  buildKeywordTask, cpcInr, difficultyBand, filterKeywords, isQuestion, keywordRequestKey, keywordsToCsv, parseKeywordIdeas,
} from "@/lib/research/keywords";
import { annotateSerp, buildSerpTask, parseSerp, projectCompetitors, sameSite, serpRequestKey } from "@/lib/research/serp";

const monthly = (base: number) =>
  // DataForSEO lists newest month first.
  Array.from({ length: 13 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9 - i, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, search_volume: base + i * 10 };
  });

const SUGGESTIONS_RESULT = [
  {
    se_type: "google",
    seed_keyword: "plumber pune",
    seed_keyword_data: {
      se_type: "google",
      keyword_info: { search_volume: 2400, cpc: 0.42, competition: 0.3, monthly_searches: monthly(2000) },
      keyword_properties: { keyword_difficulty: 22 },
      search_intent_info: { main_intent: "commercial", foreign_intent: ["transactional"] },
    },
    location_code: 2356,
    language_code: "en",
    total_count: 87,
    items_count: 3,
    items: [
      {
        se_type: "google",
        keyword: "emergency plumber pune",
        location_code: 2356,
        language_code: "en",
        keyword_info: { search_volume: 320, cpc: 1.1, monthly_searches: monthly(300) },
        keyword_properties: { keyword_difficulty: 61 },
        search_intent_info: { main_intent: "transactional" },
      },
      {
        se_type: "google",
        keyword: "how much does a plumber charge in pune",
        keyword_info: { search_volume: null, cpc: null, monthly_searches: null },
        keyword_properties: { keyword_difficulty: null },
        search_intent_info: { main_intent: "informational" },
      },
      { se_type: "google", keyword: "Plumber Pune" }, // duplicate of the seed (case) — dropped
      { keyword: 42 }, // junk
      "junk",
    ],
  },
];

describe("keyword ideas parser", () => {
  const r = parseKeywordIdeas(SUGGESTIONS_RESULT, { seed: "plumber pune", mode: "suggestions", countryCode: 2356, languageId: "en" });

  it("includes the seed, keeps known fields and skips junk and duplicates", () => {
    expect(r.totalCount).toBe(87);
    expect(r.items.map((i) => i.keyword)).toEqual(["plumber pune", "emergency plumber pune", "how much does a plumber charge in pune"]);
    const seed = r.items[0];
    expect(seed).toMatchObject({ volume: 2400, difficulty: 22, intent: "commercial", cpcUsd: 0.42, isQuestion: false });
    expect(r.items[2]).toMatchObject({ volume: null, difficulty: null, cpcUsd: null, intent: "informational", isQuestion: true, trend: [] });
  });

  it("returns the last 12 months, oldest first", () => {
    const t = r.items[0].trend;
    expect(t).toHaveLength(12);
    expect(t[0].month).toBe("2025-11");
    expect(t[11]).toEqual({ month: "2026-10", volume: 2000 });
  });

  it("reads related_keywords rows (wrapped in keyword_data) and empty results", () => {
    const rel = parseKeywordIdeas([{ items: [{ keyword_data: { keyword: "pipe repair", keyword_info: { search_volume: 90 } }, depth: 1 }] }], {
      seed: "plumber", mode: "ideas", countryCode: 2356, languageId: "en",
    });
    expect(rel.items[0]).toMatchObject({ keyword: "pipe repair", volume: 90 });
    expect(parseKeywordIdeas([], { seed: "x", mode: "ideas", countryCode: 2356, languageId: "en" }).items).toEqual([]);
    expect(parseKeywordIdeas([null, { items: null }], { seed: "x", mode: "ideas", countryCode: 2356, languageId: "en" }).items).toEqual([]);
  });

  it("builds country-level Labs tasks and stable cache keys", () => {
    expect(buildKeywordTask("yoga", 2356, "hi", "suggestions")).toMatchObject({ keyword: "yoga", location_code: 2356, language_code: "hi", include_seed_keyword: true });
    expect(buildKeywordTask("yoga", 2356, "en", "ideas")).toMatchObject({ keywords: ["yoga"], location_code: 2356 });
    expect(keywordRequestKey("yoga", 2356, "en", "ideas")).not.toBe(keywordRequestKey("yoga", 2356, "en", "suggestions"));
  });
});

describe("labels, filters and CSV", () => {
  it("bands difficulty and spots questions in English, Hinglish and Hindi", () => {
    expect([difficultyBand(0), difficultyBand(29), difficultyBand(30), difficultyBand(60), difficultyBand(null)]).toEqual(["easy", "easy", "medium", "hard", null]);
    expect(isQuestion("how to fix a tap")).toBe(true);
    expect(isQuestion("ghar par cake kaise banaye")).toBe(true);
    expect(isQuestion("केक कैसे बनाएं")).toBe(true);
    expect(isQuestion("will writing service")).toBe(false);
    expect(isQuestion("dosa recipe")).toBe(false);
  });

  it("filters by words, questions and difficulty, and sorts unknowns last", () => {
    const r = parseKeywordIdeas(SUGGESTIONS_RESULT, { seed: "plumber pune", mode: "suggestions", countryCode: 2356, languageId: "en" });
    expect(filterKeywords(r.items, { contains: "emergency" }).map((k) => k.keyword)).toEqual(["emergency plumber pune"]);
    expect(filterKeywords(r.items, { questionsOnly: true })).toHaveLength(1);
    expect(filterKeywords(r.items, { difficulty: "hard" }).map((k) => k.keyword)).toEqual(["emergency plumber pune"]);
    expect(filterKeywords(r.items, { sort: "difficulty", dir: "asc" }).map((k) => k.difficulty)).toEqual([22, 61, null]);
    expect(filterKeywords(r.items, { sort: "volume", dir: "asc" }).map((k) => k.volume)).toEqual([320, 2400, null]);
  });

  it("converts CPC to approximate rupees and escapes CSV (incl. formula injection)", () => {
    expect(cpcInr(1)).toBe(85);
    expect(cpcInr(null)).toBeNull();
    const csv = keywordsToCsv([
      { keyword: '=HYPERLINK("x")', volume: 10, difficulty: 5, intent: "informational", cpcUsd: 0.1, trend: [{ month: "2026-01", volume: 1 }], isQuestion: false },
    ]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toMatch(/^Keyword,Monthly searches/);
    expect(row.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
    expect(row).toContain("Easy");
    expect(row).toContain("Learning");
  });
});

const SERP_RESULT = [
  {
    keyword: "plumber in pune",
    type: "organic",
    se_domain: "google.co.in",
    location_code: 1007788,
    language_code: "en",
    check_url: "https://www.google.co.in/search?q=plumber+in+pune",
    datetime: "2026-11-10 10:00:00 +00:00",
    item_types: ["ai_overview", "local_pack", "organic", "people_also_ask", "video"],
    se_results_count: 1234000,
    items_count: 14,
    items: [
      {
        type: "ai_overview",
        rank_group: 1,
        rank_absolute: 1,
        items: [{ type: "ai_overview_element", title: "Plumbers in Pune", references: [{ domain: "www.justdial.com", url: "https://www.justdial.com/x" }] }],
        references: [{ type: "ai_overview_reference", domain: "blog.acme.in", url: "https://blog.acme.in/tips" }],
      },
      { type: "local_pack", rank_group: 1, rank_absolute: 2, title: "Pune Plumbing Co", domain: "puneplumbing.in", rating: { value: 4.5 } },
      { type: "organic", rank_group: 2, rank_absolute: 4, domain: "www.urbancompany.com", title: "Plumbers in Pune", url: "https://www.urbancompany.com/pune-plumbers", description: "Book" },
      { type: "organic", rank_group: 1, rank_absolute: 3, domain: "www.justdial.com", title: "Top plumbers", url: "https://www.justdial.com/Pune/Plumbers", is_featured_snippet: false },
      {
        type: "people_also_ask",
        rank_group: 1,
        rank_absolute: 5,
        items: [
          { type: "people_also_ask_element", title: "How much does a plumber charge in Pune?" },
          { type: "people_also_ask_element", title: "How do I find a good plumber?" },
        ],
      },
      { type: "organic", rank_group: 3, rank_absolute: 6, domain: "acme.in", title: "Acme Plumbing", url: "https://acme.in/" },
      { type: "organic", rank_group: 4, rank_absolute: 7, domain: "bad.example", title: "Bad", url: "javascript:alert(1)" },
      { type: "video", rank_group: 1, rank_absolute: 8, items: [] },
      ...Array.from({ length: 9 }, (_, i) => ({ type: "organic", rank_group: 5 + i, domain: `site${i}.com`, title: `S${i}`, url: `https://site${i}.com/` })),
    ],
  },
];

describe("SERP parser", () => {
  const meta = { keyword: "plumber in pune", locationId: "in-pune", languageId: "en", device: "mobile" as const };
  const s = parseSerp(SERP_RESULT, meta);

  it("returns the top 10 ordinary results in order, dropping unsafe URLs", () => {
    expect(s.organic).toHaveLength(10);
    expect(s.organic.slice(0, 3).map((r) => [r.position, r.domain])).toEqual([
      [1, "justdial.com"],
      [2, "urbancompany.com"],
      [3, "acme.in"],
    ]);
    expect(s.organic.some((r) => r.url.startsWith("javascript"))).toBe(false);
    expect(s.totalResults).toBe(1234000);
  });

  it("lists SERP features with plain names, AI Overview first", () => {
    expect(s.features.map((f) => f.id)).toEqual(["ai_overview", "local_pack", "people_also_ask", "video"]);
    expect(s.features[1].label).toBe("Map pack");
    expect(s.questions).toEqual(["How much does a plumber charge in Pune?", "How do I find a good plumber?"]);
    expect(s.aiOverviewSources.sort()).toEqual(["blog.acme.in", "justdial.com"]);
    expect(s.localPack).toEqual([{ title: "Pune Plumbing Co", domain: "puneplumbing.in" }]);
  });

  it("highlights your domain (incl. subdomains) and saved competitors", () => {
    const comps = projectCompetitors([{ name: "UrbanCo", domain: "https://www.urbancompany.com/" }, { name: "x" }, null, { name: "Dup", domain: "urbancompany.com" }]);
    expect(comps).toEqual([{ name: "UrbanCo", domain: "urbancompany.com" }]);
    const a = annotateSerp(s, "acme.in", comps);
    expect(a.you).toEqual({ domain: "acme.in", position: 3, inAiOverview: true, hasFeaturedSnippet: false });
    expect(a.organic[1]).toMatchObject({ match: "competitor", competitorName: "UrbanCo" });
    expect(a.organic[0].match).toBeNull();
    expect(a.competitorsFound).toEqual([{ name: "UrbanCo", domain: "urbancompany.com", position: 2 }]);
    expect(sameSite("notacme.in", "acme.in")).toBe(false);
  });

  it("survives empty and odd payloads", () => {
    const e = parseSerp([], meta);
    expect(e).toMatchObject({ organic: [], features: [], questions: [], totalResults: null, featuredSnippet: null });
    expect(parseSerp([{ items: [{ type: "organic" }, { type: 5 }, null] }], meta).organic).toEqual([]);
  });

  it("builds the task with location, device and depth; cache keys differ per device and city", () => {
    expect(buildSerpTask("x", { location_name: "Pune,Maharashtra,India" }, "en", "mobile")).toMatchObject({
      keyword: "x", location_name: "Pune,Maharashtra,India", language_code: "en", device: "mobile", depth: 20,
    });
    expect(serpRequestKey("x", "in-pune", "en", "mobile")).not.toBe(serpRequestKey("x", "in-pune", "en", "desktop"));
    expect(serpRequestKey("x", "in-pune", "en", "mobile")).not.toBe(serpRequestKey("x", "in", "en", "mobile"));
  });
});
