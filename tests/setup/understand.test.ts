import { describe, expect, it } from "vitest";
import { extractSiteSignals, heuristicFacts, extractJsonLdOrg, nameFromTitle, findCity } from "@/lib/setup/signals";
import {
  businessFactsSchema,
  countryCode,
  isPlaceholderOrgName,
  languageCode,
  placeholderOrgName,
  projectFieldsFromFacts,
  setupQuestionCount,
} from "@/lib/setup/facts";
import { preferredWebsite, websiteError, websiteHost } from "@/lib/setup/website";
import { cleanDomain, filterCompetitors } from "@/lib/setup/suggest";

const page = (head: string, body = "", lang = "en-IN") => `<!doctype html><html lang="${lang}"><head>${head}</head><body>${body}</body></html>`;

describe("JSON-LD → city / country", () => {
  it("reads a LocalBusiness PostalAddress", () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Bakery",
      name: "Sharma Sweets",
      description: "Fresh mithai and cakes since 1982.",
      address: { "@type": "PostalAddress", streetAddress: "12 MG Road", addressLocality: "Pune", addressCountry: "IN" },
    });
    const s = extractSiteSignals(page(`<title>Home | Sharma Sweets</title><script type="application/ld+json">${ld}</script>`), "https://sharmasweets.in/");
    expect(s.org).toMatchObject({ name: "Sharma Sweets", city: "Pune", country: "IN" });
    const f = heuristicFacts(s);
    expect(f).toMatchObject({ name: "Sharma Sweets", city: "Pune", country: "IN", language: "en", sells: "Fresh mithai and cakes since 1982." });
  });

  it("finds the org inside @graph and accepts a country name / object", () => {
    const org = extractJsonLdOrg([
      JSON.stringify({
        "@graph": [
          { "@type": "WebSite", name: "ignored" },
          {
            "@type": ["Organization", "LocalBusiness"],
            name: "Acme Dental",
            address: { addressLocality: "Dubai", addressCountry: { "@type": "Country", name: "United Arab Emirates" } },
          },
        ],
      }),
    ]);
    expect(org).toMatchObject({ name: "Acme Dental", city: "Dubai", country: "AE" });
  });

  it("parses a plain-text address", () => {
    const org = extractJsonLdOrg([JSON.stringify({ "@type": "Store", name: "Tool Hub", address: "Shop 4, FC Road, Pune, India" })]);
    expect(org).toMatchObject({ city: "Pune", country: "IN" });
  });

  it("ignores malformed JSON-LD blocks", () => {
    expect(extractJsonLdOrg(["{not json", JSON.stringify({ "@type": "WebPage", name: "x" })])).toBeNull();
  });
});

describe("html lang → language (and region → country)", () => {
  it("uses the lang subtag and its region", () => {
    const f = heuristicFacts(extractSiteSignals(page("<title>Kisan Seva</title>", "", "hi-IN"), "https://kisanseva.com"));
    expect(f.language).toBe("hi");
    expect(f.country).toBe("IN");
  });
  it("falls back to the domain ending, then India", () => {
    expect(heuristicFacts(extractSiteSignals(page("<title>Bloom</title>", "", "en"), "https://bloom.co.uk")).country).toBe("GB");
    const plain = heuristicFacts(extractSiteSignals(page("<title>Bloom</title>", "", ""), "https://bloom.com"));
    expect(plain.country).toBe("IN");
    expect(plain.language).toBe("en");
  });
  it("normalises codes", () => {
    expect(languageCode("EN_us")).toBe("en");
    expect(languageCode("not a lang")).toBeNull();
    expect(countryCode("India")).toBe("IN");
    expect(countryCode("usa")).toBe("US");
    expect(countryCode("in")).toBe("IN");
    expect(countryCode("Narnia")).toBeNull();
  });
});

describe("business name and city heuristics", () => {
  it("prefers og:site_name, then the title part that matches the domain", () => {
    const og = extractSiteSignals(page('<meta property="og:site_name" content="Kumar Bakers"><title>Best cakes</title>'), "https://kb.in");
    expect(heuristicFacts(og).name).toBe("Kumar Bakers");
    expect(nameFromTitle("Home | Sharma Sweets – Best mithai in Pune", "sharmasweets.in")).toBe("Sharma Sweets");
    expect(nameFromTitle("Welcome", "x.in")).toBe("");
  });
  it("falls back to the domain name", () => {
    expect(heuristicFacts(extractSiteSignals("<html><body></body></html>", "https://www.green-leaf.in")).name).toBe("Green Leaf");
  });
  it("spots a known city in the title / description", () => {
    expect(findCity("Best plumber in Navi  Mumbai")).toBe("Navi Mumbai");
    const s = extractSiteSignals(page('<title>Fix-It Plumbers</title><meta name="description" content="Fast plumbers in Bengaluru. Call now.">'), "https://fixit.in");
    expect(heuristicFacts(s)).toMatchObject({ city: "Bengaluru", sells: "Fast plumbers in Bengaluru." });
  });
  it("never reads script text as visible text", () => {
    const s = extractSiteSignals(page("", "<p>Hello</p><script>var secret = 1</script>"), "https://a.in");
    expect(s.text).toBe("Hello");
  });
});

describe("facts helpers", () => {
  it("validates and defaults facts", () => {
    expect(businessFactsSchema.parse({ name: " Acme " })).toEqual({ name: "Acme", sells: "", customers: "", city: "", country: "IN", language: "en" });
    expect(businessFactsSchema.safeParse({ name: "" }).success).toBe(false);
    expect(businessFactsSchema.parse({ name: "A", country: "ae", language: "HI" })).toMatchObject({ country: "AE", language: "hi" });
  });
  it("derives project fields from facts", () => {
    expect(projectFieldsFromFacts({ name: "Acme", sells: "Cakes", customers: "Families", city: "Pune", country: "IN", language: "en" })).toEqual({
      name: "Acme",
      brandNames: ["Acme"],
      categories: ["Cakes"],
      audience: "Families in Pune",
      countries: ["IN"],
      languages: ["en"],
    });
    expect(projectFieldsFromFacts({ name: "Acme", sells: "", customers: "", city: "", country: "IN", language: "en" }).audience).toBeUndefined();
  });
  it("uses a placeholder org name until setup renames it", () => {
    expect(placeholderOrgName("priya@gmail.com")).toBe("My business");
    expect(placeholderOrgName("priya@sharma-sweets.in")).toBe("Sharma Sweets");
    expect(isPlaceholderOrgName("My business", "a@b.com")).toBe(true);
    expect(isPlaceholderOrgName("Sharma Sweets", "priya@sharma-sweets.in")).toBe(true);
    expect(isPlaceholderOrgName("Renamed Co", "priya@sharma-sweets.in")).toBe(false);
  });
  it("asks 10–25 questions by plan", () => {
    expect(setupQuestionCount(10)).toBe(10);
    expect(setupQuestionCount(25)).toBe(25);
    expect(setupQuestionCount(100)).toBe(25);
    expect(setupQuestionCount(3)).toBe(10);
  });
});

describe("website + competitor helpers", () => {
  it("validates addresses in plain words", () => {
    expect(websiteHost("www.Acme.in/about")).toBe("acme.in");
    expect(websiteError("")).toMatch(/Type your website/);
    expect(websiteError("acme")).toMatch(/doesn't look like/);
    expect(websiteError("acme.in")).toBeNull();
  });
  it("keeps the landed URL only for the same site", () => {
    expect(preferredWebsite("acme.in", "https://www.acme.in/")).toBe("https://www.acme.in");
    expect(preferredWebsite("acme.in", "https://other.com/")).toBe("https://acme.in");
    expect(preferredWebsite("acme.in", null)).toBe("https://acme.in");
  });
  it("filters own site, duplicates and caps at 3", () => {
    expect(cleanDomain("https://www.X.com/path")).toBe("x.com");
    expect(cleanDomain("not a domain")).toBeUndefined();
    const out = filterCompetitors(
      [
        { name: "Acme", domain: "acme.in" },
        { name: "Self", domain: "www.acme.in" },
        { name: "B", domain: "b.in" },
        { name: "B again", domain: "https://b.in" },
        { name: "C" },
        { name: "D", domain: "d.in" },
        { name: "E", domain: "e.in" },
      ],
      { name: "Acme", host: "acme.in" },
    );
    expect(out).toEqual([{ name: "B", domain: "b.in" }, { name: "C" }, { name: "D", domain: "d.in" }]);
  });
});
