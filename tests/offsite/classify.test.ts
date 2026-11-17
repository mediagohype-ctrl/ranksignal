import { describe, expect, it } from "vitest";
import {
  adviceFor,
  canGetListed,
  classifyCitedSite,
  looksLikeListOrArticle,
  nameInText,
  siteLabel,
  tradeWordsOf,
} from "@/lib/offsite/classify";
import { splitCitations } from "@/lib/offsite/suggestions";

const agency = {
  ownedDomains: ["gohypemedia.com"],
  competitors: [],
  tradeWords: tradeWordsOf(["Digital marketing agency"]),
};

describe("classifyCitedSite", () => {
  it("treats real directories, marketplaces, review, social, Q&A and news sites as listing sites", () => {
    for (const [d, name] of [
      ["www.justdial.com", "Justdial"],
      ["indiamart.com", "IndiaMART"],
      ["clutch.co", "Clutch"],
      ["g2.com", "G2"],
      ["in.linkedin.com", "LinkedIn"],
      ["amazon.in", "Amazon"],
      ["reddit.com", "Reddit"],
      ["en.wikipedia.org", "Wikipedia"],
      ["business.google.com", "Google Business Profile"],
      ["yourstory.com", "YourStory"],
    ]) {
      const s = classifyCitedSite(d!, agency);
      expect(s.kind, d).toBe("listing");
      expect(s.name).toBe(name);
    }
  });

  it("never treats the business's own site, or search engines and AI vendors, as a place", () => {
    expect(classifyCitedSite("blog.gohypemedia.com", agency).kind).toBe("own");
    expect(classifyCitedSite("google.com", agency).kind).toBe("ignore");
    expect(classifyCitedSite("chatgpt.com", agency).kind).toBe("ignore");
  });

  it("a saved competitor is a competitor, by domain or by name", () => {
    const ctx = { ...agency, competitors: [{ name: "Schbang", domain: null }, { name: "X", domain: "techmagnate.com" }] };
    expect(classifyCitedSite("schbang.com", ctx)).toMatchObject({ kind: "competitor", reason: "saved", name: "Schbang" });
    expect(classifyCitedSite("www.techmagnate.com", ctx)).toMatchObject({ kind: "competitor", reason: "saved" });
  });

  it("a business the AI named in its answers is a competitor (the audit's schbang / socialbeat case)", () => {
    const answerTexts = ["For Delhi, consider Schbang, Social Beat and Techmagnate — all well-known agencies."];
    expect(classifyCitedSite("socialbeat.in", { ...agency, answerTexts })).toMatchObject({ kind: "competitor", reason: "named", name: "Social Beat" });
    expect(classifyCitedSite("schbang.com", { ...agency, namedBrands: ["Schbang"] })).toMatchObject({ kind: "competitor", reason: "named" });
  });

  it("a site in the same trade, or whose home page AI linked, looks like a business", () => {
    expect(classifyCitedSite("zeroadomarketing.com", agency)).toMatchObject({ kind: "competitor", reason: "same_trade" });
    expect(classifyCitedSite("zeroado.com", agency, [{ url: "https://zeroado.com/" }])).toMatchObject({ kind: "competitor", reason: "same_trade" });
  });

  it("an unknown site linked through a list or article is just a website AI links to", () => {
    const s = classifyCitedSite("someblog.in", agency, [{ url: "https://someblog.in/blog/top-10-digital-marketing-agencies-delhi" }]);
    expect(s).toMatchObject({ kind: "website", listLike: true, type: "best_list" });
    expect(adviceFor(s)).toMatch(/ask to be included/);
    const plain = classifyCitedSite("someblog.in", agency, [{ url: "https://someblog.in/a/b/c" }]);
    expect(plain).toMatchObject({ kind: "website", listLike: false });
    expect(adviceFor(plain)).toBe("See why AI links to this page.");
  });

  it("never advises getting listed on a competitor", () => {
    const s = classifyCitedSite("schbang.com", { ...agency, namedBrands: ["Schbang"] });
    expect(canGetListed(s)).toBe(false);
    expect(adviceFor(s)).not.toMatch(/get listed|create .*listing/i);
    expect(adviceFor(s)).toMatch(/not a place to be listed/);
    expect(canGetListed(classifyCitedSite("justdial.com", agency))).toBe(true);
    expect(canGetListed(classifyCitedSite("reddit.com", agency))).toBe(false);
  });

  it("helpers", () => {
    expect(siteLabel("www.social-beat.co.in")).toBe("social-beat");
    expect(siteLabel("schbang.com")).toBe("schbang");
    expect(nameInText("socialbeat", ["Try Social Beat."])).toBe("Social Beat");
    expect(nameInText("abc", ["abc"])).toBeNull();
    expect(looksLikeListOrArticle("https://x.com/best-agencies-in-delhi")).toBe(true);
    expect(looksLikeListOrArticle("https://x.com/services")).toBe(false);
  });
});

describe("splitCitations", () => {
  it("keeps competitors out of the listings and returns them separately", () => {
    const { places, competitors } = splitCitations(
      [
        { domain: "gohypemedia.com", count: 9, owned: true },
        { domain: "schbang.com", count: 5, owned: false },
        { domain: "zeroado.com", count: 3, owned: false, pages: [{ url: "https://zeroado.com/" }] },
        { domain: "clutch.co", count: 4, owned: false },
        { domain: "google.com", count: 2, owned: false },
      ],
      { ownedDomains: ["gohypemedia.com"], competitorDomains: [], tracked: [], namedBrands: ["Schbang"], tradeWords: agency.tradeWords },
    );
    expect(places.map((p) => p.domain)).toEqual(["clutch.co"]);
    expect(places[0]).toMatchObject({ kind: "listing", name: "Clutch" });
    expect(competitors.map((c) => c.domain)).toEqual(["schbang.com", "zeroado.com"]);
  });

  it("does not re-suggest saved competitors", () => {
    const { competitors } = splitCitations([{ domain: "rival.com", count: 3, owned: false }], {
      ownedDomains: [],
      competitorDomains: ["rival.com"],
      tracked: [],
    });
    expect(competitors).toEqual([]);
  });
});
