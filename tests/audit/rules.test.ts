import { describe, expect, it } from "vitest";
import type { ExtractedPage } from "@/lib/types";
import { auditPage, auditSite, runAudit, type AuditPage, type SiteContext } from "@/lib/audit/rules";

function page(url: string, x: Partial<ExtractedPage> = {}, extra: Partial<AuditPage> = {}): AuditPage {
  const extracted: ExtractedPage = {
    title: "A perfectly reasonable page title",
    description: "A helpful description of the page.",
    h1: ["Heading"],
    headings: [{ level: 1, text: "Heading" }, { level: 2, text: "Sub" }],
    canonical: url,
    robotsMeta: null,
    lang: "en",
    internalLinks: [],
    externalLinks: [],
    images: [],
    jsonLd: [{ "@type": "Organization" }],
    schemaTypes: ["Organization"],
    wordCount: 800,
    textSample: "text",
    hasFaq: false,
    contentFingerprint: `fp-${url}`,
    ...x,
  };
  return { url, finalUrl: url, statusCode: 200, redirectChain: [], contentType: "text/html", extracted, ...extra };
}

const site: SiteContext = {
  homepageUrl: "https://example.com/",
  robots: { fetched: true, status: 200, blockedAiCrawlers: [] },
  sitemapsFound: ["https://example.com/sitemap.xml"],
  llmsTxtFound: true,
};
const codes = (fs: { code: string }[]) => fs.map((f) => f.code).sort();

describe("auditPage", () => {
  it("returns nothing for a clean page", () => {
    expect(auditPage(page("https://example.com/"))).toEqual([]);
  });

  it("flags metadata, heading, indexability and content issues", () => {
    const f = auditPage(
      page("https://example.com/x", {
        title: null,
        description: null,
        h1: ["a", "b"],
        headings: [{ level: 1, text: "a" }, { level: 1, text: "b" }, { level: 4, text: "c" }],
        canonical: "https://other.com/x",
        robotsMeta: "noindex, nofollow",
        lang: null,
        images: [{ src: "/a.png", alt: null }, { src: "/b.png", alt: "" }],
        wordCount: 120,
      }),
    );
    expect(codes(f)).toEqual(
      ["canonical_other_host", "heading_level_skip", "images_missing_alt", "missing_lang", "missing_meta_description", "missing_title", "multiple_h1", "noindex", "thin_content"].sort(),
    );
    expect(f.find((x) => x.code === "images_missing_alt")!.evidence.count).toBe(1);
    for (const x of f) {
      expect(x.pageUrl).toBe("https://example.com/x");
      expect(x.confidence).toBeGreaterThan(0);
    }
  });

  it("flags title length bounds and missing h1/canonical", () => {
    expect(codes(auditPage(page("https://example.com/l", { title: "x".repeat(80) })))).toContain("title_too_long");
    expect(codes(auditPage(page("https://example.com/s", { title: "Hi" })))).toContain("title_too_short");
    expect(codes(auditPage(page("https://example.com/h", { h1: [], headings: [], canonical: null })))).toEqual(["missing_canonical", "missing_h1"]);
  });

  it("flags non-200 and redirect chains", () => {
    expect(codes(auditPage(page("https://example.com/404", {}, { statusCode: 404, extracted: null })))).toEqual(["client_error"]);
    expect(auditPage(page("https://example.com/500", {}, { statusCode: 503 }))[0].severity).toBe("high");
    expect(codes(auditPage(page("https://example.com/r", {}, { redirectChain: ["http://example.com/r", "https://www.example.com/r"] })))).toContain("redirect_chain");
    expect(codes(auditPage(page("https://example.com/e", {}, { statusCode: null, error: "timeout" })))).toEqual(["fetch_failed"]);
  });

  it("flags question-style pages without FAQ/HowTo schema", () => {
    const q = page("https://example.com/faq", {
      headings: [{ level: 1, text: "FAQ" }, { level: 2, text: "What is it?" }, { level: 2, text: "How much?" }],
    });
    expect(codes(auditPage(q))).toContain("question_page_without_faq_schema");
    expect(codes(auditPage({ ...q, extracted: { ...q.extracted!, hasFaq: true } }))).not.toContain("question_page_without_faq_schema");
  });
});

describe("auditSite", () => {
  it("detects duplicates across pages", () => {
    const pages = [
      page("https://example.com/a", { title: "Same Title Here", description: "dup", contentFingerprint: "same" }),
      page("https://example.com/b/", { title: "same title here", description: "dup", contentFingerprint: "same" }),
      page("https://example.com/c"),
    ];
    const f = auditSite(pages, site);
    expect(f.filter((x) => x.code === "duplicate_title")).toHaveLength(2);
    expect(f.filter((x) => x.code === "duplicate_meta_description")).toHaveLength(2);
    expect(f.filter((x) => x.code === "duplicate_content")).toHaveLength(2);
  });

  it("detects broken internal links from crawled statuses", () => {
    const pages = [
      page("https://example.com/", { internalLinks: ["https://example.com/gone/", "https://example.com/ok"] }),
      page("https://example.com/gone", {}, { statusCode: 404, extracted: null }),
      page("https://example.com/ok"),
    ];
    const broken = auditSite(pages, site).filter((x) => x.code === "broken_internal_link");
    expect(broken).toHaveLength(1);
    expect(broken[0].evidence.status).toBe(404);
    expect(broken[0].evidence.linkedFrom).toEqual(["https://example.com/"]);
  });

  it("reports site-level sitemap, AI crawler, schema and llms.txt signals", () => {
    const pages = [page("https://example.com/", { jsonLd: [], schemaTypes: [] })];
    const f = auditSite(pages, {
      ...site,
      sitemapsFound: [],
      llmsTxtFound: false,
      robots: { fetched: true, status: 200, blockedAiCrawlers: ["GPTBot", "OAI-SearchBot"] },
    });
    expect(codes(f)).toEqual(["ai_crawler_access", "missing_organization_schema", "no_llms_txt", "no_sitemap", "no_structured_data"]);
    expect(f.find((x) => x.code === "ai_crawler_access")!.severity).toBe("medium");
    const llms = f.find((x) => x.code === "no_llms_txt")!;
    expect(llms.severity).toBe("info");
    expect(llms.message).toMatch(/emerging convention/);
  });

  it("rates training-only AI crawler blocks as info", () => {
    const f = auditSite([page("https://example.com/")], { ...site, robots: { fetched: true, status: 200, blockedAiCrawlers: ["GPTBot", "ClaudeBot"] } });
    expect(f.find((x) => x.code === "ai_crawler_access")!.severity).toBe("info");
  });

  it("runAudit combines page and site rules", () => {
    const f = runAudit([page("https://example.com/", { description: null })], { ...site, llmsTxtFound: false });
    expect(codes(f)).toEqual(["missing_meta_description", "no_llms_txt"]);
  });
});
