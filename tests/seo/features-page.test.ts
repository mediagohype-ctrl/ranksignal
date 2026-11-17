// /features: four cards of what works today (Check · AI answers · Fix · Reports) and one small "Coming next" strip
// for everything that is waiting on an outside data supplier. No one-click / approve / undo promises (owner decision 1).
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COMING_NEXT, FEATURE_CARDS } from "@/components/marketing/content";
import { comingNext, isFeatureLive } from "@/components/marketing/features/categories";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import FeaturesPage from "@/app/(marketing)/features/page";

// The app compiles JSX with the classic runtime under Vitest, so the page needs a global React.
(globalThis as { React?: typeof React }).React = React;

function render(): string {
  return renderToStaticMarkup(React.createElement(FeaturesPage));
}

function allOff() {
  vi.stubEnv("DATAFORSEO_LOGIN", "");
  vi.stubEnv("DATAFORSEO_PASSWORD", "");
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
}

afterEach(() => vi.unstubAllEnvs());

describe("features content", () => {
  it("has exactly four cards with about three short bullets each", () => {
    expect(FEATURE_CARDS.map((c) => c.title)).toEqual(["Check", "AI answers", "Fix", "Reports"]);
    for (const c of FEATURE_CARDS) {
      expect(c.bullets.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.bullets.length, c.id).toBeLessThanOrEqual(4);
    }
  });

  it("says Do it myself gets ready-to-paste fixes, and never promises one-click publishing, approvals or undo", () => {
    const text = JSON.stringify(FEATURE_CARDS);
    expect(text.toLowerCase()).toContain(SELF_FIX_LINE.toLowerCase());
    expect(text).toContain("our team makes the changes on your website");
    expect(text).not.toMatch(/one-click|one click|undo|roll ?back|goes? live|approve/i);
  });

  it("maps availability to the env switches", () => {
    allOff();
    expect(isFeatureLive(undefined)).toBe(true);
    expect(isFeatureLive("google-data")).toBe(false);
    expect(isFeatureLive("backlink-data")).toBe(false);
    expect(isFeatureLive("maps-data")).toBe(false);
    expect(comingNext().waiting).toHaveLength(COMING_NEXT.length);
    vi.stubEnv("DATAFORSEO_LOGIN", "x");
    vi.stubEnv("DATAFORSEO_PASSWORD", "y");
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    expect(isFeatureLive("google-data")).toBe(true);
    expect(isFeatureLive("maps-data")).toBe(true);
    expect(isFeatureLive("backlink-data")).toBe(false);
    expect(comingNext().waiting.map((f) => f.slug)).toEqual(["backlinks"]);
  });
});

describe("features page", () => {
  it("keeps one h1 and one card per part, all as real text", () => {
    allOff();
    const html = render();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const c of FEATURE_CARDS) {
      expect(html).toContain(`<h3 id="${c.id}-title"`);
      expect(html).toContain(`id="${c.id}"`);
    }
    expect(html.match(/<h3[\s>]/g)!.length).toBeGreaterThanOrEqual(FEATURE_CARDS.length);
    expect(html).toContain("In numbers");
    expect(html).not.toMatch(/<img|<canvas/);
  });

  it("puts every unfinished feature in the Coming next strip, and nowhere else", () => {
    allOff();
    const html = render();
    const start = html.indexOf('<aside id="coming-next"');
    expect(start).toBeGreaterThan(0);
    const strip = html.slice(start, html.indexOf("</aside>", start));
    expect(strip).toContain("Coming next");
    for (const f of COMING_NEXT) {
      expect(strip, f.slug).toContain(f.title);
      expect(html.replace(strip, ""), f.slug).not.toContain(f.title);
    }
    expect(html).not.toContain("Switching on soon");
  });

  it("drops a feature from the strip once its data supplier is switched on", () => {
    allOff();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    const html = render();
    const start = html.indexOf('<aside id="coming-next"');
    const strip = html.slice(start, html.indexOf("</aside>", start));
    expect(strip).not.toContain("Google Business Profile monitor");
    expect(html).toContain("Also included: Google Business Profile monitor.");
  });
});
