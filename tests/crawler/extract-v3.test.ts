import { describe, expect, it } from "vitest";
import { EXTRACTOR_VERSION, extractPage, isVagueLinkText } from "@/lib/crawler/extract";

const PAGE = `<!doctype html><html lang="en-IN"><head>
<title>Acme</title>
<link rel="alternate" hreflang="en-IN" href="https://acme.example/">
<link rel="alternate" hreflang="hi-IN" href="/hi">
<link rel="alternate" hreflang="x-default" href="https://acme.example/">
<script src="http://cdn.acme.example/app.js"></script>
<link rel="stylesheet" href="https://acme.example/site.css">
</head><body>
<img src="/a.png" width="400" height="300" alt="A">
<img src="/b.png" alt="B">
<img src="http://old.acme.example/c.png" width="10" height="10" alt="C">
<img src="data:image/png;base64,AAAA" alt="inline">
<a href="/services">Our plumbing services</a>
<a href="/blog/1">Read more</a>
<a href="/blog/2">Click here »</a>
<a href="/blog/3" aria-label="Read more about boiler servicing costs">Read more</a>
</body></html>`;

describe("extractPage v3 signals (audit depth)", () => {
  const x = extractPage(PAGE, "https://acme.example/", ["acme.example"]);

  it("bumps the extractor version so old crawls are marked as needing a re-scan", () => {
    expect(EXTRACTOR_VERSION).toBeGreaterThanOrEqual(3);
    expect(x.extractorVersion).toBe(EXTRACTOR_VERSION);
  });

  it("reads the page language and hreflang alternates (resolving relative links)", () => {
    expect(x.lang).toBe("en-IN");
    expect(x.hreflang).toEqual([
      { lang: "en-IN", href: "https://acme.example/" },
      { lang: "hi-IN", href: "https://acme.example/hi" },
      { lang: "x-default", href: "https://acme.example/" },
    ]);
  });

  it("finds insecure http:// files on an https page and marks scripts as active", () => {
    expect(x.mixedContentCount).toBe(2);
    expect(x.mixedContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "http://cdn.acme.example/app.js", kind: "script", active: true }),
        expect.objectContaining({ url: "http://old.acme.example/c.png", kind: "image", active: false }),
      ]),
    );
  });

  it("ignores mixed content on plain http pages", () => {
    const h = extractPage(PAGE, "http://acme.example/", ["acme.example"]);
    expect(h.mixedContentCount).toBe(0);
  });

  it("counts images without width and height, skipping inline data images", () => {
    expect(x.imagesMissingSize).toBe(1);
    expect(x.imagesMissingSizeExamples).toEqual(["https://acme.example/b.png"]);
  });

  it("counts vague link text unless an aria-label adds context", () => {
    expect(x.vagueLinkCount).toBe(2);
    expect(x.vagueLinkExamples).toEqual(expect.arrayContaining(["Read more"]));
    expect(isVagueLinkText("Click here »")).toBe(true);
    expect(isVagueLinkText("और पढ़ें")).toBe(true);
    expect(isVagueLinkText("Boiler service prices")).toBe(false);
  });

  it("returns null when the html lang attribute is missing", () => {
    expect(extractPage("<html><body><p>x</p></body></html>", "https://acme.example/", ["acme.example"]).lang).toBeNull();
  });
});
