// /free-check explainer (laid out like /how-it-works) must match what the check really does: the result screen's
// score names, the real number of pages read, and the real plan limits on the "free vs full" comparison.
import { describe, expect, it } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FREE_CHECK_SCORES, FreeCheckSteps, FreeVsFull } from "@/components/marketing/free-check-explainer";
import { freeCheckStrings } from "@/lib/free-check/strings";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { SELF_PLAN } from "@/components/marketing/plans";
import { SELF_ENGINE_LIST } from "@/components/marketing/engine-names";

(globalThis as { React?: typeof React }).React = React;

describe("free-check explainer", () => {
  it("uses the result screen's exact score names", () => {
    const names = freeCheckStrings("en").pillarName;
    expect(FREE_CHECK_SCORES.map((s) => s.name)).toEqual([names.seo, names.aeo, names.geo, names.brand]);
  });

  it("three numbered steps, with the real number of pages read", () => {
    const html = renderToStaticMarkup(React.createElement(FreeCheckSteps));
    for (const n of ["01", "02", "03"]) expect(html).toContain(n);
    expect(html).toContain(`We read ${MAX_KEY_PAGES + 1} pages`);
    expect(html).toContain(`up to ${MAX_KEY_PAGES} main pages`);
    expect(html).toContain("Four part scores: SEO, AEO, GEO and Brand.");
    expect(html).toContain("Sample");
  });

  it("free vs full uses the real plan limits and never claims the free check asks AI", () => {
    const html = renderToStaticMarkup(React.createElement(FreeVsFull));
    expect(html).toContain(`Up to ${SELF_PLAN.limits.maxPagesPerCrawl.toLocaleString("en-IN")}, every week`);
    expect(html).toContain(`${SELF_ENGINE_LIST}, every week`);
    expect(html).toContain("Not included");
  });
});
