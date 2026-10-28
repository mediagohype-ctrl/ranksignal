import { describe, expect, it } from "vitest";
import { createSimulatedProvider, SIMULATED_LABEL } from "@/lib/providers/visibility/simulated";
import { parseAnswer } from "@/lib/visibility/parse";
import { parseDataForSeoPayload } from "@/lib/providers/visibility/dataforseo";

const ctx = {
  brandNames: ["Acme Tiles"],
  competitors: [{ name: "Globex", domain: "globex.com" }, { name: "Initech", domain: "initech.in" }],
  websiteDomain: "acmetiles.in",
};

describe("simulated provider", () => {
  it("is deterministic per prompt and always labelled", async () => {
    const p = createSimulatedProvider(ctx);
    const q = { promptId: "p1", text: "Best tile shops in Pune?", locale: "en-IN" };
    const a = await p.run(q);
    const b = await createSimulatedProvider(ctx).run({ ...q, promptId: "other" });
    expect(a).toEqual(b);
    expect(a.simulated).toBe(true);
    expect(p.simulated).toBe(true);
    expect(a.platformLabel).toBe(SIMULATED_LABEL);
    expect(a.costMicros).toBe(0);
  });

  it("varies across prompts and sometimes mentions the brand", async () => {
    const p = createSimulatedProvider(ctx);
    const answers = await Promise.all(
      Array.from({ length: 30 }, (_, i) => p.run({ promptId: String(i), text: `prompt number ${i} about tiles`, locale: "en-IN" })),
    );
    const mentioned = answers.filter((a) => parseAnswer(a, { ...ctx, websiteUrl: ctx.websiteDomain }).brandMentioned).length;
    expect(mentioned).toBeGreaterThan(0);
    expect(mentioned).toBeLessThan(30);
    expect(new Set(answers.map((a) => a.answerText)).size).toBeGreaterThan(1);
  });
});

describe("dataforseo payload parsing", () => {
  it("extracts text and citations defensively", () => {
    const r = parseDataForSeoPayload({
      cost: 0.0025,
      tasks: [{ status_code: 20000, result: [{ model_name: "gpt-4o-mini", items: [{ type: "message", sections: [{ type: "text", text: "Acme is good.", annotations: [{ url: "https://acme.in/", title: "Acme" }] }] }] }] }],
    });
    expect(r.text).toBe("Acme is good.");
    expect(r.citations).toEqual([{ url: "https://acme.in/", title: "Acme" }]);
    expect(r.costUsd).toBe(0.0025);
    expect(parseDataForSeoPayload(null).text).toBe("");
    expect(parseDataForSeoPayload({ tasks: "garbage" }).citations).toEqual([]);
  });
});
