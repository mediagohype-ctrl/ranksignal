// Competitors parsers and pure helpers, from sample payloads shaped like the DataForSEO v3 Labs docs.
import { describe, expect, it } from "vitest";
import {
  organicMetrics, parseBulkTraffic, parseCompetitorSuggestions, parseDomainOverview, parseKeywordGap, parseRankedKeywords, topPages,
} from "@/lib/competitors/parse";
import { batchCsv, batchMaxDomains, batchUnits, gapCsv, parseDomainList, toCsv, usdToInr } from "@/lib/competitors/shared";
import { marketOf, savedCompetitorDomains } from "@/lib/competitors/service";

const overviewResult = [
  {
    se_type: "google",
    target: "rival.in",
    location_code: 2356,
    language_code: "en",
    total_count: 1,
    items_count: 1,
    items: [
      {
        se_type: "google",
        location_code: 2356,
        language_code: "en",
        metrics: {
          organic: {
            pos_1: 12, pos_2_3: 30, pos_4_10: 80, pos_11_20: 120, pos_21_30: 90, pos_31_40: 60, pos_41_50: 40, pos_51_60: 30,
            pos_61_70: 20, pos_71_80: 10, pos_81_90: 5, pos_91_100: 3, etv: 15234.7, impressions_etv: 40000.2, count: 500,
            estimated_paid_traffic_cost: 2100.55, is_new: 25, is_up: 40, is_down: 30, is_lost: 12,
          },
          paid: { pos_1: 0, etv: 0, count: 0 },
        },
      },
    ],
  },
];

describe("domain overview", () => {
  it("reads visits, top 3/10/100 and traffic value", () => {
    const o = parseDomainOverview("rival.in", overviewResult);
    expect(o).toEqual({ domain: "rival.in", traffic: 15235, top3: 42, top10: 122, top100: 500, trafficValueUsd: 2100.55, newKeywords: 25, lostKeywords: 12 });
  });
  it("treats an empty answer as zeros and sums buckets when count is missing", () => {
    expect(parseDomainOverview("new.in", [{ items: [] }])).toMatchObject({ traffic: 0, top10: 0, top100: 0 });
    expect(parseDomainOverview("new.in", [])).toMatchObject({ traffic: 0 });
    expect(organicMetrics({ pos_1: 1, pos_4_10: 2, pos_91_100: 3 })).toMatchObject({ top3: 1, top10: 3, top100: 6, traffic: null });
    expect(organicMetrics("junk")).toMatchObject({ traffic: null, top3: null, top100: null });
  });
});

const rankedResult = [
  {
    target: "rival.in",
    total_count: 1234,
    items_count: 4,
    items: [
      {
        se_type: "google",
        keyword_data: { keyword: "Dentist Pune", keyword_info: { search_volume: 2400, cpc: 1.2 }, keyword_properties: { keyword_difficulty: 34 } },
        ranked_serp_element: { serp_item: { type: "organic", rank_group: 2, rank_absolute: 3, url: "https://rival.in/dentist-pune", etv: 380.4 } },
      },
      {
        keyword_data: { keyword: "teeth whitening pune", keyword_info: { search_volume: 900 }, keyword_properties: { keyword_difficulty: 12 } },
        ranked_serp_element: { serp_item: { rank_group: 1, url: "https://rival.in/whitening", etv: 270 } },
      },
      {
        keyword_data: { keyword: "dentist near me", keyword_info: { search_volume: 50000 } },
        ranked_serp_element: { serp_item: { rank_group: 9, url: "https://rival.in/dentist-pune", etv: 120 } },
      },
      { keyword_data: { keyword: "dentist pune" }, ranked_serp_element: {} },
      { keyword_data: {}, ranked_serp_element: { serp_item: { rank_group: 1 } } },
    ],
  },
];

describe("ranked keywords and top pages", () => {
  it("lists keywords by estimated visits and groups pages", () => {
    const r = parseRankedKeywords("rival.in", rankedResult);
    expect(r.totalKeywords).toBe(1234);
    expect(r.keywords.map((k) => k.keyword)).toEqual(["dentist pune", "teeth whitening pune", "dentist near me"]);
    expect(r.keywords[0]).toMatchObject({ position: 2, volume: 2400, difficulty: 34, traffic: 380.4 });
    expect(r.keywords[2].difficulty).toBeNull();
    expect(r.pages[0]).toEqual({ url: "https://rival.in/dentist-pune", traffic: 500, keywords: 2 });
    expect(r.pages).toHaveLength(2);
  });
  it("copes with missing results", () => {
    expect(parseRankedKeywords("x.in", [null, "x"])).toEqual({ domain: "x.in", totalKeywords: null, keywords: [], pages: [] });
    expect(topPages([{ keyword: "a", position: 1, volume: 1, difficulty: 1, traffic: null, url: null }])).toEqual([]);
  });
});

describe("keyword gap", () => {
  const missing = [
    {
      items: [
        {
          keyword_data: { keyword: "root canal cost", keyword_info: { search_volume: 1600 }, keyword_properties: { keyword_difficulty: 22 } },
          first_domain_serp_element: { type: "organic", rank_group: 4, url: "https://rival.in/root-canal", etv: 90 },
          second_domain_serp_element: null,
        },
        {
          keyword_data: { keyword: "braces price", keyword_info: { search_volume: 3600 }, keyword_properties: { keyword_difficulty: 55 } },
          first_domain_serp_element: { rank_group: 15, url: "https://rival.in/braces" },
          second_domain_serp_element: null,
        },
        {
          // Competitor below 20: not a gap, even if the filter let it through.
          keyword_data: { keyword: "dental implants", keyword_info: { search_volume: 9000 } },
          first_domain_serp_element: { rank_group: 45 },
          second_domain_serp_element: null,
        },
      ],
    },
  ];
  const behind = [
    {
      items: [
        {
          keyword_data: { keyword: "dentist pune", keyword_info: { search_volume: 2400 }, keyword_properties: { keyword_difficulty: 34 } },
          first_domain_serp_element: { rank_group: 2 },
          second_domain_serp_element: { rank_group: 38, url: "https://acme.in/" },
        },
        {
          // You're already top 20 — not a gap.
          keyword_data: { keyword: "kids dentist", keyword_info: { search_volume: 500 } },
          first_domain_serp_element: { rank_group: 1 },
          second_domain_serp_element: { rank_group: 8 },
        },
        {
          keyword_data: { keyword: "root canal cost", keyword_info: { search_volume: 1600 } },
          first_domain_serp_element: { rank_group: 4 },
          second_domain_serp_element: { rank_group: 60 },
        },
      ],
    },
  ];
  it("merges both calls, keeps competitor top 20 where you're absent or below 20, sorted by volume", () => {
    const rows = parseKeywordGap([missing, behind]);
    expect(rows.map((r) => r.keyword)).toEqual(["braces price", "dentist pune", "root canal cost"]);
    expect(rows.find((r) => r.keyword === "dentist pune")).toMatchObject({ yourPosition: 38, competitorPosition: 2 });
    // First call wins for duplicates: you don't rank at all there.
    expect(rows.find((r) => r.keyword === "root canal cost")).toMatchObject({ yourPosition: null, difficulty: 22, competitorUrl: "https://rival.in/root-canal" });
  });
  it("returns nothing for empty or junk answers", () => {
    expect(parseKeywordGap([[], [{ items: "nope" }]])).toEqual([]);
  });
});

describe("bulk traffic", () => {
  it("keeps the order asked for and marks missing domains as no data", () => {
    const result = [
      {
        items: [
          { se_type: "google", target: "www.b.in", metrics: { organic: { etv: 99.6, count: 40, estimated_paid_traffic_cost: 12.5 } } },
          { target: "a.in", metrics: { organic: { etv: 0, count: 0 } } },
        ],
      },
    ];
    expect(parseBulkTraffic(["a.in", "b.in", "c.in"], result)).toEqual([
      { domain: "a.in", traffic: 0, keywords: 0, trafficValueUsd: null },
      { domain: "b.in", traffic: 100, keywords: 40, trafficValueUsd: 12.5 },
      { domain: "c.in", traffic: null, keywords: null, trafficValueUsd: null },
    ]);
  });
});

describe("competitor suggestions", () => {
  it("drops your own site, saved competitors and giant sites", () => {
    const result = [
      {
        items: [
          { domain: "acme.in", avg_position: 3, intersections: 900 },
          { domain: "wikipedia.org", intersections: 500 },
          { domain: "rival.in", intersections: 300 },
          { domain: "www.newrival.co.in", avg_position: 7.345, intersections: 120, full_domain_metrics: { organic: { etv: 4500.4, count: 800 } } },
          { domain: "not a domain" },
        ],
      },
    ];
    expect(parseCompetitorSuggestions(result, ["acme.in", "rival.in"])).toEqual([
      { domain: "newrival.co.in", sharedKeywords: 120, avgPosition: 7.3, traffic: 4500 },
    ]);
  });
});

describe("helpers", () => {
  it("parses pasted domain lists", () => {
    const r = parseDomainList("https://www.A.in/x, b.in\nb.in; not_a_domain  c.co.in\n\n");
    expect(r.domains).toEqual(["a.in", "b.in", "c.co.in"]);
    expect(r.invalid).toEqual(["not_a_domain"]);
  });
  it("charges 1 batch unit per 50 domains, rounded up", () => {
    expect(batchUnits(1)).toBe(1);
    expect(batchUnits(50)).toBe(1);
    expect(batchUnits(51)).toBe(2);
    expect(batchUnits(200)).toBe(4);
    expect(batchUnits(0)).toBe(1);
    expect(batchMaxDomains("agency")).toBe(200);
    expect(batchMaxDomains("unknown")).toBe(batchMaxDomains("trial"));
  });
  it("converts USD to rupees", () => {
    expect(usdToInr(12.5, 95)).toBe(1188);
    expect(usdToInr(null, 95)).toBeNull();
  });
  it("writes safe CSV", () => {
    expect(toCsv(["a", "b"], [["x,y", '=HYPERLINK("evil")'], [null, 3]])).toBe('a,b\r\n"x,y","\'=HYPERLINK(""evil"")"\r\n,3\r\n');
    expect(batchCsv([{ domain: "a.in", traffic: 10, keywords: 2, trafficValueUsd: 1 }], 95)).toContain("a.in,10,2,95");
    expect(gapCsv([{ keyword: "k", volume: 1, difficulty: null, competitorPosition: 3, competitorUrl: null, yourPosition: null }])).toContain("k,1,,3,not in top 100,");
  });
  it("reads saved competitor domains and country-level markets", () => {
    expect(savedCompetitorDomains([{ name: "Rival", domain: "https://www.rival.in/" }, { name: "No domain" }, { domain: "acme.in" }, null, { domain: "rival.in" }], "acme.in")).toEqual(["rival.in"]);
    expect(savedCompetitorDomains("junk")).toEqual([]);
    expect(marketOf("in-pune", "hi")).toEqual({ locationId: "in", language: "hi" });
    expect(marketOf("us", "fr")).toEqual({ locationId: "us", language: "en" });
    expect(marketOf(undefined, undefined)).toEqual({ locationId: "in", language: "en" });
  });
});
