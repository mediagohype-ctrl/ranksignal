import { describe, expect, it } from "vitest";
import {
  brandNameVariants, isDomainDerivedName, namesForBrandChecks, parseAliases, siteNameSignals, suggestedBusinessName,
} from "@/lib/setup/brand-names";
import { businessSettingsHref, setupBannerTitle, setupGapList, setupGaps, setupIncomplete } from "@/lib/setup/completeness";
import { mentionsBrand } from "@/lib/crawler/extract";
import { businessFactsSchema } from "@/lib/setup/facts";
import { projectFactsSchema, readFacts } from "@/lib/dashboard/project-schema";

const SITE = "https://www.gohypemedia.com/";

describe("isDomainDerivedName", () => {
  it("spots a name that is only the web address", () => {
    expect(isDomainDerivedName("Gohypemedia", SITE)).toBe(true);
    expect(isDomainDerivedName("gohype-media", "gohype-media.in")).toBe(true);
    expect(isDomainDerivedName("Sharma Sweets", "https://sharma-sweets.co.in")).toBe(true);
  });
  it("is false for a different or empty name", () => {
    expect(isDomainDerivedName("GoHype", SITE)).toBe(false);
    expect(isDomainDerivedName("", SITE)).toBe(false);
  });
});

describe("setupGaps (old accounts that never finished setup)", () => {
  const old = { name: "Gohypemedia", websiteUrl: SITE, brandNames: ["Gohypemedia"], categories: [], audience: null, competitors: [], facts: null };

  it("lists everything an old account is missing", () => {
    const gaps = setupGaps(old);
    expect(gaps.map((g) => g.key)).toEqual(["name", "sells", "customers", "competitors", "facts"]);
    expect(setupIncomplete(gaps)).toBe(true);
    expect(setupBannerTitle(gaps)).toBe("Finish setting up: 5 details missing");
  });
  it("counts a name the owner confirmed, even when it matches the address", () => {
    const gaps = setupGaps({ ...old, facts: { name: "Gohypemedia" } });
    expect(gaps.some((g) => g.key === "name")).toBe(false);
  });
  it("is complete after the new setup", () => {
    const gaps = setupGaps({
      name: "Go Hype Media",
      websiteUrl: SITE,
      brandNames: ["Go Hype Media", "GoHype"],
      categories: ["Digital marketing"],
      audience: "Small businesses in Delhi",
      competitors: [{ name: "Rival Media" }],
      facts: { name: "Go Hype Media", sells: "Digital marketing", customers: "Small businesses", city: "Delhi" },
    });
    expect(gaps).toEqual([]);
    expect(setupIncomplete(gaps)).toBe(false);
  });
  it("does not nag about competitors or contact facts alone", () => {
    const gaps = setupGaps({ name: "Go Hype Media", websiteUrl: SITE, categories: ["Marketing"], audience: "Shops", competitors: [], facts: { name: "Go Hype Media" } });
    expect(gaps.map((g) => g.key)).toEqual(["competitors", "facts"]);
    expect(setupIncomplete(gaps)).toBe(false);
  });
  it("words the banner in plain English", () => {
    expect(setupBannerTitle([{ key: "sells", label: "what you sell" }])).toBe("Finish setting up: 1 detail missing");
    expect(setupGapList(setupGaps(old).slice(0, 3))).toBe("your business name, what you sell and who your customers are");
    expect(businessSettingsHref("p1")).toBe("/app/projects/p1/settings?tab=business#business");
  });
});

describe("names: every spelling counts", () => {
  it("builds the spaced / unspaced spellings", () => {
    expect(brandNameVariants(["Go Hype Media"])).toEqual(["Go Hype Media", "GoHype Media", "Go HypeMedia", "GoHypeMedia"]);
    expect(brandNameVariants(["Pubesto", "pubesto"])).toEqual(["Pubesto"]);
  });
  it("parses the 'other names' box", () => {
    expect(parseAliases("Go Hype Media, GoHype; gohype\n a", "go hype media")).toEqual(["GoHype"]);
  });
  it("matches a name whatever the spacing or case", () => {
    for (const text of ["Go Hype Media – Digital Marketing Agency", "Welcome to GoHype Media", "about gohypemedia", "GO-HYPE-MEDIA"]) {
      expect(mentionsBrand(text, ["Gohypemedia"]), text).toBe(true);
      expect(mentionsBrand(text, ["Go Hype Media"]), text).toBe(true);
    }
    expect(mentionsBrand("We love gohypemediagroup", ["Gohypemedia"])).toBe(false);
    expect(mentionsBrand("Creative Digital Marketing Agency in Delhi", ["Gohypemedia"])).toBe(false);
  });
  it("keeps short names exact", () => {
    expect(mentionsBrand("ac me tools", ["Acme"])).toBe(false);
    expect(mentionsBrand("Acme tools", ["Acme"])).toBe(true);
  });
});

describe("the site's own name signals", () => {
  const home = {
    title: "Creative Digital Marketing Agency in Delhi | GoHype",
    openGraph: { siteName: "Go Hype Media" },
    organization: { name: null },
    images: [{ src: "/img/logo.png", alt: "GoHype logo" }],
  };
  it("reads site name, headline brand part and logo text", () => {
    expect(siteNameSignals(home, SITE)).toEqual(["Go Hype Media", "GoHype"]);
  });
  it("suggests the properly written name while ours is a guess", () => {
    expect(suggestedBusinessName("Gohypemedia", SITE, home)).toBe("Go Hype Media");
    expect(suggestedBusinessName("Go Hype Media", SITE, home)).toBeNull(); // already confirmed-looking
    expect(suggestedBusinessName("Gohypemedia", SITE, null)).toBeNull();
    expect(suggestedBusinessName("Gohypemedia", SITE, { title: "Welcome | Best Agency" })).toBeNull(); // unrelated to the address
  });
  it("adds the site's names to the brand check only while the name is a guess", () => {
    expect(namesForBrandChecks(["Gohypemedia"], SITE, home)).toEqual(["Gohypemedia", "Go Hype Media", "GoHype"]);
    expect(namesForBrandChecks(["Hype Co"], SITE, home)).toEqual(["Hype Co"]);
    expect(namesForBrandChecks([], SITE, home)).toEqual(["Go Hype Media", "GoHype"]);
  });
});

describe("confirmed facts (Project.facts)", () => {
  it("accepts the optional founder / address / phone / services", () => {
    const f = businessFactsSchema.parse({ name: "Go Hype Media", founder: " Asha ", services: "SEO, Ads" });
    expect(f).toMatchObject({ name: "Go Hype Media", founder: "Asha", services: "SEO, Ads", country: "IN" });
    expect(projectFactsSchema.parse({ name: "X", phone: "123", address: "12 MG Road" })).toEqual({ name: "X", phone: "123", address: "12 MG Road" });
    expect(readFacts({ founder: "Asha", junk: 1 })).toEqual({ founder: "Asha" });
  });
});
