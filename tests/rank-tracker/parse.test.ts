import { describe, expect, it } from "vitest";
import { parseEnvelope } from "@/lib/dataforseo/client";
import { matchesDomain, parseSerpResult, readCompetitors, readFeatures } from "@/lib/rank-tracker/parse";

// Shaped like a DataForSEO v3 /serp/google/organic/live/advanced response (trimmed).
export function samplePayload(items: Record<string, unknown>[], itemTypes?: string[]) {
  return {
    version: "0.1.20240801",
    status_code: 20000,
    status_message: "Ok.",
    time: "3.1 sec.",
    cost: 0.002,
    tasks_count: 1,
    tasks_error: 0,
    tasks: [
      {
        id: "11101530-1535-0139-0000-7d9f2c5e4a1b",
        status_code: 20000,
        status_message: "Ok.",
        cost: 0.002,
        result_count: 1,
        path: ["v3", "serp", "google", "organic", "live", "advanced"],
        data: { api: "serp", function: "live", se: "google", se_type: "organic", keyword: "dentist in pune", location_name: "Pune,Maharashtra,India", language_code: "en", device: "mobile", os: "android", depth: 100 },
        result: [
          {
            keyword: "dentist in pune",
            type: "organic",
            se_domain: "google.co.in",
            location_code: 1007788,
            language_code: "en",
            check_url: "https://www.google.co.in/search?q=dentist+in+pune",
            datetime: "2026-11-10 10:00:00 +00:00",
            spell: null,
            item_types: itemTypes ?? [...new Set(items.map((i) => i.type))],
            se_results_count: 45200000,
            items_count: items.length,
            items,
          },
        ],
      },
    ],
  };
}

const organic = (rank: number, domain: string, path = "/") => ({
  type: "organic",
  rank_group: rank,
  rank_absolute: rank + 2,
  position: "left",
  xpath: "/html[1]/body[1]",
  domain,
  title: `${domain} title`,
  url: `https://${domain}${path}`,
  breadcrumb: `https://${domain}`,
  is_featured_snippet: false,
});

describe("parseSerpResult", () => {
  it("finds the project's position, ranking URL, features and the domains above it", () => {
    const payload = samplePayload([
      { type: "ai_overview", rank_group: 1, rank_absolute: 1, items: [] },
      { type: "local_pack", rank_group: 1, rank_absolute: 2, title: "Clinic", domain: null },
      organic(1, "www.practo.com", "/pune/dentist"),
      organic(2, "www.justdial.com"),
      { type: "people_also_ask", rank_group: 1, rank_absolute: 5, items: [] },
      organic(3, "practo.com", "/other"), // same domain again (no www) — listed once
      organic(4, "lybrate.com"),
      organic(5, "www.acmedental.in", "/services/root-canal"),
      organic(6, "acmedental.in", "/"),
    ]);
    const { result } = parseEnvelope(payload);
    const r = parseSerpResult(result, "acmedental.in");
    expect(r.position).toBe(5);
    expect(r.url).toBe("https://www.acmedental.in/services/root-canal");
    expect(r.features).toEqual(["ai_overview", "local_pack", "people_also_ask"]);
    expect(r.competitors).toEqual([
      { domain: "practo.com", position: 1 },
      { domain: "justdial.com", position: 2 },
      { domain: "lybrate.com", position: 4 },
    ]);
  });

  it("returns null when the domain isn't in the top 100, with the top 3 as competitors", () => {
    const { result } = parseEnvelope(samplePayload([organic(1, "a.com"), organic(2, "b.com"), organic(3, "c.com"), organic(4, "d.com")]));
    const r = parseSerpResult(result, "acme.in");
    expect(r.position).toBeNull();
    expect(r.url).toBeNull();
    expect(r.competitors.map((c) => c.domain)).toEqual(["a.com", "b.com", "c.com"]);
  });

  it("matches subdomains, and lists nobody above position 1", () => {
    const { result } = parseEnvelope(samplePayload([organic(1, "blog.acme.in", "/post"), organic(2, "b.com")]));
    const r = parseSerpResult(result, "acme.in");
    expect(r.position).toBe(1);
    expect(r.competitors).toEqual([]);
  });

  it("notes a featured snippet held by the project", () => {
    const { result } = parseEnvelope(
      samplePayload([{ type: "featured_snippet", rank_group: 1, rank_absolute: 1, domain: "acme.in", url: "https://acme.in/faq" }, organic(1, "acme.in", "/faq")]),
    );
    const r = parseSerpResult(result, "acme.in");
    expect(r.ownsFeaturedSnippet).toBe(true);
    expect(r.features).toContain("featured_snippet");
  });

  it("survives junk and empty answers", () => {
    expect(parseSerpResult([], "acme.in")).toMatchObject({ position: null, features: [], competitors: [] });
    expect(parseSerpResult([null, 5, { items: "nope" }], "acme.in").position).toBeNull();
    const { result } = parseEnvelope({ status_code: 20000, tasks: [{ status_code: 40102, result: null }] });
    expect(parseSerpResult(result, "acme.in").position).toBeNull();
    const weird = parseSerpResult([{ items: [{ type: "organic", rank_group: "3", domain: "acme.in" }, { type: "organic", domain: "acme.in" }, { type: "organic", rank_group: 7, url: "https://acme.in/x" }] }], "acme.in");
    expect(weird.position).toBe(7); // falls back to the URL's host when domain is missing
  });

  it("does not match look-alike domains", () => {
    expect(matchesDomain("notacme.in", "acme.in")).toBe(false);
    expect(matchesDomain("acme.in.evil.com", "acme.in")).toBe(false);
    expect(matchesDomain("WWW.ACME.IN", "acme.in")).toBe(true);
    expect(matchesDomain("shop.acme.in", "acme.in")).toBe(true);
  });

  it("reads stored JSON defensively", () => {
    expect(readFeatures(["ai_overview", 3, null])).toEqual(["ai_overview"]);
    expect(readFeatures("x")).toEqual([]);
    expect(readCompetitors([{ domain: "a.com", position: 1 }, { domain: "", position: 2 }, "bad"])).toEqual([{ domain: "a.com", position: 1 }]);
  });
});
