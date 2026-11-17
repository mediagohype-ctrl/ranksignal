import { describe, expect, it } from "vitest";
import { questionHistory } from "@/lib/dashboard/question-history";
import { aiCrawlerVisitsAvailable, hostedBuilderNote, isHostedBuilder } from "@/lib/ai-bots-analytics/hosting";

const day = (d: Date) => d.toISOString().slice(0, 10);

describe("questionHistory (Over time)", () => {
  it("shows one row per day, not two identical rows for two checks on the same day", () => {
    const runs = [
      { id: "r2", at: new Date("2026-10-29T12:00:00Z") },
      { id: "r1", at: new Date("2026-10-29T08:00:00Z") },
      { id: "r0", at: new Date("2026-10-20T08:00:00Z") },
    ];
    const obs = [
      { visibilityRunId: "r2", provider: "openai", brandMentioned: false, simulated: false },
      { visibilityRunId: "r2", provider: "gemini", brandMentioned: false, simulated: false },
      { visibilityRunId: "r1", provider: "openai", brandMentioned: false, simulated: false },
      { visibilityRunId: "r1", provider: "gemini", brandMentioned: false, simulated: false },
      { visibilityRunId: "r0", provider: "openai", brandMentioned: true, simulated: false },
    ];
    const h = questionHistory(runs, obs, day);
    expect(h.map((r) => r.id)).toEqual(["r0", "r2"]);
    expect(h[1]).toMatchObject({ named: 0, total: 2 });
  });

  it("counts each AI tool once even when a retried check stored two answers from it, and skips samples", () => {
    const h = questionHistory(
      [{ id: "r", at: new Date("2026-10-29T08:00:00Z") }],
      [
        { visibilityRunId: "r", provider: "openai", brandMentioned: false, simulated: false },
        { visibilityRunId: "r", provider: "openai", brandMentioned: true, simulated: false },
        { visibilityRunId: "r", provider: "gemini", brandMentioned: false, simulated: false },
        { visibilityRunId: "r", provider: "sim", brandMentioned: true, simulated: true },
      ],
      day,
    );
    expect(h).toEqual([{ id: "r", at: new Date("2026-10-29T08:00:00Z"), named: 1, total: 2 }]);
  });
});

describe("AI crawler visits on hosted builders", () => {
  it("knows which builders don't give server logs", () => {
    for (const p of ["shopify", "wix", "framer", "squarespace", "webflow"]) expect(isHostedBuilder(p)).toBe(true);
    for (const p of ["wordpress", "nextjs", "custom", null, "nonsense"]) expect(isHostedBuilder(p)).toBe(false);
  });

  it("gives an honest note naming the builder", () => {
    expect(hostedBuilderNote("shopify")?.title).toBe("Your website is on Shopify, which doesn't give you server logs");
    expect(hostedBuilderNote("wordpress")).toBeNull();
  });

  it("the page stays available when data already exists", () => {
    expect(aiCrawlerVisitsAvailable("wix")).toBe(false);
    expect(aiCrawlerVisitsAvailable("wix", true)).toBe(true);
    expect(aiCrawlerVisitsAvailable(null)).toBe(true);
  });
});
