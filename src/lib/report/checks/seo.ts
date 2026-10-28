// SEO checks: can search engines reach, read and understand the pages?
import { TITLE_MAX, TITLE_MIN, DESCRIPTION_MAX, THIN_WORDS } from "@/lib/audit/rules";
import { isHomeUrl, isUtilityUrl } from "@/lib/audit/page-kind";
import { urlKey } from "@/lib/crawler/normalize";
import {
  findHome, makeCheck, notMeasured, okPages, plural, ratioScore, urlOf, v2Pages, NEEDS_RESCAN,
  type CheckContext, type EvaluatedCheck,
} from "@/lib/report/inputs";

const P = "seo" as const;
const keyOf = (u: string) => urlKey(u) ?? u;
export const HTML_HEAVY_BYTES = 500 * 1024;
export const RENDER_BLOCKING_MAX = 3;

function dupGroups(values: { url: string; v: string | null | undefined }[]) {
  const m = new Map<string, Set<string>>();
  for (const { url, v } of values) {
    if (!v) continue;
    const k = v.trim().toLowerCase();
    const set = m.get(k) ?? new Set<string>();
    set.add(keyOf(url));
    m.set(k, set);
  }
  const dupUrls = new Set<string>();
  let groups = 0;
  for (const set of m.values()) {
    if (set.size > 1) {
      groups++;
      set.forEach((u) => dupUrls.add(u));
    }
  }
  return { dupUrls, groups };
}

export function seoChecks(ctx: CheckContext): EvaluatedCheck[] {
  const all = ctx.pages;
  const ok = okPages(all);
  const out: EvaluatedCheck[] = [];
  if (all.length === 0) return out;

  // Indexability: errors, non-200 and noindex.
  {
    const errors = all.filter((p) => p.statusCode === null || p.statusCode >= 400 || !!p.error);
    const noindex = ok.filter((p) => /\bnoindex\b|\bnone\b/i.test(p.extracted!.robotsMeta ?? ""));
    const bad = [...errors.map(urlOf), ...noindex.map(urlOf)];
    const parts = [] as string[];
    if (errors.length) parts.push(`${plural(errors.length, "page")} returned an error or could not be loaded`);
    if (noindex.length) parts.push(`${plural(noindex.length, "page")} ${noindex.length === 1 ? "tells" : "tell"} search engines not to index ${noindex.length === 1 ? "it" : "them"} (noindex)`);
    out.push(makeCheck(P, "seo.indexability", "Pages search engines can index", 3, {
      score: ratioScore(bad.length, all.length),
      detail: parts.length ? `${parts.join("; ")} — out of ${all.length} pages checked.` : `All ${all.length} pages checked load correctly and allow indexing.`,
      affected: bad,
      facts: { errors: errors.length, noindex: noindex.length, total: all.length },
    }));
  }

  // Redirect chains.
  {
    const chains = all.filter((p) => p.redirectChain.length > 1);
    out.push(makeCheck(P, "seo.redirects", "Redirect chains", 1, {
      score: ratioScore(chains.length * 2, all.length),
      detail: chains.length ? `${plural(chains.length, "page")} can only be reached through 2 or more redirects.` : "No pages sit behind chains of redirects.",
      affected: chains.map((p) => p.url),
      facts: { chains: chains.length },
    }));
  }

  if (ok.length === 0) return out;

  // Titles.
  {
    const missing = ok.filter((p) => !p.extracted!.title);
    const long = ok.filter((p) => (p.extracted!.title?.length ?? 0) > TITLE_MAX);
    const short = ok.filter((p) => p.extracted!.title && p.extracted!.title.length < TITLE_MIN);
    const { dupUrls, groups } = dupGroups(ok.map((p) => ({ url: urlOf(p), v: p.extracted!.title })));
    const badSet = new Set([...missing, ...short].map(urlOf).map(keyOf).concat(Array.from(dupUrls)));
    const score = ratioScore(badSet.size + long.length * 0.3, ok.length);
    const parts: string[] = [];
    if (missing.length) parts.push(`${missing.length} missing`);
    if (dupUrls.size) parts.push(`${dupUrls.size} duplicated`);
    if (long.length) parts.push(`${long.length} too long (over ${TITLE_MAX} characters)`);
    if (short.length) parts.push(`${short.length} too short`);
    out.push(makeCheck(P, "seo.titles", "Page titles", 3, {
      score,
      detail: parts.length ? `Of ${ok.length} pages, titles are ${parts.join(", ")}.` : `All ${ok.length} pages have a unique title of a sensible length.`,
      affected: [...missing.map(urlOf), ...Array.from(dupUrls), ...short.map(urlOf), ...long.map(urlOf)],
      affectedCount: new Set([...badSet, ...long.map((p) => keyOf(urlOf(p)))]).size,
      evidence: long[0]?.extracted?.title ? `Example long title (${long[0].extracted.title.length} chars): "${long[0].extracted.title.slice(0, 90)}"` : undefined,
      facts: { missing: missing.length, duplicate: dupUrls.size, duplicateGroups: groups, long: long.length, short: short.length, total: ok.length },
    }));
  }

  // Meta descriptions.
  {
    const missing = ok.filter((p) => !p.extracted!.description);
    const long = ok.filter((p) => (p.extracted!.description?.length ?? 0) > DESCRIPTION_MAX);
    const { dupUrls } = dupGroups(ok.map((p) => ({ url: urlOf(p), v: p.extracted!.description })));
    const badSet = new Set([...missing.map(urlOf).map(keyOf), ...Array.from(dupUrls)]);
    const parts: string[] = [];
    const verb = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    if (missing.length) parts.push(verb(missing.length, "has no description", "have no description"));
    if (dupUrls.size) parts.push(verb(dupUrls.size, "shares a description with another page", "share a description with another page"));
    if (long.length) parts.push(verb(long.length, `is longer than ${DESCRIPTION_MAX} characters`, `are longer than ${DESCRIPTION_MAX} characters`));
    out.push(makeCheck(P, "seo.meta_description", "Meta descriptions", 2, {
      score: ratioScore(badSet.size + long.length * 0.3, ok.length),
      detail: parts.length ? `Of ${ok.length} pages, ${parts.join(", ")}.` : `All ${ok.length} pages have their own description.`,
      affected: [...missing.map(urlOf), ...Array.from(dupUrls), ...long.map(urlOf)],
      affectedCount: new Set([...badSet, ...long.map((p) => keyOf(urlOf(p)))]).size,
      facts: { missing: missing.length, duplicate: dupUrls.size, long: long.length, total: ok.length },
    }));
  }

  // H1.
  {
    const missing = ok.filter((p) => p.extracted!.h1.length === 0);
    const multiple = ok.filter((p) => p.extracted!.h1.length > 1);
    out.push(makeCheck(P, "seo.h1", "Main headings (H1)", 2, {
      score: ratioScore(missing.length + multiple.length * 0.4, ok.length),
      detail: missing.length || multiple.length
        ? `Of ${ok.length} pages, ${[
            missing.length ? `${missing.length} ${missing.length === 1 ? "has" : "have"} no main heading` : "",
            multiple.length ? `${multiple.length} ${multiple.length === 1 ? "has" : "have"} more than one` : "",
          ].filter(Boolean).join(" and ")}.`
        : `Every page has exactly one main heading.`,
      affected: [...missing.map(urlOf), ...multiple.map(urlOf)],
      facts: { missing: missing.length, multiple: multiple.length, total: ok.length },
    }));
  }

  // Canonicals.
  {
    const missing = ok.filter((p) => !p.extracted!.canonical);
    const homeHost = (u: string) => {
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    };
    const offsite = ok.filter((p) => p.extracted!.canonical && homeHost(p.extracted!.canonical) !== homeHost(urlOf(p)));
    out.push(makeCheck(P, "seo.canonical", "Canonical tags", 1.5, {
      score: ratioScore(missing.length * 0.5 + offsite.length * 2, ok.length),
      detail: missing.length || offsite.length
        ? `${plural(missing.length, "page")} without a canonical tag${offsite.length ? `; ${offsite.length} point${offsite.length === 1 ? "s" : ""} to a different website` : ""} (of ${ok.length}).`
        : `All ${ok.length} pages declare their preferred address (canonical).`,
      affected: [...offsite.map(urlOf), ...missing.map(urlOf)],
      facts: { missing: missing.length, offsite: offsite.length, total: ok.length },
    }));
  }

  // Broken internal links (targets we crawled that returned 4xx/5xx).
  {
    const statusBy = new Map(all.map((p) => [keyOf(p.url), p.statusCode]));
    const broken = new Map<string, Set<string>>();
    for (const p of ok) {
      for (const l of p.extracted!.internalLinks) {
        const s = statusBy.get(keyOf(l));
        if (typeof s === "number" && s >= 400) {
          const set = broken.get(l) ?? new Set<string>();
          set.add(urlOf(p));
          broken.set(l, set);
        }
      }
    }
    const fromFindings = ctx.findings.filter((f) => f.code === "broken_internal_link").length;
    const n = Math.max(broken.size, fromFindings);
    const sources = new Set(Array.from(broken.values()).flatMap((s) => Array.from(s)));
    out.push(makeCheck(P, "seo.broken_links", "Broken internal links", 2, {
      score: n === 0 ? 100 : Math.max(0, 85 - n * 10),
      detail: n ? `${plural(n, "link")} inside your site lead${n === 1 ? "s" : ""} to an error page, found on ${plural(sources.size, "page")}.` : "No broken links found between the pages we checked.",
      affected: Array.from(sources),
      evidence: broken.size ? `Broken: ${Array.from(broken.keys()).slice(0, 3).join(", ")}` : undefined,
      facts: { broken: n, sourcePages: sources.size },
    }));
  }

  // Internal linking: crawled pages no other crawled page links to.
  if (ok.length >= 3) {
    const linked = new Set<string>();
    for (const p of ok) for (const l of p.extracted!.internalLinks) if (keyOf(l) !== keyOf(urlOf(p))) linked.add(keyOf(l));
    const orphans = ok.filter((p) => !isHomeUrl(urlOf(p)) && !linked.has(keyOf(urlOf(p))) && !linked.has(keyOf(p.url)));
    out.push(makeCheck(P, "seo.internal_links", "Internal linking", 1, {
      score: ratioScore(orphans.length, ok.length),
      detail: orphans.length ? `${plural(orphans.length, "page")} ${orphans.length === 1 ? "is" : "are"} not linked from any other page we checked (found only via the sitemap).` : "Every page we checked is linked from at least one other page.",
      affected: orphans.map(urlOf),
      facts: { orphans: orphans.length, total: ok.length },
    }));
  }

  // Image alt text.
  {
    let images = 0;
    let missing = 0;
    const pagesWith: string[] = [];
    for (const p of ok) {
      const m = p.extracted!.images.filter((i) => i.alt === null).length;
      images += p.extracted!.images.length;
      missing += m;
      if (m) pagesWith.push(urlOf(p));
    }
    out.push(images === 0
      ? notMeasured(P, "seo.image_alt", "Image descriptions (alt text)", 1, "No images were found on the pages we checked.")
      : makeCheck(P, "seo.image_alt", "Image descriptions (alt text)", 1, {
          score: ratioScore(missing, images),
          detail: missing ? `${missing} of ${images} images have no alt text, across ${plural(pagesWith.length, "page")}.` : `All ${images} images have alt text.`,
          affected: pagesWith,
          facts: { missing, images },
        }));
  }

  // Thin content (excluding contact/legal/utility pages).
  {
    const content = ok.filter((p) => !isUtilityUrl(urlOf(p)));
    const thin = content.filter((p) => p.extracted!.wordCount < THIN_WORDS);
    out.push(content.length === 0
      ? notMeasured(P, "seo.thin_content", "Enough content per page", 2, "Only utility pages (contact, legal) were found.")
      : makeCheck(P, "seo.thin_content", "Enough content per page", 2, {
          score: ratioScore(thin.length, content.length),
          detail: thin.length ? `${thin.length} of ${content.length} content pages have fewer than ${THIN_WORDS} words.` : `All ${content.length} content pages have at least ${THIN_WORDS} words.`,
          affected: thin.sort((a, b) => a.extracted!.wordCount - b.extracted!.wordCount).map(urlOf),
          evidence: thin[0] ? `Shortest: ${urlOf(thin[0])} (${thin[0].extracted!.wordCount} words)` : undefined,
          facts: { thin: thin.length, total: content.length },
        }));
  }

  // Duplicate content.
  {
    const groups = new Map<string, string[]>();
    for (const p of ok) {
      if (p.extracted!.wordCount < 30) continue;
      const arr = groups.get(p.extracted!.contentFingerprint) ?? [];
      if (!arr.some((u) => keyOf(u) === keyOf(urlOf(p)))) arr.push(urlOf(p));
      groups.set(p.extracted!.contentFingerprint, arr);
    }
    const dups = Array.from(groups.values()).filter((g) => g.length > 1).flat();
    out.push(makeCheck(P, "seo.duplicate_content", "Duplicate pages", 1.5, {
      score: ratioScore(dups.length, ok.length),
      detail: dups.length ? `${dups.length} pages have exactly the same text as another page.` : "No pages have identical text.",
      affected: dups,
      facts: { duplicates: dups.length },
    }));
  }

  // Sitemap.
  {
    const site = ctx.site;
    const found = site ? site.sitemapsFound.length > 0 : !ctx.findings.some((f) => f.code === "no_sitemap");
    out.push(makeCheck(P, "seo.sitemap", "XML sitemap", 1.5, {
      score: found ? 100 : 20,
      detail: found
        ? `A sitemap was found${site?.sitemapUrlCount ? ` listing ${site.sitemapUrlCount} pages` : ""}.`
        : "No XML sitemap was found (checked robots.txt and /sitemap.xml).",
      affected: found ? [] : [site?.homepageUrl ?? ctx.websiteUrl],
      facts: { found },
    }));
  }

  // HTTPS.
  {
    const insecure = all.filter((p) => urlOf(p).startsWith("http:"));
    const homeHttps = ctx.site?.https ?? (findHome(ctx) ? urlOf(findHome(ctx)!).startsWith("https:") : null);
    const redirects = ctx.site?.httpRedirectsToHttps ?? null;
    let score = ratioScore(insecure.length, all.length);
    if (homeHttps === false) score = 0;
    else if (redirects === false) score = Math.min(score, 60);
    out.push(makeCheck(P, "seo.https", "Secure connection (HTTPS)", 2, {
      score,
      detail: homeHttps === false
        ? "Your homepage is not served over a secure (https) connection."
        : insecure.length
          ? `${plural(insecure.length, "page")} still load over insecure http.`
          : redirects === false
            ? "Pages use https, but the http:// address does not redirect to the secure version."
            : "All pages load over a secure https connection.",
      affected: insecure.map(urlOf),
      facts: { insecure: insecure.length, homeHttps, httpRedirectsToHttps: redirects },
    }));
  }

  const v2 = v2Pages(all);
  // Mobile viewport.
  if (v2.length === 0) {
    out.push(notMeasured(P, "seo.mobile_viewport", "Mobile-friendly setup", 1.5, NEEDS_RESCAN));
  } else {
    const missing = v2.filter((p) => !/width\s*=\s*device-width/i.test(p.extracted!.viewport ?? ""));
    out.push(makeCheck(P, "seo.mobile_viewport", "Mobile-friendly setup", 1.5, {
      score: ratioScore(missing.length, v2.length),
      detail: missing.length ? `${missing.length} of ${v2.length} pages lack the mobile "viewport" setting, so phones may show a shrunken desktop page.` : `All ${v2.length} pages are set up to scale on phones (viewport tag).`,
      affected: missing.map(urlOf),
      facts: { missing: missing.length, total: v2.length },
    }));
  }

  // Page speed proxy.
  {
    const sized = ok.filter((p) => typeof p.responseBytes === "number");
    if (sized.length === 0 && v2.length === 0) {
      out.push(notMeasured(P, "seo.page_speed_proxy", "Page weight (speed proxy)", 1, NEEDS_RESCAN));
    } else {
      const heavy = sized.filter((p) => (p.responseBytes ?? 0) > HTML_HEAVY_BYTES);
      const blocking = v2.filter((p) => (p.extracted!.renderBlockingScripts ?? 0) > RENDER_BLOCKING_MAX);
      const bad = new Set([...heavy, ...blocking].map(urlOf));
      const avgKb = sized.length ? Math.round(sized.reduce((a, p) => a + (p.responseBytes ?? 0), 0) / sized.length / 1024) : null;
      out.push(makeCheck(P, "seo.page_speed_proxy", "Page weight (speed proxy)", 1, {
        score: ratioScore(bad.size, Math.max(sized.length, v2.length)),
        detail: `Proxy, not a speed test: ${heavy.length} pages have HTML over ${HTML_HEAVY_BYTES / 1024} KB and ${blocking.length} load more than ${RENDER_BLOCKING_MAX} blocking scripts before showing content${avgKb !== null ? ` (average HTML ${avgKb} KB)` : ""}.`,
        affected: Array.from(bad),
        facts: { heavy: heavy.length, blocking: blocking.length, avgKb },
      }));
    }
  }

  // Open Graph (link previews).
  if (v2.length === 0) {
    out.push(notMeasured(P, "seo.open_graph", "Social sharing previews", 1, NEEDS_RESCAN));
  } else {
    const missing = v2.filter((p) => !p.extracted!.openGraph?.title || !p.extracted!.openGraph?.image);
    out.push(makeCheck(P, "seo.open_graph", "Social sharing previews", 1, {
      score: ratioScore(missing.length, v2.length),
      detail: missing.length ? `${missing.length} of ${v2.length} pages lack a sharing title or image (Open Graph tags).` : `All ${v2.length} pages have sharing previews set up.`,
      affected: missing.map(urlOf),
      facts: { missing: missing.length, total: v2.length },
    }));
  }
  return out;
}
