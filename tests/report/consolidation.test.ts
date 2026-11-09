import { describe, expect, it } from "vitest";
import { runAllChecks } from "@/lib/report/checks";
import { indexablePages, isCanonicalisedElsewhere, isConsolidated, type EvaluatedCheck } from "@/lib/report/inputs";
import { isUtilityUrl } from "@/lib/audit/page-kind";
import { isAuthoritativeUrl } from "@/lib/crawler/extract";
import { GOOD_HOME, ORIGIN, ctx, page } from "./fixtures";

const byId = (checks: Record<string, EvaluatedCheck[]>) => Object.fromEntries(Object.values(checks).flat().map((c) => [c.id, c]));
const words = (n: number, w: string) => Array.from({ length: n }, (_, i) => (i % 12 === 11 ? `${w}.` : w)).join(" ");

/** A small page; `head` lets a test add canonical / robots tags. */
const html = (o: { title: string; description: string; h1: string; body: string; head?: string }) => `<!doctype html><html lang="en"><head>
<title>${o.title}</title><meta name="description" content="${o.description}">
<meta name="viewport" content="width=device-width, initial-scale=1">${o.head ?? ""}
</head><body><h1>${o.h1}</h1><p>${o.body}</p><a href="/">Home</a><a href="/services">Services</a><a href="/contact">Contact</a></body></html>`;

const canon = (path: string) => `<link rel="canonical" href="${ORIGIN}${path}">`;
const NOINDEX = `<meta name="robots" content="noindex, follow">`;

const SERVICES = html({
  title: "Plumbing services in Pune | Acme Plumbing",
  description: "Leak repairs, boiler servicing and drain cleaning from licensed Acme plumbers across Pune.",
  h1: "Plumbing services",
  body: words(400, "pipes"),
  head: `${canon("/services")}<meta property="og:title" content="Services"><meta property="og:image" content="/og.png">`,
});
const contactHtml = (head: string) => html({ title: "Contact | Acme Plumbing", description: "Call or email Acme Plumbing.", h1: "Contact us", body: words(120, "contact"), head });
const loginHtml = (head: string) => html({ title: "Log in | Acme Plumbing", description: "Log in to your Acme account.", h1: "Log in", body: words(60, "login"), head });
const signupHtml = (head: string) => html({ title: "Sign up | Acme Plumbing", description: "Create your Acme account.", h1: "Sign up", body: words(80, "signup"), head });
const FORGOT = html({ title: "Forgot password | Acme Plumbing", description: "Reset your password.", h1: "Forgot password", body: words(92, "reset"), head: NOINDEX + canon("/forgot-password") });

/** The mywebrank.tech shape: query-string variants canonicalised to the bare path, auth pages noindexed. */
function wellBuiltSite() {
  return [
    page("/", GOOD_HOME),
    page("/services", SERVICES),
    page("/contact", contactHtml(canon("/contact"))),
    page("/contact?topic=services", contactHtml(canon("/contact"))),
    page("/contact?tier=fix&topic=services", contactHtml(canon("/contact"))),
    page("/login", loginHtml(NOINDEX + canon("/login"))),
    page("/login?next=%2Fapp", loginHtml(NOINDEX + canon("/login"))),
    page("/signup", signupHtml(NOINDEX + canon("/signup"))),
    page("/signup?plan=starter", signupHtml(NOINDEX + canon("/signup"))),
    page("/signup?plan=growth", signupHtml(NOINDEX + canon("/signup"))),
    page("/forgot-password", FORGOT),
  ];
}

describe("isConsolidated / indexablePages", () => {
  it("treats noindex pages and same-site canonicals to another URL as consolidated", () => {
    expect(isConsolidated(page("/login", loginHtml(NOINDEX)))).toBe(true);
    expect(isConsolidated(page("/contact?topic=services", contactHtml(canon("/contact"))))).toBe(true);
    // Relative canonical resolves against the page URL.
    expect(isConsolidated(page("/contact?topic=services", contactHtml(`<link rel="canonical" href="/contact">`)))).toBe(true);
  });

  it("does not treat self-referencing, missing or off-site canonicals as consolidation", () => {
    expect(isConsolidated(page("/contact", contactHtml(canon("/contact"))))).toBe(false);
    expect(isConsolidated(page("/contact", contactHtml(canon("/contact/"))))).toBe(false); // trailing slash
    expect(isConsolidated(page("/contact", contactHtml(`<link rel="canonical" href="http://www.acme.example/contact">`)))).toBe(false); // scheme/www only
    expect(isConsolidated(page("/contact?topic=services", contactHtml("")))).toBe(false); // no canonical → still counts
    expect(isCanonicalisedElsewhere(page("/contact", contactHtml(`<link rel="canonical" href="https://other.example/contact">`)))).toBe(false);
  });

  it("indexablePages keeps only the pages Google would index on their own", () => {
    const urls = indexablePages(wellBuiltSite()).map((p) => p.url);
    expect(urls).toEqual([`${ORIGIN}/`, `${ORIGIN}/services`, `${ORIGIN}/contact`]);
  });
});

describe("report checks treat URL variants the way Google does", () => {
  const c = byId(runAllChecks(ctx(wellBuiltSite())));

  it("does not count canonicalised / noindex variants as duplicates, thin pages or missing previews", () => {
    expect(c["seo.titles"].facts).toMatchObject({ duplicate: 0, total: 3 });
    expect(c["seo.titles"].detail).not.toContain("duplicated");
    expect(c["seo.meta_description"].facts).toMatchObject({ duplicate: 0, total: 3 });
    expect(c["seo.duplicate_content"].facts.duplicates).toBe(0);
    expect(c["seo.thin_content"].facts.thin).toBe(0);
    expect(c["seo.thin_content"].affectedUrls).not.toContain(`${ORIGIN}/forgot-password`);
    expect(c["seo.open_graph"].affectedUrls.some((u) => /login|signup|\?/.test(u))).toBe(false);
    expect(c["seo.h1"].facts.total).toBe(3);
  });

  it("noindex on login/signup/forgot-password is intended, not an indexability problem", () => {
    expect(c["seo.indexability"].facts).toMatchObject({ errors: 0, noindex: 0, intentionalNoindex: 6 });
    expect(c["seo.indexability"].status).toBe("pass");
  });

  it("noindex on a real content page still counts", () => {
    const pages = [page("/", GOOD_HOME), page("/services", SERVICES.replace("<title>", `${NOINDEX}<title>`))];
    const r = byId(runAllChecks(ctx(pages)));
    expect(r["seo.indexability"].facts).toMatchObject({ noindex: 1 });
    expect(r["seo.indexability"].affectedUrls).toContain(`${ORIGIN}/services`);
  });

  it("variants WITHOUT a canonical are still counted as duplicates", () => {
    const pages = [page("/", GOOD_HOME), page("/contact", contactHtml("")), page("/contact?topic=services", contactHtml(""))];
    const r = byId(runAllChecks(ctx(pages)));
    expect(r["seo.titles"].facts.duplicate).toBe(2);
    expect(r["seo.meta_description"].facts.duplicate).toBe(2);
    expect(r["seo.duplicate_content"].facts.duplicates).toBe(2);
  });

  it("falls back to every page when all pages are consolidated", () => {
    const pages = [page("/login", loginHtml(NOINDEX)), page("/signup", signupHtml(NOINDEX))];
    const r = byId(runAllChecks(ctx(pages)));
    expect(r["seo.titles"].facts.total).toBe(2);
    expect(Number.isFinite(r["seo.titles"].score)).toBe(true);
  });

  it("AEO/GEO content-page checks skip canonicalised copies of an article", () => {
    const article = (path: string) => page(path, html({
      title: "Why do pipes burst? | Acme Plumbing", description: "Why pipes burst.", h1: "Why do pipes burst?",
      body: words(300, "water"), head: canon("/blog/why-pipes-burst"),
    }));
    const r = byId(runAllChecks(ctx([page("/", GOOD_HOME), article("/blog/why-pipes-burst"), article("/blog/why-pipes-burst?ref=nav")])));
    expect(r["geo.quotable_facts"].facts.total).toBe(2); // home + the article, not the variant
    expect(r["aeo.lists_tables"].facts.total).toBe(2);
  });
});

describe("page kinds and citation sources", () => {
  it("auth and account-recovery pages are utility pages", () => {
    for (const p of ["/forgot-password", "/reset-password", "/password/reset", "/accept-invite", "/invite/abc", "/verify-email", "/logout", "/login", "/signup"]) {
      expect(isUtilityUrl(`${ORIGIN}${p}`)).toBe(true);
    }
    expect(isUtilityUrl(`${ORIGIN}/services`)).toBe(false);
  });

  it("Google Search Central and web.dev count as trusted citations", () => {
    expect(isAuthoritativeUrl("https://developers.google.com/search/docs/crawling-indexing/canonicalization")).toBe(true);
    expect(isAuthoritativeUrl("https://web.dev/articles/vitals")).toBe(true);
    const p = page("/guide", html({
      title: "Guide", description: "d", h1: "Guide", body: `${words(200, "seo")} <a href="https://developers.google.com/search/docs">Google Search Central</a>`,
    }));
    expect(p.extracted!.citationLinks).toContain("https://developers.google.com/search/docs");
  });
});
