// What the audit-depth pass tests (pure): plan limits, which pages get a PageSpeed Insights test, and which
// image / link / canonical URLs get probed. Inputs are stored crawl pages; no I/O here.
import type { PlanId } from "@/lib/types";
import type { AuditPage } from "@/lib/audit/rules";
import { crawlPriority, isHomeUrl, isUtilityUrl } from "@/lib/audit/page-kind";
import { looksLikePage, normalizeUrl, urlKey } from "@/lib/crawler/normalize";
import { indexablePages, okPages, urlOf } from "@/lib/report/inputs";

/**
 * Key pages tested with PageSpeed Insights on mobile, IN ADDITION to the homepage (which is always tested on
 * mobile and desktop). Owned here; the lead copies these into the plan tables.
 */
export const PSI_KEY_PAGES_PER_PLAN: Record<PlanId, number> = { trial: 0, starter: 3, growth: 10, agency: 25 };
export const MAX_IMAGE_PROBES = 30;
export const MAX_LINK_PROBES = 30;
export const MAX_CANONICAL_PROBES = 20;
/** Images above this size are flagged as large. */
export const LARGE_IMAGE_BYTES = 200 * 1024;

export function psiKeyPagesFor(planId: string | null | undefined): number {
  return planId && planId in PSI_KEY_PAGES_PER_PLAN ? PSI_KEY_PAGES_PER_PLAN[planId as PlanId] : PSI_KEY_PAGES_PER_PLAN.trial;
}

export interface PsiTarget {
  url: string;
  isHome: boolean;
}

const exact = (u: string) => normalizeUrl(u) ?? u;

/** Homepage (final URL) first, then up to `keyPages` indexable, non-utility pages in crawl-priority order. */
export function selectPsiTargets(pages: AuditPage[], homepageUrl: string | null, keyPages: number): PsiTarget[] {
  const ok = okPages(pages);
  const homeKey = homepageUrl ? urlKey(homepageUrl) : null;
  const home =
    ok.find((p) => homeKey && (urlKey(p.url) === homeKey || urlKey(p.finalUrl) === homeKey)) ??
    ok.find((p) => isHomeUrl(urlOf(p))) ??
    null;
  const out: PsiTarget[] = [];
  const seen = new Set<string>();
  const add = (url: string, isHome: boolean) => {
    const k = urlKey(url) ?? url;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ url, isHome });
  };
  if (home) add(urlOf(home), true);
  else if (homepageUrl) add(homepageUrl, true);

  if (keyPages > 0) {
    const navKeys = new Set((home?.extracted?.navLinks ?? []).map((l) => urlKey(l)).filter((k): k is string => !!k));
    const inbound = new Map<string, number>();
    for (const p of ok) for (const l of p.extracted!.internalLinks) {
      const k = urlKey(l);
      if (k) inbound.set(k, (inbound.get(k) ?? 0) + 1);
    }
    const candidates = indexablePages(pages)
      .filter((p) => !isUtilityUrl(urlOf(p)) && !isHomeUrl(urlOf(p)))
      .map((p) => ({ url: urlOf(p), prio: crawlPriority(urlOf(p), navKeys), links: inbound.get(urlKey(urlOf(p)) ?? "") ?? 0 }))
      .sort((a, b) => a.prio - b.prio || b.links - a.links || a.url.localeCompare(b.url));
    for (const c of candidates) {
      if (out.length >= keyPages + 1) break;
      add(c.url, false);
    }
  }
  return out;
}

export interface ProbeTarget {
  url: string;
  pages: string[];
}

function ranked(m: Map<string, Set<string>>, max: number): ProbeTarget[] {
  return Array.from(m.entries())
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([url, set]) => ({ url, pages: Array.from(set).slice(0, 10) }));
}

/** Distinct http(s) images, most-used first (key pages count first by crawl order). */
export function selectImageProbes(pages: AuditPage[], max = MAX_IMAGE_PROBES): ProbeTarget[] {
  const m = new Map<string, Set<string>>();
  for (const p of okPages(pages)) {
    for (const img of p.extracted!.images) {
      if (!/^https?:\/\//i.test(img.src)) continue;
      const set = m.get(img.src) ?? new Set<string>();
      set.add(urlOf(p));
      m.set(img.src, set);
    }
  }
  return ranked(m, max);
}

/** Every exact URL the crawl fetched (requested and final), so only unknown link targets get probed. */
function fetchedUrls(pages: AuditPage[]): Set<string> {
  const s = new Set<string>();
  for (const p of pages) {
    s.add(exact(p.url));
    if (p.finalUrl) s.add(exact(p.finalUrl));
  }
  return s;
}

/**
 * Internal link targets the crawl didn't fetch at that exact address — e.g. "/about" when "/about/" was crawled.
 * The crawler skips addresses that redirect onto a page it already has, so these may be redirects.
 */
export function selectLinkProbes(pages: AuditPage[], max = MAX_LINK_PROBES): ProbeTarget[] {
  const known = fetchedUrls(pages);
  const m = new Map<string, Set<string>>();
  for (const p of okPages(pages)) {
    for (const l of p.extracted!.internalLinks) {
      const u = exact(l);
      if (known.has(u) || !looksLikePage(u)) continue;
      const set = m.get(u) ?? new Set<string>();
      set.add(urlOf(p));
      m.set(u, set);
    }
  }
  return ranked(m, max);
}

/** Same-site canonical targets (pointing at another URL) that the crawl didn't fetch at that exact address. */
export function selectCanonicalProbes(pages: AuditPage[], siteHost: string | null, max = MAX_CANONICAL_PROBES): ProbeTarget[] {
  const known = fetchedUrls(pages);
  const m = new Map<string, Set<string>>();
  const host = (u: string) => {
    try {
      return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  for (const p of okPages(pages)) {
    const c = p.extracted!.canonical;
    if (!c) continue;
    const u = exact(c);
    if (known.has(u) || u === exact(urlOf(p))) continue;
    if (siteHost && host(u) !== siteHost.replace(/^www\./, "")) continue;
    const set = m.get(u) ?? new Set<string>();
    set.add(urlOf(p));
    m.set(u, set);
  }
  return ranked(m, max);
}

/** Crawled noindex pages whose address appears in the sitemap URL list. */
export function noindexInSitemap(pages: AuditPage[], sitemapUrls: string[]): string[] {
  const listed = new Set(sitemapUrls.map((u) => urlKey(u)).filter((k): k is string => !!k));
  const out: string[] = [];
  for (const p of okPages(pages)) {
    if (!/\bnoindex\b|\bnone\b/i.test(p.extracted!.robotsMeta ?? "")) continue;
    if (listed.has(urlKey(p.url) ?? "") || listed.has(urlKey(p.finalUrl) ?? "")) out.push(urlOf(p));
  }
  return out;
}
