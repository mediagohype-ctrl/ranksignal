import { describe, expect, it } from "vitest";
import { cleanHref, parseAnswer, parseInline } from "@/lib/dashboard/answer-markdown";

const CHATGPT = `For a small business in India, I'd start with **Upwork or Truelancer**, depending on the work you need.

| Platform | When I'd use it |
|---|---|
| **Upwork** | For ongoing support. ([upwork.com](https://www.upwork.com/hire/in/?utm_source=openai)) |
| **Fiverr** | For quick gigs. |

**For your first hire, I recommend:**
- Write a short brief with the deliverables, deadline, and budget in ₹.
- Start with a small paid test.

---

### 1. Global Freelance Marketplaces
* **Upwork:** Best for long-term contracts.
1. First
2. Second`;

describe("parseAnswer", () => {
  const blocks = parseAnswer(CHATGPT);

  it("turns Markdown tables, lists, headings and rules into blocks", () => {
    expect(blocks.map((b) => b.t)).toEqual(["p", "table", "p", "ul", "hr", "h", "ul", "ol"]);
    const table = blocks[1];
    expect(table.t === "table" && table.rows.length).toBe(2);
    expect(table.t === "table" && table.head.length).toBe(2);
  });

  it("parses bold and source links, dropping tracking codes", () => {
    const row = blocks[1].t === "table" ? blocks[1].rows[0][1] : [];
    const link = row.find((n) => n.t === "link");
    expect(link && link.t === "link" && link.href).toBe("https://www.upwork.com/hire/in/");
    expect(parseInline("**Upwork**")[0]).toEqual({ t: "strong", c: [{ t: "text", v: "Upwork" }] });
  });

  it("never keeps unsafe links", () => {
    expect(cleanHref("javascript:alert(1)")).toBeNull();
    expect(parseInline("[click](javascript:alert(1))").some((n) => n.t === "link")).toBe(false);
  });

  it("keeps plain text answers as paragraphs", () => {
    expect(parseAnswer("Just one line.\nAnd another.")).toEqual([{ t: "p", c: [{ t: "text", v: "Just one line. And another." }] }]);
  });
});
