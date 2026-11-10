import { describe, expect, it } from "vitest";
import {
  findPhrase,
  linkTaskTitle,
  pageLabel,
  snippetAround,
  suggestInternalLinks,
  suggestionsToCsv,
  titleTopic,
  topicPhrases,
  type LinkPage,
} from "@/lib/links/suggest";

const SITE = "https://acme.example";

function page(path: string, o: { title?: string; h1?: string; text?: string; links?: string[]; words?: number; robots?: string; canonical?: string; status?: number } = {}): LinkPage {
  const url = `${SITE}${path}`;
  return {
    url,
    finalUrl: url,
    statusCode: o.status ?? 200,
    contentType: "text/html",
    extracted: {
      title: o.title ?? null,
      h1: o.h1 ? [o.h1] : [],
      headings: o.h1 ? [{ level: 1, text: o.h1 }] : [],
      internalLinks: (o.links ?? []).map((l) => `${SITE}${l}`),
      textSample: o.text ?? "",
      wordCount: o.words ?? 400,
      robotsMeta: o.robots ?? null,
      canonical: o.canonical ?? null,
    },
  };
}

describe("titleTopic / pageLabel", () => {
  it("drops the brand suffix", () => {
    expect(titleTopic("Website SEO audit | Acme", ["Acme"])).toBe("Website SEO audit");
    expect(titleTopic("Acme - Pricing plans", ["Acme"])).toBe("Pricing plans");
    expect(titleTopic(null)).toBe("");
  });
  it("labels the home page and falls back to the address", () => {
    expect(pageLabel(page("/", { title: "Acme | Home" }))).toBe("Home");
    expect(pageLabel(page("/our-services", {}))).toBe("Our services");
  });
});

describe("topicPhrases", () => {
  it("returns multi-word phrases, longest first, without filler edges or brand-only phrases", () => {
    const p = topicPhrases(page("/seo-audit", { title: "Website SEO audit for small businesses | Acme", h1: "Website SEO audit" }), ["Acme"]);
    expect(p[0].split(" ").length).toBeGreaterThanOrEqual(4);
    expect(p).toContain("website seo audit");
    expect(p).toContain("seo audit");
    expect(p.some((x) => x.startsWith("for ") || x.endsWith(" for"))).toBe(false);
    expect(p).not.toContain("acme");
  });
  it("skips generic phrases", () => {
    expect(topicPhrases(page("/x", { title: "Read more", h1: "Learn more" }))).toEqual([]);
  });
});

describe("findPhrase / snippetAround", () => {
  it("matches whole words only, case-insensitively", () => {
    expect(findPhrase("Get a Website SEO Audit today", "website seo audit")).toEqual({ index: 6, length: 17 });
    expect(findPhrase("seo auditing is different", "seo audit")).toBeNull();
    expect(findPhrase("myseo audit", "seo audit")).toBeNull();
  });
  it("cuts a snippet around the match", () => {
    const text = `${"word ".repeat(40)}SEO audit${" tail".repeat(40)}`;
    const i = text.indexOf("SEO audit");
    const s = snippetAround(text, i, 9, 30);
    expect(s.match).toBe("SEO audit");
    expect(s.before.startsWith("…")).toBe(true);
    expect(s.after.endsWith("…")).toBe(true);
  });
});

describe("suggestInternalLinks", () => {
  const pages = [
    page("/", { title: "Acme", text: "Welcome to Acme.", links: ["/pricing", "/blog/a", "/blog/b", "/contact"] }),
    page("/pricing", {
      title: "Pricing | Acme",
      text: "Our plans include a full website SEO audit and monthly reports for growing shops.",
      links: ["/", "/blog/a"],
    }),
    page("/blog/a", { title: "Ten SEO tips | Acme", text: "A website SEO audit finds problems early. Also see our pricing.", links: ["/", "/pricing"] }),
    page("/blog/b", { title: "Local listings | Acme", text: "Nothing related here.", links: ["/", "/pricing"] }),
    // Orphan target: nobody links here.
    page("/seo-audit", { title: "Website SEO audit | Acme", h1: "Website SEO audit", text: "We check your site.", links: ["/"] }),
    // Utility and noindex pages are never sources or targets.
    page("/contact", { title: "Contact | Acme", text: "Ask about a website SEO audit.", links: ["/"] }),
    page("/hidden", { title: "Hidden SEO audit page", text: "website seo audit", robots: "noindex", links: ["/"] }),
  ];

  const r = suggestInternalLinks(pages, { brandNames: ["Acme"], homepageUrl: SITE });

  it("finds orphan and weakly linked pages", () => {
    const orphan = r.weakPages.find((w) => w.url.endsWith("/seo-audit"));
    expect(orphan?.strength).toBe("orphan");
    expect(r.weakPages.find((w) => w.url.endsWith("/blog/b"))?.strength).toBe("weak");
    expect(r.weakPages.some((w) => w.url.endsWith("/contact") || w.url.endsWith("/hidden") || w.url === `${SITE}/`)).toBe(false);
    expect(r.orphanCount).toBeGreaterThanOrEqual(1);
  });

  it("suggests sources that mention the topic, ranked by authority, with the exact anchor text", () => {
    const toAudit = r.suggestions.filter((s) => s.targetUrl.endsWith("/seo-audit"));
    expect(toAudit.map((s) => s.sourceUrl)).toEqual([`${SITE}/pricing`, `${SITE}/blog/a`]);
    expect(toAudit[0].anchor).toBe("website SEO audit");
    expect(toAudit[1].anchor).toBe("website SEO audit");
    expect(toAudit[0].snippet.match).toBe("website SEO audit");
    expect(toAudit[0].sentence).toBe('Add a link from your "Pricing" page to your "Website SEO audit" page using the words "website SEO audit".');
    expect(toAudit[0].why).toMatch(/No other page/);
    expect(toAudit[0].targetStrength).toBe("orphan");
  });

  it("never suggests utility, noindex or already-linked sources", () => {
    expect(r.suggestions.some((s) => s.sourceUrl.endsWith("/contact") || s.sourceUrl.endsWith("/hidden"))).toBe(false);
    expect(r.suggestions.some((s) => s.targetUrl.endsWith("/contact") || s.targetUrl.endsWith("/hidden"))).toBe(false);
    // blog/a already links to /pricing.
    expect(r.suggestions.some((s) => s.sourceUrl.endsWith("/blog/a") && s.targetUrl.endsWith("/pricing"))).toBe(false);
  });

  it("treats http/www variants as one page and ignores self links", () => {
    const pagesV = [
      page("/", { title: "Home", links: ["/a"] }),
      { ...page("/a", { title: "Garden design ideas", text: "x", links: ["/a"] }) },
      { ...page("/b", { title: "B", text: "Try these garden design ideas now", links: [] }), url: "http://www.acme.example/b", finalUrl: "http://www.acme.example/b" },
    ];
    pagesV[0].extracted!.internalLinks.push("http://www.acme.example/b/");
    const rv = suggestInternalLinks(pagesV);
    expect(rv.weakPages.find((w) => w.url.endsWith("/b"))?.linksIn).toBe(1);
    expect(rv.weakPages.find((w) => w.url.endsWith("/a"))?.linksIn).toBe(1);
    expect(rv.suggestions[0]?.anchor).toBe("garden design ideas");
  });

  it("is empty for no pages", () => {
    expect(suggestInternalLinks([])).toMatchObject({ pagesAnalysed: 0, suggestions: [], weakPages: [] });
  });

  it("exports CSV safely and makes a to-do title", () => {
    const csv = suggestionsToCsv([{ ...r.suggestions[0], anchor: "=cmd" }]);
    expect(csv.split("\r\n")[0]).toContain("From page");
    expect(csv).toContain("'=cmd");
    expect(linkTaskTitle(r.suggestions[0])).toBe('Add a link from "Pricing" to "Website SEO audit"');
  });
});

describe("suggestInternalLinks performance", () => {
  it("handles a large crawl quickly", () => {
    const big: LinkPage[] = [];
    for (let i = 0; i < 1500; i++) {
      big.push(
        page(`/p${i}`, {
          title: `Topic number ${i} widget guide`,
          text: `Intro text ${"lorem ipsum dolor ".repeat(80)} see topic number ${(i * 7) % 1500} widget guide for more.`,
          links: [`/p${(i + 1) % 1500}`],
        }),
      );
    }
    const t0 = Date.now();
    const r = suggestInternalLinks(big);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(r.pagesAnalysed).toBe(1500);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});
