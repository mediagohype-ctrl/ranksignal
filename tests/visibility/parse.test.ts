import { describe, expect, it } from "vitest";
import { isOwnedDomain, normalizeDomain, parseAnswer, toCitations, type ParseContext } from "@/lib/visibility/parse";

const ctx: ParseContext = {
  brandNames: ["Acme Tiles", "Acme", "AT"],
  competitors: [
    { name: "Globex", aliases: ["Globex Corp"] },
    { name: "Initech", aliases: [] },
  ],
  websiteUrl: "https://www.acmetiles.in/",
};

const parse = (answerText: string, citations: { url: string; title?: string }[] = []) => parseAnswer({ answerText, citations }, ctx);

describe("parseAnswer — mentions", () => {
  it("detects brand and aliases case-insensitively with punctuation", () => {
    const r = parse("Many people like ACME's range. (Acme Tiles) is also popular, and acme, too.");
    expect(r.brandMentioned).toBe(true);
    expect(r.brandMentionCount).toBe(3);
  });

  it("does not match inside other words (word-boundary false positives)", () => {
    const r = parse("Acmeville hardware and Globexian imports are unrelated. That's what I'd say.");
    expect(r.brandMentioned).toBe(false);
    expect(r.competitorMentions).toEqual({});
  });

  it("counts competitor mentions including aliases, preferring the longest term", () => {
    const r = parse("Globex Corp is big. Globex has stores. Initech is smaller.");
    expect(r.competitorMentions).toEqual({ Globex: 2, Initech: 1 });
  });

  it("lowers confidence when only an ambiguous short alias matched", () => {
    const r = parse("You could try AT for your bathroom renovation project this year.");
    expect(r.brandMentioned).toBe(true);
    expect(r.parseConfidence).toBeLessThan(1);
    const full = parse("You could try Acme Tiles for your bathroom renovation project this year.");
    expect(full.parseConfidence).toBe(1);
  });
});

describe("parseAnswer — recommendation + sentiment", () => {
  it("recommends via cue words in the same sentence", () => {
    const r = parse("For budget buyers I recommend Acme Tiles. Globex is fine.");
    expect(r.brandRecommended).toBe(true);
    expect(r.sentiment).toBe("positive");
  });

  it("recommends via list position ≤ 3", () => {
    const r = parse("Options:\n1. Globex — large catalogue\n2. Acme — local stock\n3. Initech");
    expect(r.brandRecommended).toBe(true);
  });

  it("does not recommend at list position > 3 without cues", () => {
    const r = parse("Options:\n1. Globex\n2. Initech\n3. Foo\n4. Acme — local stock");
    expect(r.brandRecommended).toBe(false);
  });

  it("respects negation", () => {
    const r = parse("I would not recommend Acme Tiles due to poor support and complaints.");
    expect(r.brandRecommended).toBe(false);
    expect(r.sentiment).toBe("negative");
  });

  it("returns null sentiment when brand absent", () => {
    expect(parse("Globex is the best option overall for most people.").sentiment).toBeNull();
  });
});

describe("citations", () => {
  it("normalizes domains", () => {
    expect(normalizeDomain("https://WWW.Example.com/path?x=1")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("marks owned domains and subdomains, not lookalikes", () => {
    expect(isOwnedDomain("acmetiles.in", "acmetiles.in")).toBe(true);
    expect(isOwnedDomain("blog.acmetiles.in", "acmetiles.in")).toBe(true);
    expect(isOwnedDomain("notacmetiles.in", "acmetiles.in")).toBe(false);
    expect(isOwnedDomain("acmetiles.in.evil.com", "acmetiles.in")).toBe(false);
  });

  it("converts and dedupes citations, sets brandCited", () => {
    const r = parse("Acme Tiles has a good guide.", [
      { url: "https://blog.acmetiles.in/guide", title: "Guide" },
      { url: "https://blog.acmetiles.in/guide" },
      { url: "https://en.wikipedia.org/wiki/Tile" },
      { url: "not a url" },
    ]);
    expect(r.citations).toHaveLength(2);
    expect(r.citations[0]).toMatchObject({ domain: "blog.acmetiles.in", ownedByCustomer: true, title: "Guide" });
    expect(r.citations[1]).toMatchObject({ domain: "en.wikipedia.org", ownedByCustomer: false });
    expect(r.brandCited).toBe(true);
  });

  it("toCitations without owned domain", () => {
    expect(toCitations([{ url: "https://x.com/a" }], "acmetiles.in")[0].ownedByCustomer).toBe(false);
  });
});
