import { afterEach, describe, expect, it, vi } from "vitest";
import { dedupePrompts, jaccard, keepDiscoveryQuestions, normalizeTokens, researchPrompts, templatePrompts, topicPhrases } from "@/lib/prompts/research";
import { templateKeywords } from "@/lib/setup/keywords";

const profile = {
  brandNames: ["Acme Tiles"],
  categories: ["ceramic tiles", "bathroom tiles"],
  audience: "homeowners",
  countries: ["IN"],
  languages: ["en"],
  competitors: [{ name: "Globex" }, { name: "Initech" }],
  keywords: ["anti-skid tiles"],
};

describe("dedupe", () => {
  it("treats near-identical prompts as duplicates (Jaccard ≥ 0.8)", () => {
    const out = dedupePrompts([
      { text: "Best ceramic tiles brands in India?" },
      { text: "best Ceramic Tile brands in India" },
      { text: "What are the best ceramic tiles brands in India?" },
      { text: "How much do ceramic tiles cost per square foot?" },
    ]);
    expect(out.map((o) => o.text)).toEqual(["Best ceramic tiles brands in India?", "How much do ceramic tiles cost per square foot?"]);
  });

  it("keeps different prompts and dedupes against existing", () => {
    const out = dedupePrompts([{ text: "Acme vs Globex for bathrooms" }, { text: "Cheapest tiles in Mumbai" }], ["Acme vs Globex for bathroom"]);
    expect(out.map((o) => o.text)).toEqual(["Cheapest tiles in Mumbai"]);
  });

  it("jaccard basics", () => {
    expect(jaccard(normalizeTokens("a b c"), normalizeTokens("x y z"))).toBe(0);
    expect(jaccard(normalizeTokens("tiles pune"), normalizeTokens("Tiles, Pune!"))).toBe(1);
  });
});

describe("template research", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("generates tagged, deduped questions across intents", () => {
    const out = templatePrompts(profile);
    expect(out.length).toBeGreaterThan(5);
    const intents = new Set(out.map((p) => p.intent));
    expect(intents.has("commercial")).toBe(true);
    expect(intents.has("informational")).toBe(true);
    expect(intents.has("transactional")).toBe(true);
    expect(out.every((p) => p.locale === "en-IN" && p.source === "template")).toBe(true);
    expect(out.some((p) => p.text.includes("in India"))).toBe(true);
    expect(dedupePrompts(out)).toHaveLength(out.length);
  });

  it("never names the business or a competitor, and never asks a negative question", () => {
    const texts = templatePrompts(profile).map((p) => p.text);
    expect(texts.length).toBeGreaterThanOrEqual(12);
    expect(texts.length).toBeLessThanOrEqual(20);
    expect(texts.some((t) => /acme|globex|initech/i.test(t))).toBe(false);
    expect(texts.some((t) => /worth it|alternatives|\bvs\b|cheapest|mistakes|avoid|reviews/i.test(t))).toBe(false);
    expect(texts).toContain("What are the best anti-skid tiles in India?");
    expect(texts).toContain("Which ceramic tiles would you recommend for homeowners?");
  });

  it("uses short topics, not the whole 'what you sell' sentence", () => {
    const sells = "Free, in-depth programming notes for React, Next.js, Java, Python and AI, plus copy-paste UI templates";
    expect(topicPhrases(sells)).toEqual(["programming notes for react", "copy-paste ui templates"]);
    expect(topicPhrases("Sweets, cakes and snacks")).toEqual(["sweets", "cakes", "snacks"]);
    const texts = templatePrompts({ ...profile, categories: [sells], keywords: [], audience: null }).map((p) => p.text);
    expect(texts.every((t) => !t.includes("Next.js, Java"))).toBe(true);
  });

  it("asks about the city for local businesses and the country for online ones", () => {
    const local = templatePrompts({ ...profile, categories: ["dental clinic"], keywords: [], competitors: [], city: "Pune" }).map((p) => p.text);
    expect(local).toContain("What are the best dental clinic in Pune?");
    const online = templatePrompts({ ...profile, categories: ["python course"], keywords: [], competitors: [], city: "Pune" }).map((p) => p.text);
    expect(online.some((t) => t.includes("Pune"))).toBe(false);
    expect(online).toContain("What are the best python course in India?");
  });

  it("skips long free-text audiences instead of producing awkward prompts", () => {
    const out = templatePrompts({ ...profile, audience: "Homeowners renovating bathrooms. Also builders and architects in tier-2 cities across India" });
    expect(out.some((p) => p.text.includes("for Homeowners renovating"))).toBe(false);
  });

  it("filters AI-written questions that name a business or sound negative", () => {
    const kept = keepDiscoveryQuestions(
      [
        { text: "Is Acme Tiles good? Is it worth it?" },
        { text: "What are the best alternatives to Globex?" },
        { text: "Best acme tiles showroom?" },
        { text: "What are the best bathroom tiles in Pune?" },
      ],
      ["Acme Tiles", "Globex"],
    );
    expect(kept.map((k) => k.text)).toEqual(["What are the best bathroom tiles in Pune?"]);
  });

  it("suggests SEO keywords without the business name", () => {
    const k = templateKeywords({ name: "Sharma Sweets", sells: "Sweets, cakes and snacks", customers: "Families", city: "Pune", country: "IN", language: "en" });
    expect(k.picked.slice(0, 2)).toEqual(["sweets", "sweets in pune"]);
    expect(k.more.length).toBeGreaterThan(0);
    expect([...k.picked, ...k.more].some((x) => x.includes("sharma"))).toBe(false);
  });

  it("falls back to templates when no LLM key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const r = await researchPrompts(profile, { max: 5 });
    expect(r.source).toBe("template");
    expect(r.candidates).toHaveLength(5);
    expect(r.costMicros).toBe(0);
  });
});
