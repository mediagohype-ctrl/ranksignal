import { describe, expect, it } from "vitest";
import { checkIdOfIssue, findingCodeOfIssue, pageNotesFor, type NotePage } from "@/lib/report/page-notes";
import type { ExtractedPage } from "@/lib/types";

const extracted = (over: Partial<ExtractedPage> = {}): ExtractedPage => ({
  title: "Plumbing services | Acme",
  description: "Fast local plumbers.",
  h1: ["Plumbing"],
  headings: [],
  canonical: "https://acme.example/services",
  robotsMeta: null,
  lang: "en",
  internalLinks: [],
  externalLinks: [],
  images: [],
  jsonLd: [],
  schemaTypes: [],
  wordCount: 120,
  textSample: "",
  hasFaq: false,
  contentFingerprint: "x",
  ...over,
});
const page = (x: Partial<ExtractedPage> = {}, over: Partial<NotePage> = {}): NotePage => ({
  statusCode: 200, redirectChain: [], responseBytes: 1000, extracted: extracted(x), error: null, ...over,
});

describe("page notes", () => {
  it("explains thin pages with the word count, and empty pages as a JavaScript problem", () => {
    const note = pageNotesFor("seo.thin_content", []);
    expect(note(page({ wordCount: 120 }))).toBe("Only 120 words (aim for at least 300).");
    expect(note(page({ wordCount: 0 }))).toMatch(/JavaScript/);
  });

  it("spots duplicate Google headlines among the affected pages", () => {
    const a = page({ title: "Home | Acme" });
    const b = page({ title: "home | acme" });
    const note = pageNotesFor("seo.titles", [a, b]);
    expect(note(a)).toMatch(/^Same Google headline as another page/);
    expect(note(page({ title: null }))).toBe("No Google headline.");
  });

  it("says when a page could not be opened, and returns null when it has nothing specific", () => {
    expect(pageNotesFor("seo.thin_content", [])(page({}, { statusCode: 404 }))).toBe("We couldn't open this page (error code 404).");
    expect(pageNotesFor("unknown.check", [])(page())).toBeNull();
  });

  it("maps issue ids back to checks and finding codes", () => {
    expect(checkIdOfIssue("seo-thin_content")).toBe("seo.thin_content");
    expect(checkIdOfIssue("finding-no-llms-txt")).toBeNull();
    expect(findingCodeOfIssue("finding-no-llms-txt")).toBe("no_llms_txt");
  });
});
