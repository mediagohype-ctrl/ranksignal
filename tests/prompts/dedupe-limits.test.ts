import { describe, expect, it } from "vitest";
import { dedupeQuestions, isNearDuplicate, questionTokens } from "@/lib/prompts/dedupe";
import { questionCapWarning, questionsAskedNext } from "@/lib/prompts/limits";
import { mixInLocal, mentionsPlace, type PromptCandidate, type ResearchProfile } from "@/lib/prompts/research";

describe("near-duplicate questions", () => {
  it("catches the audit's neck-fan pair", () => {
    expect(isNearDuplicate("Best neck fan for outdoor use in Indian summer", "Good neck fan for outdoor use in Indian heat")).toBe(true);
  });

  it("ignores case, punctuation, filler words and plurals", () => {
    expect([...questionTokens("What are the BEST bakeries in Pune?")].sort()).toEqual(["bakery", "pune"]);
    expect(isNearDuplicate("Which bakery in Pune is best?", "best bakeries in pune")).toBe(true);
  });

  it("keeps questions that are really different", () => {
    expect(isNearDuplicate("Best neck fan for outdoor use", "How much does a neck fan cost in India")).toBe(false);
    expect(isNearDuplicate("digital marketing agency in South Delhi", "Framer website agency India")).toBe(false);
  });

  it("removes duplicates of existing questions and of each other, keeping order", () => {
    const out = dedupeQuestions(
      [{ text: "Good neck fan for outdoor use in Indian heat" }, { text: "Affordable steel bottle for kids" }, { text: "Cheap steel bottles for children" }, { text: "How to clean a steel bottle" }],
      ["Best neck fan for outdoor use in Indian summer"],
    );
    expect(out.map((o) => o.text)).toEqual(["Affordable steel bottle for kids", "How to clean a steel bottle"]);
  });
});

describe("questions per check", () => {
  it("warns when more are switched on than one check asks (26 vs 25)", () => {
    expect(questionCapWarning(26, 25)).toBe(
      "You have 26 questions switched on; each AI check asks 25. Pause one or mark your most important ones — the rest wait until a place is free.",
    );
    expect(questionCapWarning(25, 25)).toBeNull();
    expect(questionCapWarning(30, 0)).toBeNull();
    expect(questionCapWarning(28, 25)).toContain("Pause 3");
  });

  it("asks Important first, then oldest; paused ones never", () => {
    const qs = [
      { id: "a", active: true, priority: 2, createdAt: "2026-01-01" },
      { id: "b", active: true, priority: 2, createdAt: "2026-01-02" },
      { id: "c", active: true, priority: 1, createdAt: "2026-03-01" },
      { id: "d", active: false, priority: 1, createdAt: "2025-01-01" },
      { id: "e", active: true, priority: 3, createdAt: "2025-01-01" },
    ];
    expect(questionsAskedNext(qs, 3)).toEqual(["c", "a", "b"]);
    expect(questionsAskedNext(qs, 10)).toEqual(["c", "a", "b", "e"]);
  });
});

describe("local questions", () => {
  const profile: ResearchProfile = {
    brandNames: ["GoHype Media"],
    categories: ["digital marketing agency"],
    countries: ["IN"],
    languages: ["en"],
    competitors: [],
    keywords: [],
    city: "South Delhi",
  };
  const national = (n: number): PromptCandidate[] =>
    Array.from({ length: n }, (_, i) => ({ text: `National question number ${i} about marketing ${"x".repeat(i)}`, intent: "commercial", topic: null, locale: "en-IN", source: "llm" }));

  it("mixes in local questions when the list is all national, without going past max", () => {
    const out = mixInLocal(national(10), profile, 10);
    expect(out).toHaveLength(10);
    expect(out.some((q) => mentionsPlace(q.text, "South Delhi"))).toBe(true);
    expect(out.every((q) => !/GoHype/i.test(q.text))).toBe(true);
  });

  it("leaves the list alone with no city", () => {
    const list = national(5);
    expect(mixInLocal(list, { ...profile, city: null }, 5)).toEqual(list);
  });

  it("mentionsPlace matches the city name inside an area", () => {
    expect(mentionsPlace("best agency in Delhi", "South Delhi")).toBe(true);
    expect(mentionsPlace("best agency in Mumbai", "South Delhi")).toBe(false);
  });
});
