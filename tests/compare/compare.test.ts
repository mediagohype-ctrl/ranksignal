import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECKED_ON,
  COMPARE_PAGES,
  COMPETITORS,
  formatCheckedOn,
  formatFrom,
  trademarkNote,
} from "@/lib/compare/competitors";
import { PAGE_SEO } from "@/lib/seo/pages";

const competitors = Object.values(COMPETITORS);
const ALL_PATHS = ["/compare", ...COMPARE_PAGES.map((p) => p.path)];

/** Hosts each competitor's facts may come from: its own site (Search Console: Google's own pages). */
const OWN_HOSTS: Record<string, string[]> = {
  ahrefs: ["ahrefs.com"],
  semrush: ["www.semrush.com", "semrush.com"],
  "se-ranking": ["seranking.com"],
  ubersuggest: ["ubersuggest.com"],
  "search-console": ["support.google.com", "search.google.com", "developers.google.com"],
};

describe("competitor facts", () => {
  it("every competitor has a checkedOn date and a USD starting price", () => {
    for (const c of competitors) {
      expect(c.checkedOn, c.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.checkedOn, c.name).toBe(CHECKED_ON);
      expect(c.pricingFrom.currency, c.name).toBe("USD");
      expect(c.pricingFrom.amount, c.name).toBeGreaterThanOrEqual(0);
      expect(c.pricingFrom.note.length, c.name).toBeGreaterThan(0);
    }
  });

  it("every fact has an https source on the competitor's own site", () => {
    for (const c of competitors) {
      expect(c.facts.length, c.name).toBeGreaterThan(0);
      for (const url of [c.pricingUrl, ...c.facts.map((f) => f.source)]) {
        const u = new URL(url);
        expect(u.protocol, `${c.name}: ${url}`).toBe("https:");
        expect(OWN_HOSTS[c.id], `${c.name}: ${url}`).toContain(u.hostname);
      }
      for (const f of c.facts) expect(f.text.trim().length, c.name).toBeGreaterThan(10);
    }
  });

  it("the pricing page is cited by at least one fact", () => {
    for (const c of competitors) expect(c.facts.some((f) => f.source === c.pricingUrl), c.name).toBe(true);
  });

  it("no competitor price is shown in rupees", () => {
    for (const c of competitors) {
      for (const f of c.facts) expect(f.text, c.name).not.toMatch(/₹|\bINR\b|rupee/i);
      expect(c.pricingFrom.note, c.name).not.toMatch(/₹|\bINR\b|rupee/i);
    }
  });
});

describe("compare pages", () => {
  it("every compare path is registered in PAGE_SEO", () => {
    for (const p of ALL_PATHS) expect(Object.keys(PAGE_SEO), p).toContain(p);
  });

  it("every compare path has a page file", () => {
    for (const p of ALL_PATHS) {
      const file = path.resolve(__dirname, "../../src/app/(marketing)", `.${p}`, "page.tsx");
      expect(existsSync(file), file).toBe(true);
    }
  });
});

describe("formatting helpers", () => {
  it("formats the checked-on date as shown on the pages", () => {
    expect(formatCheckedOn("2026-11-09")).toBe("9 Nov 2026");
  });

  it("formats starting prices in the competitor's own currency", () => {
    expect(formatFrom(COMPETITORS.ahrefs)).toBe("$29/mo");
    expect(formatFrom(COMPETITORS["search-console"])).toBe("Free");
  });

  it("keeps the exact trademark sentence", () => {
    expect(trademarkNote()).toBe(
      "Ahrefs, Semrush and SE Ranking are trademarks of their respective owners. MyWebRank is not affiliated with them.",
    );
  });
});
