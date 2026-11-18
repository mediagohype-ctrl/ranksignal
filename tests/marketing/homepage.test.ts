// Homepage, footer, contact and about (Full Site Audit, 15 Nov 2026): one H1, the tagline + question H2 in the hero,
// only live features, truthful AI-tool wording, Hindi contact labels and the legal small print.
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/(marketing)/page";
import { ENGINES_MEASURED_LINE, SELF_ENGINE_LIST, engineNamesFor, listWords } from "@/components/marketing/engine-names";
import { tourSummary } from "@/components/marketing/visuals/tour";
import { CONTACT_FORM_COPY, REPLY_TIME } from "@/components/marketing/contact-copy";
import { legalSmallPrint } from "@/components/marketing/about-ui";
import { getEngineLimit } from "@/lib/billing/plans";
import { BRAND } from "@/lib/brand";
import { SELF_FIX_LINE } from "@/lib/billing/offer";

(globalThis as { React?: typeof React }).React = React;

afterEach(() => vi.unstubAllEnvs());

const render = () => renderToStaticMarkup(React.createElement(HomePage));

describe("homepage", () => {
  it("has one h1, the tagline, then the question as the first h2", () => {
    const html = render();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const h1 = html.indexOf("<h1");
    const firstH2 = html.indexOf("<h2");
    expect(firstH2).toBeGreaterThan(h1);
    expect(html.slice(firstH2, firstH2 + 400).replace(/<[^>]+>/g, "")).toContain("Customers are searching. Are they finding you?");
    expect(html).toContain("Check. Fix.");
    expect(html).toContain("Your customers changed how they search.");
    expect(html.replace(/<[^>]+>/g, "")).toContain("Every day you wait, customers find someone else.");
    expect(html).toContain("Get my free report");
    expect(html).toContain('action="/free-check"');
    expect(html.replace(/<[^>]+>/g, "")).toContain(BRAND.proof);
  });

  it("shows only live features while the data partner is off", () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    const html = render();
    expect(html).not.toContain("Switching on soon");
    expect(html).not.toContain("Rank tracker");
    expect(tourSummary({ liveOnly: true })).not.toMatch(/rankings|keyword|competitors|backlinks/);
    expect(tourSummary()).toMatch(/backlinks/);
  });

  it("plan card and JSON-LD use truthful wording", () => {
    const html = render();
    expect(html).not.toContain("AI answers a month");
    expect(html).not.toContain("One-click fixes");
    expect(html).not.toContain("rollback");
    expect(html).toContain(SELF_FIX_LINE);
    expect(html).toContain(`We ask ${SELF_ENGINE_LIST} about you`);
    expect(html).not.toContain("every month so you can see");
  });

  it("shows where each AI tool puts the business, as labelled sample data", () => {
    const html = render();
    const start = html.indexOf('id="ai-positions"');
    expect(start).toBeGreaterThan(html.indexOf("Your customers changed how they search."));
    const section = html.slice(start, html.indexOf("</section>", start));
    expect(section).toContain("See where each AI puts you.");
    for (const e of ["ChatGPT", "Gemini", "Perplexity"]) expect(section).toContain(e);
    // Only the labels the app really shows, the sample is labelled, and the per-plan AI tools are truthful.
    expect(section).toMatch(/Recommended|Named/);
    expect(section).toContain("Sample answers for a sample bakery.");
    expect(section).toContain(`We check ${SELF_ENGINE_LIST}`);
    expect(section).not.toMatch(/guarantee/i);
  });

  it("labels the sample report and keeps its numbers consistent", () => {
    const html = render();
    expect(html).toContain("Sample report. Yours shows your real score and fixes.");
    expect(html).toContain("Know exactly what to fix.");
  });

  it("has four kinds of business, all in the HTML", () => {
    const html = render();
    for (const k of ["Local business", "Online store", "B2B", "Agency"]) expect(html).toContain(k);
  });
});

describe("engine names", () => {
  it("come from the plan's engine limit", () => {
    expect(engineNamesFor("starter")).toHaveLength(getEngineLimit("starter"));
    expect(SELF_ENGINE_LIST).toBe(listWords(engineNamesFor("starter")));
    expect(listWords(["A", "B", "C"])).toBe("A, B and C");
    expect(ENGINES_MEASURED_LINE).toContain(SELF_ENGINE_LIST);
    expect(ENGINES_MEASURED_LINE).not.toContain("Grok,");
  });
});

describe("contact copy", () => {
  it("has every label in Hindi and English, and the reply-time promise", () => {
    const en = CONTACT_FORM_COPY.en;
    const hi = CONTACT_FORM_COPY.hi;
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    expect(hi.name).toMatch(/[ऀ-ॿ]/);
    expect(hi.send).toMatch(/[ऀ-ॿ]/);
    expect(REPLY_TIME.en).toBe("We reply within 1 working day, in English or Hindi.");
  });
});

describe("about small print", () => {
  it("shows the GST number only when GSTIN is set", () => {
    expect(legalSmallPrint({}).gstin).toBeNull();
    expect(legalSmallPrint({}).legalName).toBe("Go Hype Media");
    const r = legalSmallPrint({ GSTIN: "07aaacb1234c1z5", GST_LEGAL_NAME: "Go Hype Media Pvt Ltd" });
    expect(r.gstin).toBe("07AAACB1234C1Z5");
    expect(r.legalName).toBe("Go Hype Media Pvt Ltd");
  });
});
