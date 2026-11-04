import { describe, expect, it } from "vitest";
import { rivalsForQuestion, sourcesForQuestion, stepsToGetNamed, type AnswerObservation } from "@/lib/dashboard/ai-answers";

const answers: Pick<AnswerObservation, "provider" | "platformLabel" | "competitorMentions" | "citations">[] = [
  { provider: "openai", platformLabel: "ChatGPT", competitorMentions: { Upwork: 2, Truelancer: 1, __brand__: 0 }, citations: [{ url: "https://www.upwork.com/hire/in/", domain: "www.upwork.com", ownedByCustomer: false }, { url: "https://truelancer.com/", domain: "truelancer.com", ownedByCustomer: false }] },
  { provider: "gemini", platformLabel: "Gemini", competitorMentions: { upwork: 1, Fiverr: 1, Catalance: 1 }, citations: [{ url: "https://upwork.com/x", domain: "upwork.com", ownedByCustomer: false }] },
];

describe("question detail", () => {
  it("ranks who AI named by how many tools named them, ignoring the business itself", () => {
    const r = rivalsForQuestion(answers, ["Catalance"]);
    expect(r[0]).toEqual({ name: "Upwork", engines: 2, providers: ["ChatGPT", "Gemini"] });
    expect(r.map((x) => x.name)).not.toContain("Catalance");
  });

  it("counts each source site once per answer, merging www.", () => {
    const s = sourcesForQuestion(answers);
    expect(s[0]).toMatchObject({ domain: "upwork.com", count: 2 });
    expect(s[1]).toMatchObject({ domain: "truelancer.com", count: 1 });
  });

  it("gives specific steps, with a comparison step only for comparison questions", () => {
    const base = { brand: "Catalance", named: false, rivals: rivalsForQuestion(answers, ["Catalance"]), sources: sourcesForQuestion(answers) };
    const plain = stepsToGetNamed({ ...base, question: "where can I hire freelancers in India" });
    expect(plain[1].title).toBe("Get listed on upwork.com and truelancer.com");
    expect(plain.some((s) => s.title.startsWith("Publish a fair comparison"))).toBe(false);
    const vs = stepsToGetNamed({ ...base, question: "Truelancer vs Freelancer.com which is better" });
    expect(vs.some((s) => s.title === "Publish a fair comparison with Upwork and Truelancer")).toBe(true);
  });
});
