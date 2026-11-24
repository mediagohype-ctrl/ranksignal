import { describe, expect, it } from "vitest";
import { checkFaqSchema, extractJsonBlocks, FAQ_SCHEMA_EXAMPLE } from "@/lib/tools/faq-schema-check";

const ld = (o: unknown) => JSON.stringify(o);
const q = (name: string, text: string) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } });
const page = (mainEntity: unknown, extra: Record<string, unknown> = {}) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity, ...extra });
const find = (input: string, id: string) => checkFaqSchema(input).items.find((i) => i.id === id);

describe("checkFaqSchema", () => {
  it("passes the example with no errors or warnings", () => {
    const r = checkFaqSchema(FAQ_SCHEMA_EXAMPLE);
    expect(r.errors).toBe(0);
    expect(r.warnings).toBe(0);
    expect(r.questions).toBe(2);
    expect(r.items.every((i) => i.fix.length > 0)).toBe(true);
  });

  it("accepts raw JSON without a script tag", () => {
    expect(checkFaqSchema(ld(page([q("A?", "B")]))).errors).toBe(0);
  });

  it("flags empty input and invalid JSON with a specific hint", () => {
    expect(find("", "empty")?.level).toBe("error");
    expect(find('{"@type": "FAQPage",}', "json-invalid-0")?.fix).toMatch(/comma/);
    expect(find("{“a”: 1}", "json-invalid-0")?.fix).toMatch(/curly quotes/);
  });

  it("flags script tags that are not ld+json", () => {
    expect(find('<script type="text/javascript">{}</script>', "no-ld-json")?.level).toBe("error");
  });

  it("reads several ld+json blocks and finds FAQPage inside @graph", () => {
    const org = ld({ "@context": "https://schema.org", "@type": "Organization", name: "X" });
    const graph = ld({ "@context": "https://schema.org", "@graph": [{ "@type": "WebPage" }, { "@type": "FAQPage", mainEntity: [q("A?", "B")] }] });
    const html = `<script type="application/ld+json">${org}</script>\n<script type='application/ld+json'>${graph}</script>`;
    expect(extractJsonBlocks(html).blocks).toHaveLength(2);
    const r = checkFaqSchema(html);
    expect(r.errors).toBe(0);
    expect(r.questions).toBe(1);
  });

  it("flags a missing FAQPage and explains QAPage", () => {
    expect(find(ld({ "@context": "https://schema.org", "@type": "Article" }), "no-faqpage")?.title).toMatch(/No FAQPage/);
    expect(find(ld({ "@context": "https://schema.org", "@type": "QAPage" }), "no-faqpage")?.title).toMatch(/QAPage/);
  });

  it("checks @context", () => {
    expect(find(ld({ "@type": "FAQPage", mainEntity: [q("A?", "B")] }), "context")?.title).toMatch(/missing/);
    expect(find(ld(page([q("A?", "B")], { "@context": "https://example.com" })), "context")?.level).toBe("error");
    expect(find(ld(page([q("A?", "B")], { "@context": "http://schema.org/" })), "context-ok")).toBeDefined();
    expect(find(ld(page([q("A?", "B")], { "@context": { "@vocab": "https://schema.org/" } })), "context-ok")).toBeDefined();
  });

  it("flags missing or single mainEntity", () => {
    expect(find(ld(page(undefined)), "main-missing")?.level).toBe("error");
    expect(find(ld(page([])), "main-missing")?.level).toBe("error");
    expect(find(ld(page(q("A?", "B"))), "main-not-list")?.level).toBe("warn");
  });

  it("flags bad questions and answers by number", () => {
    const r = checkFaqSchema(
      ld(
        page([
          q("Fine?", "Yes"),
          { "@type": "Thing", name: "Wrong type?", acceptedAnswer: { "@type": "Answer", text: "x" } },
          q("", "No question"),
          { "@type": "Question", name: "No answer?" },
          { "@type": "Question", name: "Bad answer type?", acceptedAnswer: { text: "x" } },
          q("Empty answer?", "  "),
          q("Script?", "Hi <script>alert(1)</script>"),
          q("Another one?", "<p>HTML is <b>ok</b></p>"),
        ]),
      ),
    );
    const byId = Object.fromEntries(r.items.map((i) => [i.id, i]));
    expect(byId["q-type"].title).toBe("Question 2: not marked as a Question.");
    expect(byId["q-name"].title).toContain("Question 3");
    expect(byId["q-answer"].title).toContain("Question 4");
    expect(byId["a-type"].title).toContain("Question 5");
    expect(byId["a-text"].title).toContain("Question 6");
    expect(byId["a-script"].title).toContain("Question 7");
    expect(byId["q-duplicate"]).toBeUndefined();
    expect(byId["questions-ok"]).toBeUndefined();
    expect(r.questions).toBe(8);
  });

  it("warns about duplicate questions and several FAQPages", () => {
    expect(find(ld(page([q("Do you deliver?", "Yes"), q("do you  deliver", "Yes")])), "q-duplicate")?.title).toContain("Question 2");
    expect(find(ld([page([q("A?", "B")]), page([q("C?", "D")])]), "faqpage-multiple")?.level).toBe("warn");
  });
});
