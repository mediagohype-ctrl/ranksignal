import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeSchema, hasField } from "@/lib/tools/schema";
import { ruleForType, SCHEMA_RULES } from "@/lib/tools/schema-rules";

const ld = (obj: unknown) => `<script type="application/ld+json">${typeof obj === "string" ? obj : JSON.stringify(obj)}</script>`;
const page = (body: string) => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
const status = (r: ReturnType<typeof analyzeSchema>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("schema rules", () => {
  it("every rule links to Google's documentation", () => {
    for (const r of SCHEMA_RULES) expect(r.docUrl).toMatch(/^https:\/\/developers\.google\.com\/search\//);
  });
  it("maps subtypes to their rule", () => {
    expect(ruleForType("Plumber")?.key).toBe("LocalBusiness");
    expect(ruleForType("BlogPosting")?.key).toBe("Article");
    expect(ruleForType("https://schema.org/Product")?.key).toBe("Product");
    expect(ruleForType("Thing")).toBeUndefined();
  });
});

describe("hasField", () => {
  it("handles nested paths, arrays and empty values", () => {
    expect(hasField({ offers: [{ price: "" }, { price: 10 }] }, "offers.price")).toBe(true);
    expect(hasField({ offers: { price: "" } }, "offers.price")).toBe(false);
    expect(hasField({ author: "Jane" }, "author.name")).toBe(false);
    expect(hasField({ sameAs: [] }, "sameAs")).toBe(false);
  });
});

describe("analyzeSchema", () => {
  it("fails a page with no markup", () => {
    const r = analyzeSchema(page("<p>Hi</p>"));
    expect(r.blocks).toHaveLength(0);
    expect(status(r, "jsonld")).toBe("fail");
  });

  it("passes a complete LocalBusiness and pretty-prints the code", () => {
    const r = analyzeSchema(
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Plumber",
          name: "Sharma Plumbing",
          address: { "@type": "PostalAddress", addressLocality: "Pune" },
          url: "https://example.com",
          telephone: "+91 98765 43210",
          geo: { "@type": "GeoCoordinates", latitude: 18.5, longitude: 73.8 },
          openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", opens: "09:00" }],
          priceRange: "₹₹",
          aggregateRating: { "@type": "AggregateRating", ratingValue: 4.8, reviewCount: 120 },
          review: [{ "@type": "Review", author: { "@type": "Person", name: "A" }, reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5 }, datePublished: "2026-01-01" }],
        }),
      ),
    );
    expect(r.types).toEqual(expect.arrayContaining(["Plumber", "PostalAddress", "AggregateRating", "Review"]));
    const lb = r.nodes.find((n) => n.ruleKey === "LocalBusiness");
    expect(lb?.status).toBe("pass");
    // Nested rating/review need no itemReviewed.
    expect(r.nodes.find((n) => n.ruleKey === "AggregateRating")?.missingRequired).toEqual([]);
    expect(r.nodes.find((n) => n.ruleKey === "Review")?.missingRequired).toEqual([]);
    expect(r.blocks[0].code).toContain('\n  "@type": "Plumber"');
    expect(status(r, "required")).toBe("pass");
  });

  it("flags invalid JSON and keeps the raw text for display", () => {
    const r = analyzeSchema(page(ld('{"@context":"https://schema.org","@type":"Organization",}') + ld({ "@context": "https://schema.org", "@type": "WebSite", name: "X", url: "https://x.com" })));
    expect(r.invalidCount).toBe(1);
    expect(r.blocks[0].valid).toBe(false);
    expect(r.blocks[0].error).toBeTruthy();
    expect(r.blocks[0].code).toContain('"@type":"Organization"');
    expect(status(r, "invalid")).toBe("fail");
    expect(r.nodes.find((n) => n.type === "WebSite")?.status).toBe("warn"); // alternateName recommended
  });

  it("reports missing required fields, one-of groups and top-level itemReviewed", () => {
    const r = analyzeSchema(
      page(
        ld({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Product", description: "A thing" },
            { "@type": "Event", name: "Launch" },
            { "@type": "AggregateRating", ratingValue: 4 },
          ],
        }),
      ),
    );
    const product = r.nodes.find((n) => n.type === "Product")!;
    expect(product.missingRequired).toEqual(["name", "offers or review or aggregateRating"]);
    expect(r.nodes.find((n) => n.type === "Event")?.missingRequired).toEqual(["startDate", "location"]);
    expect(r.nodes.find((n) => n.type === "AggregateRating")?.missingRequired).toEqual(["ratingCount or reviewCount", "itemReviewed"]);
    expect(status(r, "required")).toBe("fail");
  });

  it("checks FAQ questions and breadcrumb steps only inside their parent type", () => {
    const r = analyzeSchema(
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Q1", acceptedAnswer: { "@type": "Answer", text: "A1" } },
            { "@type": "Question", name: "Q2" },
          ],
        }) +
          ld({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://x.com/" }, { "@type": "ListItem", name: "Page" }] }) +
          ld({ "@context": "https://schema.org", "@type": "ItemList", itemListElement: [{ "@type": "ListItem", url: "https://x.com/a" }] }),
      ),
    );
    const qs = r.nodes.filter((n) => n.ruleKey === "Question");
    expect(qs.map((q) => q.status)).toEqual(["pass", "fail"]);
    const steps = r.nodes.filter((n) => n.ruleKey === "ListItem");
    expect(steps).toHaveLength(2); // the ItemList's ListItem is not a breadcrumb
    expect(steps[1].missingRequired).toEqual(["position"]);
    expect(r.uncheckedTypes).toContain("ItemList");
  });

  it("notes Microdata and RDFa, a missing @context and untyped blocks", () => {
    const r = analyzeSchema(
      page(
        '<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">X</span></div><div vocab="https://schema.org/" typeof="Person"></div>' +
          ld({ "@type": "Organization", name: "X" }) +
          ld({ "@context": "https://schema.org", name: "no type" }),
      ),
    );
    expect(r.microdata).toEqual({ count: 1, types: ["Product"] });
    expect(r.rdfa).toEqual({ count: 1, types: ["Person"] });
    expect(status(r, "context")).toBe("warn");
    expect(status(r, "untyped")).toBe("warn");
  });

  it("strips HTML comment wrappers and caps block size", () => {
    const r = analyzeSchema(page(`<script type="application/ld+json"><!-- {"@context":"https://schema.org","@type":"WebSite","name":"X","url":"https://x.com"} --></script>`));
    expect(r.blocks[0].valid).toBe(true);
    const big = analyzeSchema(page(ld({ "@context": "https://schema.org", "@type": "Thing", text: "x".repeat(210_000) })));
    expect(big.blocks).toHaveLength(0);
    expect(big.skippedBlocks).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------- route
const fetchPublicHtml = vi.fn();
vi.mock("@/lib/tools/fetch-page", () => ({ fetchPublicHtml: (...a: unknown[]) => fetchPublicHtml(...a) }));

describe("POST /api/public/tools/schema-checker", { timeout: 30_000 }, () => {
  beforeEach(() => fetchPublicHtml.mockReset());
  it("returns the report with no-store", async () => {
    fetchPublicHtml.mockResolvedValue({ url: "https://x.com/", finalUrl: "https://x.com/", status: 200, html: page(ld({ "@context": "https://schema.org", "@type": "WebSite", name: "X", url: "https://x.com" })), bytes: 50 });
    const { POST } = await import("@/app/api/public/tools/schema-checker/route");
    const res = await POST(
      new Request("http://localhost/api/public/tools/schema-checker", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9" },
        body: JSON.stringify({ url: "x.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = (await res.json()) as { result: { types: string[] } };
    expect(data.result.types).toEqual(["WebSite"]);
  });
});
