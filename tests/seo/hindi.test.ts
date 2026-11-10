import { describe, expect, it } from "vitest";
import { PAGE_SEO, type PageSeo } from "@/lib/seo/pages";
import { renderedTitle, staticPageMetadata, type PageMetadataInput } from "@/lib/seo/metadata";
import { HINDI_PAIRS, HINDI_PATHS, hreflangFor, switchTarget } from "@/components/marketing/hi/pairs";
import { buildLlmsTxt, buildSitemap, MARKETING_ROUTES } from "@/lib/free-check/site-seo";
import { ABOUT_FAQ, FREE_CHECK_FAQ, HI_PLANS, HI_SERVICE_TIERS, HOME_FAQ, PRICING_FAQ, SERVICES_FAQ } from "@/components/marketing/hi/content";
import { MARKETING_PLANS, SERVICE_TIERS } from "@/components/marketing/plans";
import { hiWebPageLd } from "@/components/marketing/hi/seo";
import type { StaticPath } from "@/lib/seo/pages";

const DEVANAGARI = /[ऀ-ॿ]/;
const seo = PAGE_SEO as Record<string, PageSeo>;
type Meta = ReturnType<typeof staticPageMetadata>;
const langs = (m: Meta) => (m.alternates?.languages ?? {}) as Record<string, string>;

describe("Hindi page snippets", () => {
  it("every Hindi page is registered, in Hindi, with a 30–60 character full title and a 120–155 character description", () => {
    for (const path of HINDI_PATHS) {
      const p = seo[path];
      expect(p, path).toBeDefined();
      expect(p.lang).toBe("hi-IN");
      expect(p.title).toMatch(DEVANAGARI);
      expect(p.description).toMatch(DEVANAGARI);
      const full = renderedTitle(p);
      expect(full.endsWith(" · MyWebRank"), full).toBe(true); // short enough to keep the brand suffix
      expect(full.length, full).toBeGreaterThanOrEqual(30);
      expect(full.length, full).toBeLessThanOrEqual(60);
      expect(p.description.length, p.description).toBeGreaterThanOrEqual(120);
      expect(p.description.length, p.description).toBeLessThanOrEqual(155);
    }
  });

  it("Hindi titles and descriptions are unique across the whole site", () => {
    const all = Object.values(seo);
    expect(new Set(all.map((p) => renderedTitle(p))).size).toBe(all.length);
    expect(new Set(all.map((p) => p.description)).size).toBe(all.length);
  });
});

describe("hreflang", () => {
  it("is reciprocal between each English page and its Hindi page, with x-default → English", () => {
    for (const [en, hi] of Object.entries(HINDI_PAIRS)) {
      const enMeta = staticPageMetadata(en as StaticPath);
      const hiMeta = staticPageMetadata(hi as StaticPath);
      const expected = { "en-IN": en, "hi-IN": hi, "x-default": en };
      expect(langs(enMeta)).toEqual(expected);
      expect(langs(hiMeta)).toEqual(expected);
      expect(enMeta.alternates?.canonical).toBe(en);
      expect(hiMeta.alternates?.canonical).toBe(hi);
    }
  });

  it("Hindi pages use og:locale hi_IN with en_IN as the alternate; English pairs the reverse", () => {
    for (const [en, hi] of Object.entries(HINDI_PAIRS)) {
      const hiOg = staticPageMetadata(hi as StaticPath).openGraph as { locale: string; alternateLocale?: string[]; url: string };
      const enOg = staticPageMetadata(en as StaticPath).openGraph as { locale: string; alternateLocale?: string[] };
      expect(hiOg.locale).toBe("hi_IN");
      expect(hiOg.alternateLocale).toEqual(["en_IN"]);
      expect(hiOg.url).toBe(hi);
      expect(enOg.locale).toBe("en_IN");
      expect(enOg.alternateLocale).toEqual(["hi_IN"]);
    }
  });

  it("unpaired pages get no hreflang", () => {
    expect(hreflangFor("/features")).toBeUndefined();
    expect(staticPageMetadata("/features").alternates?.languages).toBeUndefined();
    const extra: Partial<PageMetadataInput> = {};
    expect(staticPageMetadata("/blog", extra).alternates).toEqual({ canonical: "/blog" });
  });

  it("the sitemap carries reciprocal absolute alternates for every pair", () => {
    const base = "https://example.com";
    const sm = buildSitemap(base);
    const abs = (p: string) => (p === "/" ? `${base}/` : `${base}${p}`);
    for (const [en, hi] of Object.entries(HINDI_PAIRS)) {
      const want = { "en-IN": abs(en), "hi-IN": abs(hi), "x-default": abs(en) };
      expect(sm.find((e) => e.url === abs(en))?.alternates?.languages, en).toEqual(want);
      expect(sm.find((e) => e.url === abs(hi))?.alternates?.languages, hi).toEqual(want);
    }
    expect(sm.find((e) => e.url === `${base}/features`)?.alternates).toBeUndefined();
  });
});

describe("Hindi routes in sitemap and llms.txt", () => {
  it("lists every Hindi page once, in its own llms.txt section", () => {
    for (const path of HINDI_PATHS) expect(MARKETING_ROUTES.filter((r) => r.path === path), path).toHaveLength(1);
    const txt = buildLlmsTxt("https://example.com");
    expect(txt).toContain("## Hindi");
    for (const path of HINDI_PATHS) expect(txt).toContain(`](https://example.com${path})`);
  });
});

describe("Hindi content", () => {
  it("prices and limits come from the same plan constants as the English site", () => {
    expect(HI_PLANS.map((p) => [p.id, p.price])).toEqual(MARKETING_PLANS.map((p) => [p.id, p.price]));
    expect(HI_SERVICE_TIERS.map((t) => [t.id, t.price, t.setup, t.minimumMonths])).toEqual(
      SERVICE_TIERS.map((t) => [t.id, t.price, t.setup, t.minimumMonths]),
    );
  });

  it("FAQs are in Hindi and non-empty", () => {
    for (const list of [HOME_FAQ, PRICING_FAQ, SERVICES_FAQ, FREE_CHECK_FAQ, ABOUT_FAQ]) {
      expect(list.length).toBeGreaterThanOrEqual(2);
      for (const f of list) {
        expect(f.q).toMatch(DEVANAGARI);
        expect(f.a).toMatch(DEVANAGARI);
      }
    }
  });

  it("WebPage JSON-LD is hi-IN and points at the English original", () => {
    const ld = hiWebPageLd("/hi/pricing", { base: "https://example.com" });
    expect(ld.inLanguage).toBe("hi-IN");
    expect(ld.url).toBe("https://example.com/hi/pricing");
    expect(ld.translationOfWork).toEqual({ "@id": "https://example.com/pricing#webpage" });
  });

  it("the language switcher points at the counterpart, else the other home page", () => {
    expect(switchTarget("/pricing")).toMatchObject({ href: "/hi/pricing", lang: "hi" });
    expect(switchTarget("/hi/pricing")).toMatchObject({ href: "/pricing", lang: "en" });
    expect(switchTarget("/hi")).toMatchObject({ href: "/", lang: "en" });
    expect(switchTarget("/")).toMatchObject({ href: "/hi", lang: "hi" });
    expect(switchTarget("/features")).toMatchObject({ href: "/hi", lang: "hi" });
    expect(switchTarget("/history")).toMatchObject({ href: "/hi", lang: "hi" }); // "/hi" prefix only on a segment boundary
  });
});
