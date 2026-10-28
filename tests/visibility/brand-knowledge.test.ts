import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { brandProbePrompts, heuristicBrandKnowledge, runBrandKnowledgeProbe, type BrandFacts } from "@/lib/visibility/brand-knowledge";
import { createSimulatedProvider } from "@/lib/providers/visibility/simulated";
import type { ProviderAnswer, VisibilityProvider } from "@/lib/types";

const facts: BrandFacts = { brandNames: ["Acme Tiles"], websiteDomain: "acmetiles.in", categories: ["ceramic tiles"], audience: "homeowners" };

const answer = (answerText: string, citations: { url: string; title?: string }[] = []): ProviderAnswer => ({
  provider: "fake",
  platformLabel: "Fake (API)",
  model: "fake-1",
  answerText,
  citations,
  costMicros: 100,
  simulated: false,
});

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("brand knowledge heuristic", () => {
  it("brand mentioned + own domain cited → knows brand", () => {
    const r = heuristicBrandKnowledge(
      [answer("Acme Tiles is a Pune-based seller of ceramic tiles for homeowners. It offers free samples.", [{ url: "https://www.acmetiles.in/about" }])],
      facts,
    );
    expect(r.knowsBrand).toBe(true);
    expect(r.ownSiteCited).toBe(true);
    expect(r.summary).toContain("Acme Tiles is a Pune-based seller");
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it("mentioned but own site not cited → not confirmed", () => {
    const r = heuristicBrandKnowledge([answer("Acme Tiles sells tiles.", [{ url: "https://reddit.com/x" }])], facts);
    expect(r.knowsBrand).toBe(false);
  });

  it("'I couldn't find information' → does not know brand", () => {
    const r = heuristicBrandKnowledge(
      [answer("I couldn't find specific information about Acme Tiles. It may be a small local business.", [{ url: "https://acmetiles.in" }])],
      facts,
    );
    expect(r.knowsBrand).toBe(false);
    expect(r.summary).toMatch(/could not find reliable information/);
  });

  it("probe prompts are neutral questions about the brand", () => {
    expect(brandProbePrompts("Acme Tiles")).toEqual([
      "What is Acme Tiles? What does it offer and who is it for?",
      "Is Acme Tiles legit? What do reviews say about Acme Tiles?",
    ]);
    expect(brandProbePrompts("Acme Tiles", { includeReviews: false })).toHaveLength(1);
  });
});

describe("runBrandKnowledgeProbe", () => {
  it("never runs the simulated provider and records usage for real ones", async () => {
    const sim = createSimulatedProvider({ brandNames: ["Acme Tiles"], competitors: [], websiteDomain: "acmetiles.in" });
    const simRun = vi.spyOn(sim, "run");
    const real: VisibilityProvider = {
      id: "fake",
      label: "Fake",
      simulated: false,
      isConfigured: () => true,
      run: vi.fn(async () => answer("Acme Tiles sells ceramic tiles online.", [{ url: "https://acmetiles.in/" }])),
    };
    const out = await runBrandKnowledgeProbe({ providers: [sim, real], facts, locale: "en-IN" });
    expect(simRun).not.toHaveBeenCalled();
    expect(real.run).toHaveBeenCalledTimes(2);
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({ provider: "fake", platformLabel: "Fake (API)", knowsBrand: true, method: "heuristic", inaccuracies: [] });
    expect(out.usage.fake).toEqual({ calls: 2, costMicros: 200 });
  });

  it("only simulated providers → no results stored", async () => {
    const sim = createSimulatedProvider({ brandNames: ["Acme Tiles"], competitors: [], websiteDomain: "acmetiles.in" });
    const out = await runBrandKnowledgeProbe({ providers: [sim], facts, locale: "en-IN" });
    expect(out.results).toEqual([]);
  });

  it("captures provider errors without throwing", async () => {
    const bad: VisibilityProvider = {
      id: "bad",
      label: "Bad",
      simulated: false,
      isConfigured: () => true,
      run: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const out = await runBrandKnowledgeProbe({ providers: [bad], facts, locale: "en" });
    expect(out.results).toEqual([]);
    expect(out.errors.bad).toBe("boom");
  });
});
