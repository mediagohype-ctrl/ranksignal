import { describe, expect, it } from "vitest";
import { buildRecommendations, dedupeKey, scorePriority } from "@/lib/recommendations/rules";

describe("recommendation rules", () => {
  it("maps findings and visibility evidence to typed recommendations", () => {
    const recs = buildRecommendations({
      brand: "Acme",
      findings: [
        { id: "f1", code: "missing_meta_description", severity: "medium", category: "metadata", message: "No meta description.", pageUrl: "https://acme.example/widgets", evidence: {},
          page: { url: "https://acme.example/widgets", title: "Widgets", description: null, h1: ["Steel widgets"], textSample: "Steel widgets built for heavy industrial use. More text follows here." } },
        { id: "f2", code: "question_page_without_faq_schema", severity: "low", category: "ai_readiness", message: "Q page.", pageUrl: "https://acme.example/faq", evidence: { questionHeadings: ["What is a widget?"] } },
        { id: "f3", code: "ai_crawler_access", severity: "medium", category: "ai_readiness", message: "Blocks GPTBot.", pageUrl: "https://acme.example/", evidence: { blocked: ["GPTBot"] } },
      ],
      visibility: {
        runId: "v1",
        metrics: { citationRate: 0.05, simulated: true } as never,
        prompts: [{ id: "p1", text: "best widgets india", intent: "commercial", priority: 1, observations: [
          { brandMentioned: false, brandCited: false, competitorMentions: { Rival: 1 }, citations: [{ domain: "rival.example" }] },
          { brandMentioned: false, brandCited: false, competitorMentions: { Rival: 2 }, citations: [] },
        ] }],
      },
    });
    const types = recs.map((r) => r.type);
    expect(types).toEqual(expect.arrayContaining(["update_meta_description", "add_faq_schema", "robots_review", "content_brief", "comparison_page_brief"]));
    const meta = recs.find((r) => r.type === "update_meta_description")!;
    expect(meta.proposedChange!.after.length).toBeLessThanOrEqual(155);
    expect(meta.proposedChange!.after).toContain("Steel widgets");
    expect(recs.find((r) => r.type === "content_brief")!.rationale).toContain("SIMULATED");
  });

  it("scores with risk penalty and labels priority", () => {
    expect(scorePriority(5, 1, "low", "A").priority).toBe("critical");
    expect(scorePriority(5, 1, "low", "D").score).toBeLessThan(scorePriority(5, 1, "low", "A").score);
    expect(scorePriority(1, 0.3, "high", "C").priority).toBe("low");
  });

  it("dedupe key normalises trailing slashes", () => {
    expect(dedupeKey("t", { resourceType: "page", url: "https://a.example/x/" })).toBe(dedupeKey("t", { resourceType: "page", url: "https://a.example/x" }));
  });
});
