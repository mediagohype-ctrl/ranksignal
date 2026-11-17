import { describe, expect, it } from "vitest";
import { buildFixSite, profileLinks, looksLikeStore, type FixSite } from "@/lib/fix-guides/site";
import { escapeHtml, jsonLdScript, llmsTxtCode, LOGO_PLACEHOLDER, organizationCode, shareTagsCode } from "@/lib/fix-guides/ready-code";
import { homeTitle, isProductPage, suggestSummaries, suggestTitles, TITLE_LIMIT } from "@/lib/fix-guides/suggest-titles";
import { changesAsTable } from "@/lib/fix-guides/copy";
import { resolveFix } from "@/lib/fix-guides";
import { uniqueTitleDrafts, type RecDraft } from "@/lib/recommendations/rules";
import type { ExtractedPage } from "@/lib/types";
import type { ReportIssue } from "@/lib/report/types";

const ex = (o: Partial<ExtractedPage>): ExtractedPage =>
  ({ title: null, description: null, h1: [], headings: [], canonical: null, robotsMeta: null, lang: null, internalLinks: [], externalLinks: [], images: [], jsonLd: [], schemaTypes: [], wordCount: 0, textSample: "", hasFaq: false, contentFingerprint: "x", ...o }) as ExtractedPage;

const SITE: FixSite = {
  websiteUrl: "https://gohypemedia.com/",
  name: "Go Hype Media",
  description: null,
  logo: "https://gohypemedia.com/logo.png",
  sameAs: ["https://www.linkedin.com/company/gohype"],
  sells: "Digital marketing",
  customers: null,
  city: "Delhi",
  country: "IN",
  address: null,
  phone: null,
  founder: null,
  services: null,
  isStore: false,
};

describe("profileLinks", () => {
  it("keeps one official profile per platform and drops share buttons and posts", () => {
    expect(
      profileLinks([
        "https://www.linkedin.com/company/gohype/",
        "https://linkedin.com/company/other",
        "https://www.facebook.com/sharer/sharer.php?u=x",
        "https://instagram.com/gohype?igsh=1",
        "https://x.com/gohype/status/123",
        "https://twitter.com/gohype",
        "https://example.com/about",
        "javascript:alert(1)",
      ]),
    ).toEqual(["https://www.linkedin.com/company/gohype", "https://instagram.com/gohype", "https://twitter.com/gohype"]);
  });
});

describe("buildFixSite", () => {
  it("reads logo, profiles and confirmed facts", () => {
    const s = buildFixSite({
      websiteUrl: "https://gohypemedia.com/",
      name: "Gohypemedia",
      facts: { name: "Go Hype Media", sells: "Digital marketing", city: "Delhi", country: "IN", phone: "+91 00000 00000" },
      pages: [{ url: "https://gohypemedia.com/", extracted: ex({ images: [{ src: "/img/logo.svg", alt: "logo" }], socialLinks: ["https://www.instagram.com/gohype/"] }) }],
    });
    expect(s).toMatchObject({ name: "Go Hype Media", logo: "https://gohypemedia.com/img/logo.svg", sameAs: ["https://www.instagram.com/gohype"], city: "Delhi", phone: "+91 00000 00000", isStore: false });
  });
  it("spots an online store", () => {
    expect(looksLikeStore([{ url: "https://x.in/products/fan", extracted: ex({}) }])).toBe(true);
    expect(looksLikeStore([{ url: "https://x.in/about", extracted: ex({}) }], "shopify")).toBe(true);
    expect(looksLikeStore([{ url: "https://x.in/about", extracted: ex({}) }])).toBe(false);
  });
});

describe("ready code", () => {
  it("fills the business info with real details and no blanks", () => {
    const r = organizationCode(SITE);
    expect(r.code).toContain('"url": "https://gohypemedia.com/"');
    expect(r.code).toContain('"logo": "https://gohypemedia.com/logo.png"');
    expect(r.code).toContain("linkedin.com/company/gohype");
    expect(r.code).not.toMatch(/YOUR WEBSITE ADDRESS|LINK TO YOUR/);
    const data = JSON.parse(r.code.replace(/^<script[^>]*>\n|\n<\/script>$/g, ""));
    expect(data).toMatchObject({ "@type": "Organization", name: "Go Hype Media", areaServed: "Delhi" });
  });
  it("leaves ONE marked placeholder with a note when the logo is unknown", () => {
    const r = organizationCode({ ...SITE, logo: null, sameAs: [] });
    expect(r.code.split(LOGO_PLACEHOLDER).length - 1).toBe(1);
    expect(r.code).not.toContain("sameAs");
    expect(r.note).toMatch(/logo/);
  });
  it("becomes a LocalBusiness with the confirmed address and phone", () => {
    const data = JSON.parse(organizationCode({ ...SITE, address: "12 MG Road", phone: "123", founder: "Asha" }).code.replace(/^<script[^>]*>\n|\n<\/script>$/g, ""));
    expect(data).toMatchObject({ "@type": "LocalBusiness", telephone: "123", founder: { name: "Asha" }, address: { streetAddress: "12 MG Road", addressLocality: "Delhi", addressCountry: "IN" } });
  });
  it("escapes values so they can't break out of the script tag or attribute", () => {
    const code = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(code).not.toContain("</script><script>");
    expect(JSON.parse(code.replace(/^<script[^>]*>\n|\n<\/script>$/g, "")).name).toBe("</script><script>alert(1)</script>");
    expect(escapeHtml(`"><b>`)).toBe("&quot;&gt;&lt;b&gt;");
    const tags = shareTagsCode({ ...SITE, name: 'A "B"' }, { url: "https://gohypemedia.com/", note: null, extracted: null }, "Hi <there>");
    expect(tags.code).toContain('content="Hi &lt;there&gt;"');
    expect(tags.code).toContain('content="A &quot;B&quot;"');
  });
  it("writes the AI guide file from the site's pages", () => {
    const r = llmsTxtCode(SITE, [{ url: "https://gohypemedia.com/seo", title: "SEO [services]", description: "Local SEO" }]);
    expect(r.code).toMatch(/^# Go Hype Media\n\n> Go Hype Media: Digital marketing in Delhi\./);
    expect(r.code).toContain("- [SEO services](https://gohypemedia.com/seo): Local SEO");
  });
  it("is part of the resolved fix, and the steps point at it", () => {
    const issue = { id: "brand-organization_schema", pillar: "brand", title: "t", whatsWrong: "w", whyItMatters: "y", howToFix: [], impact: "medium", effort: "quick", affectedUrls: [], affectedCount: 1 } as ReportIssue;
    const fix = resolveFix({ brand: "Go Hype Media", websiteUrl: SITE.websiteUrl, platform: "react", issue, pages: [], site: SITE });
    expect(fix.ready?.code).toContain("Go Hype Media");
    expect(fix.steps.join(" ")).not.toMatch(/YOUR WEBSITE ADDRESS/);
    expect(fix.prompt).toContain("READY CODE");
    expect(fix.time).toBe("About 15 min");
    const bare = resolveFix({ brand: "Go Hype Media", websiteUrl: SITE.websiteUrl, platform: "react", issue, pages: [] });
    expect(bare.ready).toBeNull();
  });
});

describe("suggestTitles", () => {
  const ctx = { brand: "Pubesto", sells: "Portable fans, bottles and festive decor", country: "IN", isStore: true };
  it("makes the home page business-wide", () => {
    expect(homeTitle(ctx)).toBe("Pubesto: Portable Fans, Bottles & Festive Decor Online in India");
    expect(homeTitle({ brand: "Sharma Sweets", sells: "Cakes", city: "Pune" })).toBe("Sharma Sweets: Cakes in Pune");
  });
  it("names products with what people search, only for stores in India", () => {
    const p = { url: "https://pubesto.in/products/adjustable-bladeless-neck-fan", extracted: { title: "Shop | Pubesto", h1: ["Adjustable Bladeless Neck Fan"], schemaTypes: ["Product"] } };
    expect(isProductPage(p)).toBe(true);
    expect(suggestTitles([p], ctx)[0]).toBe("Adjustable Bladeless Neck Fan – Buy Online in India | Pubesto");
    expect(suggestTitles([p], { ...ctx, country: "US" })[0]).toBe("Adjustable Bladeless Neck Fan | Pubesto");
  });
  it("never repeats a suggestion in a batch", () => {
    const pages = Array.from({ length: 15 }, (_, i) => ({ url: `https://pubesto.in/shop/${["fans", "bottles", "decor"][i % 3]}${i >= 3 ? `?page=${i}` : ""}`, extracted: { title: "Shop | Pubesto", h1: ["Shop"] } }));
    const t = suggestTitles(pages, ctx);
    expect(new Set(t.map((x) => x.toLowerCase())).size).toBe(15);
    expect(t[0]).toBe("Fans | Pubesto");
    for (const x of t) expect(x.length).toBeLessThanOrEqual(TITLE_LIMIT + 5);
  });
  it("tells pages with one shared heading apart by their address", () => {
    const t = suggestTitles(
      [
        { url: "https://x.in/grow", extracted: { h1: ["Creative Digital Marketing Agency in Delhi"] } },
        { url: "https://x.in/about-us", extracted: { h1: ["Creative Digital Marketing Agency in Delhi"] } },
      ],
      { brand: "Go Hype Media" },
    );
    expect(t[0]).toBe("Grow | Go Hype Media");
    expect(t[1]).toMatch(/^About us | Go Hype Media$/);
  });
  it("writes different summaries for every page", () => {
    const s = suggestSummaries(
      [
        { url: "https://x.in/a", extracted: { textSample: "Same opening sentence for every single page on this website." } },
        { url: "https://x.in/b", extracted: { textSample: "Same opening sentence for every single page on this website." } },
      ],
      { brand: "Acme" },
    );
    expect(s[0]).not.toBe(s[1]);
  });
});

describe("copy helpers", () => {
  it("copies the table as tab-separated rows", () => {
    expect(changesAsTable([{ page: "/a", now: "x\ty", change: "New" }])).toBe("Page\tNow\tChange it to\n/a\tx y\tNew");
  });
});

describe("uniqueTitleDrafts (drafted headline changes)", () => {
  it("rebuilds duplicate headlines from each page's address", () => {
    const d = (url: string): RecDraft => ({
      type: "update_title", target: { resourceType: "page", url }, rationale: "", evidenceRefs: [], impact: 2, effort: "low", confidence: 0.6, expectedImpact: "",
      proposedChange: { field: "title", before: "Shop | Pubesto", after: "Shop" },
    }) as RecDraft;
    const out = uniqueTitleDrafts([d("https://p.in/shop/fans"), d("https://p.in/shop/bottles")], "Pubesto");
    expect(out.map((x) => x.proposedChange!.after)).toEqual(["Fans | Pubesto", "Bottles | Pubesto"]);
  });
});
