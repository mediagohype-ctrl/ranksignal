// /features: every feature is grouped, illustrated and rendered as real text; paid-data features are labelled
// "Switching on soon" until the data partner is configured.
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FEATURES } from "@/components/marketing/content";
import { FEATURE_CATEGORIES, isFeatureLive } from "@/components/marketing/features/categories";
import { ILLUSTRATED_SLUGS } from "@/components/marketing/features/illustrations";
import FeaturesPage from "@/app/(marketing)/features/page";

// The app compiles JSX with the classic runtime under Vitest, so the page needs a global React.
(globalThis as { React?: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(React.createElement(FeaturesPage));
}

afterEach(() => vi.unstubAllEnvs());

describe("features content", () => {
  it("has unique slugs, a known category and an illustration for every feature", () => {
    const slugs = FEATURES.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const cats = new Set(FEATURE_CATEGORIES.map((c) => c.id));
    for (const f of FEATURES) {
      expect(cats.has(f.category), f.slug).toBe(true);
      expect(ILLUSTRATED_SLUGS, f.slug).toContain(f.slug);
      expect(f.details.length, f.slug).toBeGreaterThan(0);
    }
  });

  it("maps availability to the env switches", () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(isFeatureLive(undefined)).toBe(true);
    expect(isFeatureLive("google-data")).toBe(false);
    expect(isFeatureLive("backlink-data")).toBe(false);
    expect(isFeatureLive("maps-data")).toBe(false);
    vi.stubEnv("DATAFORSEO_LOGIN", "x");
    vi.stubEnv("DATAFORSEO_PASSWORD", "y");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    expect(isFeatureLive("google-data")).toBe(true);
    expect(isFeatureLive("maps-data")).toBe(true);
    expect(isFeatureLive("backlink-data")).toBe(false);
  });
});

describe("features page", () => {
  it("keeps one h1, a grouped h2 per category and an h3 per feature, all as real text", () => {
    const html = render();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const c of FEATURE_CATEGORIES) expect(html).toContain(`id="${c.anchor}-title"`);
    for (const f of FEATURES) {
      expect(html).toMatch(new RegExp(`<h3 id="${f.slug}-title"`));
      expect(html).toContain(`id="${f.slug}"`);
      expect(html).toContain(`href="#${f.slug}"`);
    }
    expect(html).toContain("In numbers");
    expect(html).toContain("Standards our checks are based on");
    expect((html.match(/<figure/g) ?? []).length).toBeGreaterThanOrEqual(FEATURES.length);
    expect((html.match(/<figcaption/g) ?? []).length).toBeGreaterThanOrEqual(FEATURES.length);
    expect(html).not.toMatch(/<img|<canvas/);
  });

  it("labels paid-data features as switching on soon when the partner isn't configured", () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    const html = render();
    const section = (slug: string) => html.slice(html.indexOf(`<section id="${slug}"`), html.indexOf("</section>", html.indexOf(`<section id="${slug}"`)));
    for (const slug of ["rank-tracker", "keyword-research", "competitor-research", "backlinks", "ai-overviews"]) {
      expect(section(slug), slug).toContain("Switching on soon");
    }
    expect(section("audit")).not.toContain("Switching on soon");
  });
});
