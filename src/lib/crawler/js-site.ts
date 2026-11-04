// JavaScript-only sites: the server sends an (almost) empty HTML shell and the text appears only after
// JavaScript runs in the browser. Google and AI tools that read raw HTML then see blank pages, which used to show
// up as dozens of "no main heading", "same Google headline", "too little text" problems. We detect it once per
// website check and show ONE problem instead (report check "seo.js_rendering").
//
// Two ways to know:
// 1. Rendered comparison (best): a headless browser renders a page; if the rendered page has real text and the raw
//    HTML has almost none, the content exists only after JavaScript. See ./render.ts (optional dependency).
// 2. Heuristic (fallback, pure): most pages are app shells — an app mount point (#root, #__next, #app, ng-version,
//    data-reactroot…) or script bundles with ~0 visible words — and the pages share the same Google headline.
// Pure: no I/O.
import type { ExtractedPage } from "@/lib/types";

/** Visible words at or below which a raw page counts as "empty" (cookie banners, "Loading…", footers). */
export const SHELL_MAX_WORDS = 40;
/** Rendered pages with at least this many words (and ≥ 3× the raw count) prove content needs JavaScript. */
export const RENDERED_MIN_WORDS = 120;
/** Share of checked pages that must be shells. */
export const SHELL_SHARE = 0.6;

export interface RenderComparison {
  url: string;
  rawWords: number;
  renderedWords: number;
}

export interface JsSiteDetection {
  detected: boolean;
  method: "rendered" | "heuristic";
  /** Pages that look like empty app shells, out of the HTML pages checked. */
  shellPages: number;
  totalPages: number;
  appRoot: string | null;
  /** Share of pages carrying the most common Google headline (1 = all the same). */
  sameTitleShare: number;
  rendered?: RenderComparison[];
  examples: string[];
}

type PageLike = { url: string; finalUrl?: string | null; statusCode: number | null; contentType?: string | null; extracted: ExtractedPage | null };

const isHtml = (p: PageLike) => !p.contentType || /html/i.test(p.contentType);
const urlOf = (p: PageLike) => p.finalUrl || p.url;

/** Does this raw page look like an empty JavaScript app shell? */
export function isShellPage(x: ExtractedPage): boolean {
  if (x.wordCount > SHELL_MAX_WORDS) return false;
  if (x.h1.length > 0 && x.wordCount > 10) return false;
  const root = x.jsShell?.appRoot ?? null;
  const scripts = x.jsShell?.scripts;
  // Older crawls have no jsShell signal: fall back to the detected platform (React / Next.js app markup).
  const appish = root !== null || x.platform === "react" || x.platform === "nextjs";
  if (scripts === undefined) return appish;
  return scripts > 0 && (appish || x.wordCount <= 5);
}

/** True when rendering proves content appears only after JavaScript. */
export function renderedShowsJsOnly(r: RenderComparison): boolean {
  return r.rawWords <= SHELL_MAX_WORDS && r.renderedWords >= RENDERED_MIN_WORDS && r.renderedWords >= r.rawWords * 3;
}

export function detectJsOnlySite(pages: PageLike[], rendered: RenderComparison[] = []): JsSiteDetection {
  const ok = pages.filter((p) => p.statusCode === 200 && p.extracted && isHtml(p));
  const shells = ok.filter((p) => isShellPage(p.extracted!));
  const titles = new Map<string, number>();
  for (const p of ok) {
    const t = (p.extracted!.title ?? "").trim().toLowerCase();
    titles.set(t, (titles.get(t) ?? 0) + 1);
  }
  const topTitle = Math.max(0, ...titles.values());
  const sameTitleShare = ok.length ? topTitle / ok.length : 0;
  const appRoot = shells.map((p) => p.extracted!.jsShell?.appRoot ?? null).find((r) => r !== null) ?? null;
  const base = {
    shellPages: shells.length,
    totalPages: ok.length,
    appRoot,
    sameTitleShare: Math.round(sameTitleShare * 100) / 100,
    examples: shells.slice(0, 5).map(urlOf),
  };

  if (rendered.length) {
    // A real browser comparison wins over the heuristic in both directions.
    const proves = rendered.filter(renderedShowsJsOnly);
    return { ...base, detected: proves.length > 0 && proves.length * 2 >= rendered.length, method: "rendered", rendered };
  }

  if (ok.length === 0) return { ...base, detected: false, method: "heuristic" };
  const shellShare = shells.length / ok.length;
  // Same headline on most pages is the tell-tale sign of one HTML file serving every address. With only one or two
  // pages (a shell has no links to follow) there is nothing to compare, so the shell share decides alone.
  const titlesAgree = ok.length < 3 || sameTitleShare >= SHELL_SHARE || shellShare >= 0.9;
  return { ...base, detected: shellShare >= SHELL_SHARE && titlesAgree, method: "heuristic" };
}

/** Report checks that only repeat what an empty JavaScript shell causes. Suppressed when detected. */
export const JS_SYMPTOM_CHECKS: ReadonlySet<string> = new Set([
  "seo.titles", "seo.meta_description", "seo.h1", "seo.thin_content", "seo.duplicate_content", "seo.internal_links", "seo.image_alt",
  "aeo.question_headings", "aeo.direct_answers", "aeo.content_depth", "aeo.readability", "aeo.lists_tables",
  "geo.quotable_facts", "geo.cited_sources", "geo.author_signals", "geo.freshness",
  "brand.name_consistency", "brand.about_page", "brand.contact_info", "brand.privacy_policy", "brand.social_profiles",
]);

/** Audit finding codes caused by an empty JavaScript shell. Replaced by one "js_only_site" finding. */
export const JS_SYMPTOM_FINDINGS: ReadonlySet<string> = new Set([
  "missing_title", "title_too_short", "duplicate_title", "missing_meta_description", "duplicate_meta_description",
  "missing_h1", "multiple_h1", "heading_level_skip", "thin_content", "duplicate_content", "images_missing_alt",
  "question_page_without_faq_schema",
]);

export const JS_SITE_FINDING_CODE = "js_only_site";
export const JS_SITE_CHECK_ID = "seo.js_rendering";

/** Parse a stored detection (WorkflowRun.output.jsSite); null when absent or malformed. */
export function parseJsSite(v: unknown): JsSiteDetection | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Partial<JsSiteDetection>;
  if (typeof o.detected !== "boolean" || (o.method !== "rendered" && o.method !== "heuristic")) return null;
  return {
    detected: o.detected,
    method: o.method,
    shellPages: typeof o.shellPages === "number" ? o.shellPages : 0,
    totalPages: typeof o.totalPages === "number" ? o.totalPages : 0,
    appRoot: typeof o.appRoot === "string" ? o.appRoot : null,
    sameTitleShare: typeof o.sameTitleShare === "number" ? o.sameTitleShare : 0,
    rendered: Array.isArray(o.rendered) ? o.rendered.filter((r): r is RenderComparison => !!r && typeof r.url === "string") : undefined,
    examples: Array.isArray(o.examples) ? o.examples.filter((u): u is string => typeof u === "string") : [],
  };
}
