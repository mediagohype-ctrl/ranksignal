import { describe, expect, it } from "vitest";
import { namedInAnswer, aiCheckBodySchema, aiCheckDailyCapMicros, aiCheckModels, aiCheckQuestion, aiCheckScore, analyseAnswer, assistantName } from "@/lib/tools/ai-visibility-check";

const ANSWER = `Here are some of the best sweet shops in Karol Bagh, Delhi:

1. **Roshan Di Kulfi** – famous for kulfi and falooda.
2. **Sharma Sweets** - known for fresh jalebis and rasgullas [1].
3. Bikanervala: a reliable chain with many outlets.

All three are popular with locals.`;

describe("AI visibility checker", () => {
  it("asks a customer-style question with or without a city", () => {
    expect(aiCheckQuestion({ category: "sweet shops", city: "Karol Bagh, Delhi" })).toBe(
      "Which are the best sweet shops in Karol Bagh, Delhi? Recommend a few by name and say briefly why.",
    );
    expect(aiCheckQuestion({ category: "CA firms", city: "" })).toMatch(/^Which are the best CA firms\? /);
  });

  it("finds the business, its place in the list and who else is named", () => {
    const r = analyseAnswer(ANSWER, "Sharma Sweets");
    expect(r.named).toBe(true);
    expect(r.position).toBe(2);
    expect(r.others).toEqual(["Roshan Di Kulfi", "Bikanervala"]);
    expect(r.excerpt).toContain("Sharma Sweets");
  });

  it("reports not named, with the businesses named instead", () => {
    const r = analyseAnswer(ANSWER, "Gupta Mithai");
    expect(r).toMatchObject({ named: false, position: null });
    expect(r.others).toEqual(["Roshan Di Kulfi", "Sharma Sweets", "Bikanervala"]);
  });

  it("does not match a name inside a longer word", () => {
    expect(analyseAnswer("Try Sharmaji Sweets Corner.", "Sharma").named).toBe(false);
  });

  it("scores: named in the top 3 counts fully, lower down partly, failed answers are left out", () => {
    expect(aiCheckScore([{ named: true, position: 1, ok: true }, { named: false, position: null, ok: true }, { named: true, position: 5, ok: true }])).toBe(53);
    expect(aiCheckScore([{ named: true, position: null, ok: true }, { named: false, position: null, ok: false }])).toBe(100);
    expect(aiCheckScore([])).toBe(0);
  });

  it("names assistants and picks ChatGPT, Gemini and Perplexity by default", () => {
    expect(assistantName("perplexity/sonar")).toBe("Perplexity");
    expect(aiCheckModels({}).map(assistantName)).toEqual(["ChatGPT", "Gemini", "Perplexity"]);
    expect(aiCheckModels({ AI_VISIBILITY_TOOL_MODELS: "openai/x, perplexity/sonar" })).toEqual(["openai/x", "perplexity/sonar"]);
  });

  it("caps daily spend (default $3, 0 = off) and cleans the input", () => {
    expect(aiCheckDailyCapMicros({})).toBe(3_000_000);
    expect(aiCheckDailyCapMicros({ AI_VISIBILITY_TOOL_DAILY_USD: "0" })).toBe(0);
    const p = aiCheckBodySchema.parse({ business: "  Sharma <b>Sweets</b> ", category: "sweet shop" });
    expect(p.business).toBe("Sharma b Sweets /b");
    expect(aiCheckBodySchema.safeParse({ business: "x", category: "shop" }).success).toBe(false);
  });

  it("reads names from headings and bold text, and skips labels and sub-points", () => {
    const gemini = `Delhi has many great sweet shops.

### 1. Ghantewala Halwai
* **Why go:** history.
* **Must-try:** sohan halwa.

### 2. Bikanervala
* **Why go:** reliable.

**Haldiram's** is also popular, as is **Chaina Ram Sindhi Halwai**.`;
    expect(namedInAnswer(gemini)).toEqual(["Ghantewala Halwai", "Bikanervala", "Haldiram's", "Chaina Ram Sindhi Halwai"]);
    const r = analyseAnswer(gemini, "Bikanervala");
    expect(r).toMatchObject({ named: true, position: 2 });
    expect(r.others).toEqual(["Ghantewala Halwai", "Haldiram's", "Chaina Ram Sindhi Halwai"]);
  });
});
