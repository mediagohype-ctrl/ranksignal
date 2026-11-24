import { describe, expect, it } from "vitest";
import { checkLlmsTxt, llmsFetchNote, LLMS_TXT_EXAMPLE, looksLikeNonText, type LlmsFetchResult } from "@/lib/tools/llms-txt-check";

const ids = (text: string) => checkLlmsTxt(text).items.map((i) => i.id);
const level = (text: string, id: string) => checkLlmsTxt(text).items.find((i) => i.id === id)?.level;

describe("checkLlmsTxt", () => {
  it("passes the example file with no errors or warnings", () => {
    const r = checkLlmsTxt(LLMS_TXT_EXAMPLE);
    expect(r.errors).toBe(0);
    expect(r.warnings).toBe(0);
    expect(r.name).toBe("Sharma Sweets");
    expect(r.sections).toBe(2);
    expect(r.links).toBe(4);
    expect(r.items.every((i) => i.fix.length > 0)).toBe(true);
  });

  it("flags an empty file", () => {
    expect(level("  \n\n", "empty")).toBe("error");
  });

  it("flags a missing title line", () => {
    expect(level("> summary\n\n## Pages\n- [Home](https://a.com/)", "h1-missing")).toBe("error");
  });

  it("flags a title line that is not first", () => {
    expect(level("Hello\n# Name\n## Pages\n- [Home](https://a.com/)", "h1-not-first")).toBe("error");
  });

  it("allows blank lines and a BOM before the title", () => {
    expect(ids("﻿\n\n# Name\n> s\n## Pages\n- [Home](https://a.com/)")).toContain("h1");
  });

  it("flags more than one title line", () => {
    const r = checkLlmsTxt("# One\n> s\n## Pages\n- [Home](https://a.com/)\n# Two");
    expect(r.items.find((i) => i.id === "h1-multiple")?.title).toContain("lines 1, 5");
    expect(r.name).toBe("One");
  });

  it("warns when the summary is missing", () => {
    expect(level("# Name\n## Pages\n- [Home](https://a.com/)", "summary-missing")).toBe("warn");
  });

  it("warns when there are no sections", () => {
    expect(level("# Name\n> s\n- [Home](https://a.com/)", "sections-missing")).toBe("warn");
  });

  it("warns about empty sections", () => {
    const r = checkLlmsTxt("# Name\n> s\n## Empty\n\n## Pages\n- [Home](https://a.com/)");
    const item = r.items.find((i) => i.id === "sections-empty");
    expect(item?.level).toBe("warn");
    expect(item?.title).toContain('"Empty"');
  });

  it("flags malformed links", () => {
    const r = checkLlmsTxt("# Name\n> s\n## Pages\n- [Home(https://a.com/)\n- [About] (https://a.com/about)\n- [](https://a.com/x)");
    const item = r.items.find((i) => i.id === "links-malformed");
    expect(item?.level).toBe("error");
    expect(item?.title).toContain("3 links are");
  });

  it("flags relative and non-web links", () => {
    const r = checkLlmsTxt("# Name\n> s\n## Pages\n- [Home](/)\n- [Mail](mailto:a@b.com)\n- [Ok](https://a.com/x): note");
    expect(r.items.find((i) => i.id === "links-relative")?.title).toContain("line 4");
    expect(r.items.find((i) => i.id === "links-bad-url")?.title).toContain("line 5");
    expect(r.links).toBe(3);
  });

  it("warns about http links and plain bullets inside sections", () => {
    expect(level("# N\n> s\n## P\n- [Home](http://a.com/)", "links-http")).toBe("warn");
    expect(level("# N\n> s\n## P\n- just text\n- [Home](https://a.com/)", "links-plain")).toBe("warn");
    // Plain bullets above the first section are free text and fine.
    expect(ids("# N\n> s\n- open daily\n## P\n- [Home](https://a.com/)")).not.toContain("links-plain");
  });

  it("ignores headings and links inside code fences", () => {
    expect(ids("# N\n> s\n```\n# not a title\n```\n## P\n- [Home](https://a.com/)")).not.toContain("h1-multiple");
  });

  it("warns when the file is very long", () => {
    const big = `# N\n> s\n## P\n${"- [Home](https://a.com/): x\n".repeat(5000)}`;
    expect(level(big, "too-long")).toBe("warn");
  });

  it("rejects web pages and binary content", () => {
    expect(level("<!DOCTYPE html><html></html>", "non-text")).toBe("error");
    expect(looksLikeNonText("%PDF\u0000\u0001")).toBe("binary");
    expect(looksLikeNonText("# Name")).toBeNull();
  });
});

describe("llmsFetchNote", () => {
  const base: LlmsFetchResult = { site: "https://a.com", llmsUrl: "https://a.com/llms.txt", finalUrl: null, status: null, contentType: null, text: null, error: null };
  it("explains a missing file, server errors and fetch failures", () => {
    expect(llmsFetchNote({ ...base, status: 404 })?.title).toMatch(/no llms\.txt/);
    expect(llmsFetchNote({ ...base, status: 503 })?.tone).toBe("danger");
    expect(llmsFetchNote({ ...base, error: "Timed out." })?.body).toBe("Timed out.");
    expect(llmsFetchNote({ ...base, status: 200, text: "# A" })?.tone).toBe("success");
  });
});
