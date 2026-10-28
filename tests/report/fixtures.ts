import { extractPage } from "@/lib/crawler/extract";
import type { SiteContext } from "@/lib/audit/rules";
import { analyzeAiBots } from "@/lib/audit/ai-bots";
import type { CheckContext, ReportPage } from "@/lib/report/inputs";
import { emptyVisibility } from "@/lib/report/visibility";

export const ORIGIN = "https://acme.example";
const words = (n: number, w = "plumbing") => Array.from({ length: n }, (_, i) => (i % 12 === 11 ? `${w}.` : w)).join(" ");

export const GOOD_HOME = `<!doctype html><html lang="en"><head>
<title>Emergency Plumbers in Pune | Acme Plumbing</title>
<meta name="description" content="Acme Plumbing fixes leaks, boilers and blocked drains across Pune, 24 hours a day. Licensed plumbers since 2009.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:title" content="Acme Plumbing"><meta property="og:image" content="/og.png">
<meta property="article:modified_time" content="2026-09-01T00:00:00Z">
<link rel="canonical" href="${ORIGIN}/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Acme Plumbing","logo":"${ORIGIN}/logo.png","sameAs":["https://www.facebook.com/acme","https://www.linkedin.com/company/acme","https://en.wikipedia.org/wiki/Acme"],"address":{"@type":"PostalAddress","addressLocality":"Pune"},"telephone":"+91 20 1234 5678"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>
</head><body>
<header><nav><a href="/about">About</a><a href="/services">Services</a><a href="/contact">Contact</a><a href="/privacy-policy">Privacy</a></nav></header>
<h1>Acme Plumbing — emergency plumbers in Pune</h1>
<p>Acme Plumbing has fixed more than 12,000 leaks across Pune since 2009. Our 25 licensed plumbers reach most homes within 45 minutes. We charge a fixed call-out fee of ₹499 and quote before any work starts.</p>
<h2>How fast can a plumber reach me?</h2>
<p>In most of Pune an Acme plumber reaches you within 45 minutes of your call, day or night. We keep vans stationed in six neighbourhoods so the nearest licensed plumber can leave immediately, and we call ahead with an arrival time so you are never left waiting.</p>
<h2>What does a boiler service cost?</h2>
<p>A standard boiler service costs ₹1,499 and takes about an hour. The price includes a safety check, cleaning of the burner and a written report. If parts are needed we quote first and only proceed once you agree to the cost in writing.</p>
<ul><li>Leak repairs and pipe replacement</li><li>Boiler servicing and installation</li><li>Blocked drains and toilets</li></ul>
<p>${words(220)}</p>
<p>See the <a href="https://www.who.int/water">WHO guidance on safe water</a>. Call <a href="tel:+912012345678">020 1234 5678</a> or <a href="mailto:hi@acme.example">email us</a>.</p>
<footer><a href="https://instagram.com/acme">Instagram</a><a href="https://facebook.com/acme">Facebook</a></footer>
</body></html>`;

export const BAD_PAGE = (path: string) => `<!doctype html><html><head><title>Page</title>
<script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script><script src="/d.js"></script>
</head><body><div>Welcome to our page. ${words(40, "stuff")}</div><img src="/x.png"><img src="/y.png"></body></html>`;

export const ARTICLE = `<!doctype html><html lang="en"><head><title>Why do pipes burst in winter? | Acme Plumbing</title>
<meta name="description" content="Why pipes burst and how to stop it.">
<meta name="viewport" content="width=device-width">
<link rel="canonical" href="${ORIGIN}/blog/why-pipes-burst">
<script type="application/ld+json">{"@type":"BlogPosting","headline":"Why pipes burst","datePublished":"2024-01-05","author":{"@type":"Person","name":"Priya Shah"}}</script>
</head><body><h1>Why do pipes burst in winter?</h1><p class="byline">By Priya Shah</p>
<p>${words(400, "water")}</p><a href="/">Home</a></body></html>`;

export function page(path: string, html: string, extra: Partial<ReportPage> = {}): ReportPage {
  const url = `${ORIGIN}${path}`;
  return {
    url,
    finalUrl: url,
    statusCode: 200,
    redirectChain: [],
    contentType: "text/html",
    responseBytes: Buffer.byteLength(html),
    extracted: extractPage(html, url, ["acme.example"], { brandNames: ["Acme Plumbing", "Acme"] }),
    ...extra,
  };
}

export function site(robotsTxt = "User-agent: *\nAllow: /\n", over: Partial<SiteContext> = {}): SiteContext {
  const ai = analyzeAiBots(`${ORIGIN}/robots.txt`, robotsTxt, 200);
  return {
    homepageUrl: `${ORIGIN}/`,
    robots: { fetched: true, status: 200, blockedAiCrawlers: ai.aiBots.filter((b) => !b.allowed).map((b) => b.token), aiBots: ai.aiBots, blocksEveryone: ai.blocksEveryone },
    sitemapsFound: [`${ORIGIN}/sitemap.xml`],
    llmsTxtFound: false,
    https: true,
    httpRedirectsToHttps: true,
    ...over,
  };
}

export function ctx(pages: ReportPage[], over: Partial<CheckContext> = {}): CheckContext {
  return {
    websiteUrl: `${ORIGIN}/`,
    brandNames: ["Acme Plumbing", "Acme"],
    competitors: [{ name: "PipeCo" }],
    pages,
    site: site(),
    findings: [],
    ai: emptyVisibility(),
    now: new Date("2026-10-28T00:00:00Z"),
    ...over,
  };
}
