import { describe, expect, it, vi } from "vitest";
import { PAGE_SEO, PAGE_UPDATED, type PageSeo } from "@/lib/seo/pages";
import { fitTitle, pageMetadata, renderedTitle, staticPageMetadata, TITLE_SUFFIX } from "@/lib/seo/metadata";
import { ARTICLES } from "@/lib/learn/articles";
import { MARKETING_ROUTES } from "@/lib/free-check/site-seo";

const pages = Object.entries(PAGE_SEO as Record<string, PageSeo>);

describe("static page snippets", () => {
  it("every full title is 30–60 characters and unique", () => {
    const titles = pages.map(([path, p]) => [path, renderedTitle(p)] as const);
    for (const [path, t] of titles) {
      expect(t.length, `${path}: ${t}`).toBeGreaterThanOrEqual(30);
      expect(t.length, `${path}: ${t}`).toBeLessThanOrEqual(60);
    }
    expect(new Set(titles.map(([, t]) => t)).size).toBe(titles.length);
  });

  it("every description is 120–155 characters and unique", () => {
    for (const [path, p] of pages) {
      expect(p.description.length, `${path}: ${p.description}`).toBeGreaterThanOrEqual(120);
      expect(p.description.length, `${path}: ${p.description}`).toBeLessThanOrEqual(155);
    }
    expect(new Set(pages.map(([, p]) => p.description)).size).toBe(pages.length);
  });

  it("every indexable static route in the sitemap has a freshness date", () => {
    for (const r of MARKETING_ROUTES.filter((x) => !x.path.startsWith("/learn/"))) {
      expect(PAGE_UPDATED[r.path], r.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.updated, r.path).toBe(PAGE_UPDATED[r.path]);
    }
  });

  it("metadata always carries canonical, og:image and twitter card", () => {
    const m = staticPageMetadata("/pricing");
    expect(m.alternates?.canonical).toBe("/pricing");
    const og = m.openGraph as { images: { url: string }[]; url: string };
    expect(og.images[0].url).toBe("/opengraph-image");
    expect(og.url).toBe("/pricing");
    expect((m.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("auth pages are noindex,follow with a bare canonical", () => {
    for (const path of ["/login", "/signup", "/forgot-password", "/reset-password", "/accept-invite"] as const) {
      const m = staticPageMetadata(path);
      expect(m.robots).toEqual({ index: false, follow: true });
      expect(m.alternates?.canonical).toBe(path);
    }
  });

  it("article metadata keeps a custom image and its dates", () => {
    const m = pageMetadata({ title: "x".repeat(40), description: "d", path: "/blog/x", type: "article", modifiedTime: "2026-11-09", images: [{ url: "https://cdn/x.png" }] });
    const og = m.openGraph as { images: { url: string }[]; modifiedTime: string };
    expect(og.images[0].url).toBe("https://cdn/x.png");
    expect(og.modifiedTime).toBe("2026-11-09");
  });
});

describe("Organization address and profiles (env)", () => {
  it("emits address from town/region/country alone, sameAs from BRAND_SAME_AS, and never a telephone", async () => {
    const keep = { ...process.env };
    Object.assign(process.env, {
      BRAND_ADDRESS_STREET: "",
      BRAND_ADDRESS_POSTAL_CODE: "",
      BRAND_ADDRESS_LOCALITY: "New Delhi",
      BRAND_ADDRESS_REGION: "Delhi",
      BRAND_ADDRESS_COUNTRY: "IN",
      BRAND_SAME_AS: "https://www.instagram.com/myweb_rank,https://www.youtube.com/@mywebranktech,https://x.com/MYWEBRANKTECH",
      BRAND_PHONE: "+911234567890",
    });
    try {
      vi.resetModules();
      const { organizationLd } = await import("@/lib/seo/schema");
      const { brandLocationLine } = await import("@/lib/brand");
      const { LEGAL_ADDRESS } = await import("@/lib/site");
      const org = organizationLd("https://example.com");
      expect(org.address).toEqual({ "@type": "PostalAddress", addressLocality: "New Delhi", addressRegion: "Delhi", addressCountry: "IN" });
      expect(org.sameAs).toHaveLength(3);
      expect(JSON.stringify(org)).not.toMatch(/telephone|1234567890/);
      expect(brandLocationLine()).toBe("New Delhi, India");
      expect(LEGAL_ADDRESS).toBe("New Delhi, Delhi, India");
    } finally {
      process.env = keep;
      vi.resetModules();
    }
  });

  it("emits no address and no TODO text when nothing is set", async () => {
    const keep = { ...process.env };
    for (const k of ["BRAND_ADDRESS_STREET", "BRAND_ADDRESS_LOCALITY", "BRAND_ADDRESS_REGION", "BRAND_ADDRESS_POSTAL_CODE"]) delete process.env[k];
    try {
      vi.resetModules();
      const { organizationLd } = await import("@/lib/seo/schema");
      const { LEGAL_ADDRESS } = await import("@/lib/site");
      expect(organizationLd("https://example.com").address).toBeUndefined();
      expect(LEGAL_ADDRESS).toBe("");
    } finally {
      process.env = keep;
      vi.resetModules();
    }
  });
});

describe("fitTitle", () => {
  it("keeps the suffix when it fits and never exceeds 60 characters", () => {
    expect(fitTitle("Short page title for tests").full).toBe(`Short page title for tests${TITLE_SUFFIX}`);
    for (const a of ARTICLES) {
      const t = fitTitle(a.metaTitle).full;
      expect(t.length, t).toBeLessThanOrEqual(60);
      expect(t.length, t).toBeGreaterThanOrEqual(30);
    }
    const long = fitTitle("A very long blog post title that goes on and on about SEO and AEO and GEO forever").full;
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).not.toMatch(/\s(and|or|the)$/);
  });
});
