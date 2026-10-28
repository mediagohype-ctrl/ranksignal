import { afterEach, describe, expect, it, vi } from "vitest";
import { dedupePrompts, jaccard, normalizeTokens, researchPrompts, templatePrompts } from "@/lib/prompts/research";

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

  it("generates tagged, deduped prompts across intents", () => {
    const out = templatePrompts(profile);
    expect(out.length).toBeGreaterThan(5);
    const intents = new Set(out.map((p) => p.intent));
    expect(intents.has("commercial")).toBe(true);
    expect(intents.has("comparison")).toBe(true);
    expect(intents.has("informational")).toBe(true);
    expect(out.every((p) => p.locale === "en-IN" && p.source === "template")).toBe(true);
    expect(out.some((p) => p.text.includes("in India"))).toBe(true);
    expect(dedupePrompts(out)).toHaveLength(out.length);
  });

  it("defaults to 12–20 buyer-style prompts with the expected patterns", () => {
    const out = templatePrompts(profile);
    expect(out.length).toBeGreaterThanOrEqual(12);
    expect(out.length).toBeLessThanOrEqual(20);
    const texts = out.map((p) => p.text);
    expect(texts).toContain("Best ceramic tiles in India — which would you recommend?");
    expect(texts).toContain("Acme Tiles vs Globex: which is better for ceramic tiles?");
    expect(texts).toContain("What are the best alternatives to Acme Tiles?");
    expect(texts).toContain("What's the best ceramic tiles for homeowners?");
    expect(texts.some((t) => t.startsWith("How do I choose the right"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Is Acme Tiles good"))).toBe(true);
    expect(texts.some((t) => t.includes("near me"))).toBe(false);
    // Most prompts measure organic visibility (don't name the brand).
    expect(texts.filter((t) => t.includes("Acme Tiles")).length).toBeLessThan(texts.length / 2);
  });

  it("adds 'near me' prompts for local businesses", () => {
    const out = templatePrompts({ ...profile, categories: ["dental clinic"], keywords: [], competitors: [] });
    const texts = out.map((p) => p.text);
    expect(texts).toContain("Cheapest dental clinic near me with good reviews?");
    expect(texts.some((t) => t.startsWith("Best dental clinic near me"))).toBe(true);
    expect(dedupePrompts(out)).toHaveLength(out.length);
  });

  it("skips long free-text audiences instead of producing awkward prompts", () => {
    const out = templatePrompts({ ...profile, audience: "Homeowners renovating bathrooms. Also builders and architects in tier-2 cities across India" });
    expect(out.some((p) => p.text.includes("for Homeowners renovating"))).toBe(false);
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
