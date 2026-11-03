// Pure audit rules (blueprint §5 "Crawl and technical audit"). No I/O: inputs are crawl results,
// output is FindingInput[]. Findings describe observable signals; they never promise rankings or
// AI citations, and confidence < 1 marks heuristics.
import type { ExtractedPage, FindingInput } from "@/lib/types";
import { urlKey } from "@/lib/crawler/normalize";
import type { AiBotRule } from "@/lib/audit/ai-bots";

export interface AuditPage {
  url: string;
  finalUrl: string;
  statusCode: number | null;
  redirectChain: string[];
  contentType: string | null;
  extracted: ExtractedPage | null;
  error?: string | null;
}

export interface SiteContext {
  homepageUrl: string;
  robots: {
    fetched: boolean;
    status: number | null;
    blockedAiCrawlers: string[];
    /** v2: per-bot AI crawler rules (search vs training). */
    aiBots?: AiBotRule[];
    blocksEveryone?: boolean;
  };
  sitemapsFound: string[];
  llmsTxtFound: boolean;
  /** v2 site-level crawl facts (persisted in WorkflowRun.output.site for the report engine). */
  llmsTxt?: { status: number | null; bytes: number };
  sitemapUrlCount?: number;
  /** Final homepage URL is served over HTTPS. */
  https?: boolean;
  /** http:// version of the homepage redirects to https (null when not checked). */
  httpRedirectsToHttps?: boolean | null;
  maxPages?: number;
  pagesDiscovered?: number;
  checkedAt?: string;
}

export const TITLE_MIN = 10;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;
export const THIN_WORDS = 300;

const ORG_TYPES = new Set([
  "Organization", "Corporation", "LocalBusiness", "OnlineStore", "OnlineBusiness", "NGO",
  "EducationalOrganization", "MedicalOrganization", "NewsMediaOrganization", "Store", "ProfessionalService",
]);
const SEARCH_AI_BOTS = new Set(["OAI-SearchBot", "PerplexityBot"]);
const QUESTION_START = /^(how|what|why|when|where|which|who|can|does|do|is|are|should)\b/i;

const snippet = (s: string | null | undefined, n = 160) => (s ?? "").slice(0, n);
const isHtml = (p: AuditPage) => !p.contentType || /html/i.test(p.contentType);
const keyOf = (u: string) => urlKey(u) ?? u;

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isQuestionStyle(x: ExtractedPage): boolean {
  const questions = x.headings.filter((h) => h.level >= 2 && h.text.trim().endsWith("?")).length;
  return questions >= 2 || (x.title !== null && QUESTION_START.test(x.title.trim()) && x.title.includes("?"));
}

/** Rules evaluated on one page in isolation. */
export function auditPage(page: AuditPage): FindingInput[] {
  const out: FindingInput[] = [];
  const url = page.finalUrl || page.url;
  const add = (f: Omit<FindingInput, "pageUrl">) => out.push({ ...f, pageUrl: url });

  if (page.error || page.statusCode === null) {
    add({ category: "technical", code: "fetch_failed", severity: "medium", confidence: 0.8,
      message: "We couldn't open this page. It may be down for now, or blocking our website check.",
      evidence: { url: page.url, error: snippet(page.error, 200) } });
    return out;
  }
  if (page.statusCode >= 400) {
    add({ category: "technical", code: page.statusCode >= 500 ? "server_error" : "client_error",
      severity: page.statusCode >= 500 ? "high" : "medium", confidence: 1,
      message: page.statusCode === 404 || page.statusCode === 410 ? `This page shows "page not found" (error ${page.statusCode}).` : `This page shows an error instead of loading (error ${page.statusCode}).`, evidence: { url: page.url, status: page.statusCode } });
    return out;
  }
  if (page.statusCode !== 200) {
    add({ category: "technical", code: "non_200_status", severity: "low", confidence: 1,
      message: `This page didn't load normally (code ${page.statusCode}).`, evidence: { url: page.url, status: page.statusCode } });
  }
  if (page.redirectChain.length > 1) {
    add({ category: "technical", code: "redirect_chain", severity: "low", confidence: 1,
      message: `Visitors are forwarded ${page.redirectChain.length} times before this page loads. Link straight to the final address.`,
      evidence: { url: page.url, chain: [...page.redirectChain, page.finalUrl].slice(0, 7) } });
  }

  const x = page.extracted;
  if (!x || !isHtml(page) || page.statusCode !== 200) return out;

  // Metadata
  if (!x.title) {
    add({ category: "metadata", code: "missing_title", severity: "high", confidence: 1,
      message: "This page has no Google headline.", evidence: { url, selector: "head > title" } });
  } else if (x.title.length > TITLE_MAX) {
    add({ category: "metadata", code: "title_too_long", severity: "low", confidence: 0.8,
      message: `The Google headline is ${x.title.length} characters, so Google may cut it off (aim for ${TITLE_MAX} or fewer).`,
      evidence: { url, title: snippet(x.title), length: x.title.length } });
  } else if (x.title.length < TITLE_MIN) {
    add({ category: "metadata", code: "title_too_short", severity: "low", confidence: 0.7,
      message: `The Google headline is only ${x.title.length} characters and may not say what the page is about.`,
      evidence: { url, title: snippet(x.title), length: x.title.length } });
  }
  if (!x.description) {
    add({ category: "metadata", code: "missing_meta_description", severity: "medium", confidence: 1,
      message: "This page has no Google summary, so Google shows random text from the page instead.", evidence: { url, selector: 'meta[name="description"]' } });
  } else if (x.description.length > DESCRIPTION_MAX) {
    add({ category: "metadata", code: "meta_description_too_long", severity: "low", confidence: 0.7,
      message: `The Google summary is ${x.description.length} characters, so Google may cut it off.`,
      evidence: { url, description: snippet(x.description), length: x.description.length } });
  }

  // Headings
  if (x.h1.length === 0) {
    add({ category: "content", code: "missing_h1", severity: "medium", confidence: 1,
      message: "This page has no main heading.", evidence: { url, selector: "h1" } });
  } else if (x.h1.length > 1) {
    add({ category: "content", code: "multiple_h1", severity: "low", confidence: 0.8,
      message: `This page has ${x.h1.length} main headings. One clear main heading is easier to understand.`,
      evidence: { url, h1: x.h1.slice(0, 5).map((t) => snippet(t, 100)) } });
  }
  const skips: string[] = [];
  for (let i = 1; i < x.headings.length; i++) {
    const prev = x.headings[i - 1].level;
    const cur = x.headings[i].level;
    if (cur > prev + 1) skips.push(`h${prev}→h${cur}`);
  }
  if (skips.length) {
    add({ category: "content", code: "heading_level_skip", severity: "low", confidence: 0.8,
      message: `Headings jump levels (${skips.slice(0, 3).join(", ")}), which muddles the page layout.`,
      evidence: { url, skips: skips.slice(0, 10) } });
  }

  // Indexability
  if (!x.canonical) {
    add({ category: "indexability", code: "missing_canonical", severity: "low", confidence: 0.9,
      message: "This page doesn't say which version is the main version of the page.", evidence: { url, selector: 'link[rel="canonical"]' } });
  } else if (hostOf(x.canonical) !== hostOf(url)) {
    add({ category: "indexability", code: "canonical_other_host", severity: "high", confidence: 0.9,
      message: "This page tells Google that a page on another website is the main version, so this page may be hidden from Google.",
      evidence: { url, canonical: x.canonical } });
  }
  if (x.robotsMeta && /\bnoindex\b|\bnone\b/i.test(x.robotsMeta)) {
    add({ category: "indexability", code: "noindex", severity: "high", confidence: 1,
      message: "This page is hidden from Google by a setting on the page. Check that this is on purpose.",
      evidence: { url, robotsMeta: snippet(x.robotsMeta, 100) } });
  }
  if (!x.lang) {
    add({ category: "technical", code: "missing_lang", severity: "low", confidence: 1,
      message: "This page doesn't say what language it's in.", evidence: { url, selector: "html[lang]" } });
  }

  const missingAlt = x.images.filter((i) => i.alt === null);
  if (missingAlt.length) {
    add({ category: "content", code: "images_missing_alt", severity: "low", confidence: 1,
      message: `${missingAlt.length} ${missingAlt.length === 1 ? "image has" : "images have"} no image description.`,
      evidence: { url, count: missingAlt.length, examples: missingAlt.slice(0, 5).map((i) => snippet(i.src, 200)) } });
  }
  if (x.wordCount < THIN_WORDS) {
    add({ category: "content", code: "thin_content", severity: "medium", confidence: 0.6,
      message: `This page has only about ${x.wordCount} words, so it may not answer customers' questions in enough detail.`,
      evidence: { url, wordCount: x.wordCount } });
  }
  if (x.jsonLd.some((j) => typeof j === "object" && j !== null && (j as Record<string, unknown>)["@invalid"] === true)) {
    add({ category: "schema", code: "invalid_json_ld", severity: "medium", confidence: 1,
      message: "The info for Google and AI on this page is broken and can't be read.", evidence: { url, selector: 'script[type="application/ld+json"]' } });
  }
  if (isQuestionStyle(x) && !x.hasFaq && !x.schemaTypes.includes("HowTo")) {
    add({ category: "ai_readiness", code: "question_page_without_faq_schema", severity: "low", confidence: 0.6,
      message: "This page is built around questions, but they aren't labelled as questions and answers for Google and AI. Labels make the answers easier to read; they don't make Google or AI use them.",
      evidence: { url, questionHeadings: x.headings.filter((h) => h.text.endsWith("?")).slice(0, 5).map((h) => snippet(h.text, 120)) } });
  }
  return out;
}

function groupBy<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Cross-page and site-level rules. */
export function auditSite(pages: AuditPage[], site: SiteContext): FindingInput[] {
  const out: FindingInput[] = [];
  const ok = pages.filter((p) => p.statusCode === 200 && p.extracted && isHtml(p));
  const urlOf = (p: AuditPage) => p.finalUrl || p.url;

  // Duplicate titles / descriptions / content — one finding per affected page.
  const dupes = (
    groups: Map<string, AuditPage[]>,
    code: string,
    category: FindingInput["category"],
    severity: FindingInput["severity"],
    label: string,
    value: (p: AuditPage) => string,
  ) => {
    for (const [, group] of Array.from(groups)) {
      const uniq = Array.from(new Map(group.map((p) => [keyOf(urlOf(p)), p])).values());
      if (uniq.length < 2) continue;
      for (const p of uniq) {
        out.push({ category, code, severity, confidence: 0.9, pageUrl: urlOf(p),
          message: `${label} is the same on ${uniq.length - 1} other ${uniq.length - 1 === 1 ? "page" : "pages"}.`,
          evidence: { url: urlOf(p), value: snippet(value(p)), others: uniq.filter((o) => o !== p).slice(0, 5).map(urlOf) } });
      }
    }
  };
  dupes(groupBy(ok, (p) => p.extracted!.title?.toLowerCase() ?? null), "duplicate_title", "metadata", "medium", "This Google headline", (p) => p.extracted!.title ?? "");
  dupes(groupBy(ok, (p) => p.extracted!.description?.toLowerCase() ?? null), "duplicate_meta_description", "metadata", "low", "This Google summary", (p) => p.extracted!.description ?? "");
  dupes(groupBy(ok.filter((p) => p.extracted!.wordCount >= 30), (p) => p.extracted!.contentFingerprint), "duplicate_content", "content", "medium", "The text of this page", (p) => p.extracted!.textSample);

  // Broken internal links (only targets we actually crawled).
  const statusByKey = new Map<string, { status: number | null; error?: string | null }>();
  for (const p of pages) {
    statusByKey.set(keyOf(p.url), { status: p.statusCode, error: p.error });
  }
  const sources = new Map<string, Set<string>>();
  for (const p of ok) {
    for (const link of p.extracted!.internalLinks) {
      const k = keyOf(link);
      const s = statusByKey.get(k);
      if (!s || (s.status !== null && s.status < 400)) continue;
      if (s.status === null) continue; // fetch errors are reported per page, not as broken links
      const set = sources.get(link) ?? new Set<string>();
      set.add(urlOf(p));
      sources.set(link, set);
    }
  }
  for (const [target, from] of Array.from(sources)) {
    const s = statusByKey.get(keyOf(target));
    out.push({ category: "links", code: "broken_internal_link", severity: "medium", confidence: 1, pageUrl: Array.from(from)[0],
      message: `A link to ${target} leads to an error page (error ${s?.status}); it's linked from ${from.size} ${from.size === 1 ? "page" : "pages"}.`,
      evidence: { target, status: s?.status ?? null, linkedFrom: Array.from(from).slice(0, 10) } });
  }

  // Sitemap
  if (site.sitemapsFound.length === 0) {
    out.push({ category: "technical", code: "no_sitemap", severity: "medium", confidence: 0.9, pageUrl: site.homepageUrl,
      message: "We couldn't find a page list for Google (sitemap) in the usual places.",
      evidence: { checked: ["robots.txt Sitemap:", "/sitemap.xml"] } });
  }

  // AI crawler access (robots.txt)
  const blockedBots = site.robots.aiBots
    ? site.robots.aiBots.filter((b) => !b.allowed).map((b) => b.token)
    : site.robots.blockedAiCrawlers;
  const searchBots = site.robots.aiBots
    ? new Set(site.robots.aiBots.filter((b) => b.purpose !== "training").map((b) => b.token))
    : SEARCH_AI_BOTS;
  if (site.robots.fetched && blockedBots.length) {
    const blocksSearch = blockedBots.some((b) => searchBots.has(b));
    out.push({ category: "ai_readiness", code: "ai_crawler_access", severity: blocksSearch ? "medium" : "info", confidence: 0.9,
      pageUrl: site.homepageUrl,
      message: `Your site's robot rules file blocks ${blockedBots.length === 1 ? "this AI robot" : "these AI robots"}: ${blockedBots.join(", ")}. ${blocksSearch
        ? "Blocking AI robots that answer live questions can stop AI assistants from reading your pages and linking to you."
        : "These robots mainly collect training data. Blocking them is a business choice and may not affect live AI answers."}`,
      evidence: { blocked: blockedBots } });
  }

  // Structured data
  const home = pages.find((p) => keyOf(p.url) === keyOf(site.homepageUrl)) ?? ok[0];
  if (home?.extracted && home.statusCode === 200) {
    const types = home.extracted.schemaTypes;
    if (!types.some((t) => ORG_TYPES.has(t))) {
      out.push({ category: "schema", code: "missing_organization_schema", severity: "medium", confidence: 0.9, pageUrl: urlOf(home),
        message: "Your homepage has no business info for Google and AI. It helps them recognise your business name, logo and official profiles.",
        evidence: { url: urlOf(home), schemaTypes: types.slice(0, 20) } });
    }
  }
  if (ok.length > 0 && ok.every((p) => p.extracted!.jsonLd.length === 0)) {
    out.push({ category: "schema", code: "no_structured_data", severity: "medium", confidence: 0.8, pageUrl: site.homepageUrl,
      message: `None of the ${ok.length} pages we checked include info for Google and AI.`,
      evidence: { pagesChecked: ok.length } });
  }

  if (!site.llmsTxtFound) {
    out.push({ category: "ai_readiness", code: "no_llms_txt", severity: "info", confidence: 0.5, pageUrl: site.homepageUrl,
      message: "No AI guide file was found. It's a new idea with no proven effect on AI mentions yet, so treat it as optional.",
      evidence: { checked: "/llms.txt" } });
  }
  return out;
}

export function runAudit(pages: AuditPage[], site: SiteContext): FindingInput[] {
  return [...pages.flatMap(auditPage), ...auditSite(pages, site)];
}
