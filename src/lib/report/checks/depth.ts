// "Audit depth" checks (SEO pillar): real Core Web Vitals from Google PageSpeed Insights, plus checks that need the
// v3 extractor fields or the post-crawl URL probes (src/lib/pagespeed). Every check is skipped — not shown as a
// problem — when its data isn't there yet (older crawls, PSI not run), so old reports don't fill up with
// "not measured" rows. Weights are modest so one new check can't swing a score.
import { urlKey } from "@/lib/crawler/normalize";
import { isHomeUrl } from "@/lib/audit/page-kind";
import { summarizeVitals } from "@/lib/pagespeed/vitals";
import { LARGE_IMAGE_BYTES } from "@/lib/pagespeed/plan";
import {
  findHome, isV3, makeCheck, okPages, plural, qualityPages, ratioScore, urlOf,
  type CheckContext, type EvaluatedCheck, type ReportPage,
} from "@/lib/report/inputs";

const P = "seo" as const;
const keyOf = (u: string) => urlKey(u) ?? u;

/** Click depth above which a page counts as "buried" (homepage = 0). */
export const DEEP_CLICKS = 3;

/** BCP 47-ish hreflang value: language, optional script/region, or x-default. */
const HREFLANG_RE = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;

/** True when Core Web Vitals were actually measured for this crawl (then the size-based estimate is dropped). */
export function vitalsMeasured(ctx: CheckContext): boolean {
  return summarizeVitals(ctx.depth)?.status === "measured";
}

/** Shortest click distance from the homepage for every crawled page reachable through crawled internal links. */
export function clickDepths(pages: ReportPage[], homeUrl: string | null): Map<string, number> {
  const ok = okPages(pages);
  const links = new Map<string, string[]>();
  for (const p of ok) links.set(keyOf(urlOf(p)), p.extracted!.internalLinks.map(keyOf));
  const depth = new Map<string, number>();
  const start = homeUrl ? keyOf(homeUrl) : null;
  if (!start || !links.has(start)) return depth;
  depth.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    for (const next of links.get(cur) ?? []) {
      if (!depth.has(next) && links.has(next)) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }
  return depth;
}

export function depthChecks(ctx: CheckContext): EvaluatedCheck[] {
  const out: EvaluatedCheck[] = [];
  const ok = okPages(ctx.pages);
  if (ok.length === 0) return out;
  const q = qualityPages(ctx.pages);
  const v3 = q.filter(isV3);

  // Core Web Vitals (real data from Google PageSpeed Insights).
  const vitals = summarizeVitals(ctx.depth);
  if (vitals?.status === "measured" && vitals.tested > 0) {
    const mobile = vitals.pages.filter((p) => p.strategy === "mobile");
    const slow = mobile.filter((p) => p.overall === "poor");
    const middling = mobile.filter((p) => p.overall === "needs_improvement");
    const sourceText =
      vitals.source === "field" ? "real visitors' data from Google" : vitals.source === "lab" ? "Google's lab test (not enough real-visitor data yet)" : "a mix of real-visitor data and Google's lab test";
    out.push(makeCheck(P, "seo.core_web_vitals", "Page speed (Core Web Vitals)", 2, {
      score: ratioScore(slow.length + middling.length * 0.5, vitals.tested),
      detail: `${vitals.passing} of ${vitals.tested} pages tested on mobile pass Google's Core Web Vitals${slow.length ? `; ${plural(slow.length, "page")} ${slow.length === 1 ? "is" : "are"} slow` : ""}${middling.length ? `; ${plural(middling.length, "page")} need${middling.length === 1 ? "s" : ""} improvement` : ""}. Measured with ${sourceText}.`,
      affected: [...slow, ...middling].map((p) => p.url),
      facts: { tested: vitals.tested, passing: vitals.passing, slow: slow.length, middling: middling.length, source: vitals.source },
    }));
  }

  // hreflang (only when the site uses it).
  {
    const withHl = v3.filter((p) => (p.extracted!.hreflang?.length ?? 0) > 0);
    if (withHl.length) {
      const crawled = new Map(ok.map((p) => [keyOf(urlOf(p)), p]));
      const invalid: string[] = [];
      const noSelf: string[] = [];
      const noReturn: string[] = [];
      for (const p of withHl) {
        const me = keyOf(urlOf(p));
        const hl = p.extracted!.hreflang!;
        if (hl.some((h) => !HREFLANG_RE.test(h.lang))) invalid.push(urlOf(p));
        if (!hl.some((h) => keyOf(h.href) === me)) noSelf.push(urlOf(p));
        for (const h of hl) {
          const other = crawled.get(keyOf(h.href));
          if (!other || keyOf(h.href) === me || !isV3(other)) continue;
          if (!(other.extracted!.hreflang ?? []).some((b) => keyOf(b.href) === me)) {
            noReturn.push(urlOf(p));
            break;
          }
        }
      }
      const bad = new Set([...invalid, ...noSelf, ...noReturn]);
      const parts = [
        invalid.length ? `${plural(invalid.length, "page")} use${invalid.length === 1 ? "s" : ""} a language code Google doesn't recognise` : "",
        noSelf.length ? `${plural(noSelf.length, "page")} ${noSelf.length === 1 ? "doesn't" : "don't"} list ${noSelf.length === 1 ? "itself" : "themselves"}` : "",
        noReturn.length ? `${plural(noReturn.length, "page")} point${noReturn.length === 1 ? "s" : ""} to a language version that doesn't point back` : "",
      ].filter(Boolean);
      out.push(makeCheck(P, "seo.hreflang", "Language versions (hreflang)", 1, {
        score: ratioScore(bad.size, withHl.length),
        detail: parts.length ? `Of ${withHl.length} pages with language versions, ${parts.join("; ")}.` : `All ${withHl.length} pages with language versions are set up correctly.`,
        affected: Array.from(bad),
        facts: { total: withHl.length, invalid: invalid.length, noSelf: noSelf.length, noReturn: noReturn.length },
      }));
    }
  }

  // Mixed content (http resources on https pages).
  {
    const https = v3.filter((p) => urlOf(p).startsWith("https:"));
    if (https.length) {
      const mixed = https.filter((p) => (p.extracted!.mixedContentCount ?? 0) > 0);
      const active = mixed.filter((p) => (p.extracted!.mixedContent ?? []).some((m) => m.active));
      const ex = mixed[0]?.extracted!.mixedContent?.[0]?.url;
      out.push(makeCheck(P, "seo.mixed_content", "Insecure files on secure pages", 1, {
        score: ratioScore(mixed.length + active.length, https.length),
        detail: mixed.length
          ? `${plural(mixed.length, "page")} load${mixed.length === 1 ? "s" : ""} pictures, scripts or styles over an insecure (http://) address${active.length ? `; on ${plural(active.length, "page")} browsers may block them` : ""}.`
          : "No secure page loads files over an insecure address.",
        affected: mixed.map(urlOf),
        evidence: ex ? `Example: ${ex}` : undefined,
        facts: { mixed: mixed.length, active: active.length, total: https.length },
      }));
    }
  }

  // Images without width/height (layout shift).
  {
    const withImages = v3.filter((p) => p.extracted!.images.length > 0);
    if (withImages.length) {
      const missing = withImages.filter((p) => (p.extracted!.imagesMissingSize ?? 0) > 0);
      const count = missing.reduce((a, p) => a + (p.extracted!.imagesMissingSize ?? 0), 0);
      out.push(makeCheck(P, "seo.image_dimensions", "Image sizes set in the page", 0.5, {
        score: ratioScore(missing.length * 0.6, withImages.length),
        detail: missing.length
          ? `${plural(count, "image")} on ${plural(missing.length, "page")} ${count === 1 ? "has" : "have"} no width and height set, so the page can jump around while it loads.`
          : "Every image has its width and height set.",
        affected: missing.map(urlOf),
        facts: { pages: missing.length, images: count, total: withImages.length },
      }));
    }
  }

  // Large image files (post-crawl probes).
  {
    const images = (ctx.depth?.probes ?? []).filter((r) => r.kind === "image" && r.bytes !== null);
    if (ctx.depth?.probed && images.length) {
      const big = images.filter((r) => (r.bytes ?? 0) > LARGE_IMAGE_BYTES);
      const biggest = [...big].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))[0];
      out.push(makeCheck(P, "seo.large_images", "Image file sizes", 1, {
        score: ratioScore(big.length, images.length),
        detail: big.length
          ? `${big.length} of ${images.length} images we measured are over ${LARGE_IMAGE_BYTES / 1024} KB, which slows pages down on phones.`
          : `All ${images.length} images we measured are under ${LARGE_IMAGE_BYTES / 1024} KB.`,
        affected: Array.from(new Set(big.flatMap((r) => r.pages))),
        evidence: biggest ? `Largest: ${biggest.url} (${biggest.bytesAtLeast ? "at least " : ""}${Math.round((biggest.bytes ?? 0) / 1024)} KB)` : undefined,
        facts: { large: big.length, total: images.length },
      }));
    }
  }

  // Internal links that point at a redirecting address.
  {
    const links = (ctx.depth?.probes ?? []).filter((r) => r.kind === "link" && r.status !== null);
    if (ctx.depth?.probed && links.length) {
      const redirecting = links.filter((r) => r.hops > 0 && r.status! < 400);
      out.push(makeCheck(P, "seo.redirecting_links", "Links that go straight to the page", 0.5, {
        score: ratioScore(redirecting.length, links.length),
        detail: redirecting.length
          ? `${plural(redirecting.length, "link")} inside your site point${redirecting.length === 1 ? "s" : ""} to an old address that forwards to a new one.`
          : "Your internal links point straight to the final page addresses.",
        affected: Array.from(new Set(redirecting.flatMap((r) => r.pages))),
        evidence: redirecting[0] ? `Example: ${redirecting[0].url} → ${redirecting[0].finalUrl ?? "?"}` : undefined,
        facts: { redirecting: redirecting.length, total: links.length },
      }));
    }
  }

  // Canonical tags that point at an error or a redirect.
  {
    const canon = (ctx.depth?.probes ?? []).filter((r) => r.kind === "canonical");
    if (ctx.depth?.probed && canon.length) {
      const bad = canon.filter((r) => r.status === null || r.status >= 400 || r.hops > 0);
      out.push(makeCheck(P, "seo.canonical_target", "Main-version tags point to a working page", 1, {
        score: ratioScore(bad.length * 2, canon.length),
        detail: bad.length
          ? `${plural(bad.length, "main-version (canonical) tag")} point${bad.length === 1 ? "s" : ""} to an address that forwards or doesn't load.`
          : "Every main-version (canonical) tag we checked points to a working page.",
        affected: Array.from(new Set(bad.flatMap((r) => r.pages))),
        evidence: bad[0] ? `Example: ${bad[0].url} (${bad[0].status === null ? "didn't load" : bad[0].hops > 0 ? "forwards" : `error ${bad[0].status}`})` : undefined,
        facts: { bad: bad.length, total: canon.length },
      }));
    }
  }

  // noindex pages listed in the sitemap.
  {
    const list = ctx.depth?.sitemapNoindex;
    if (list) {
      out.push(makeCheck(P, "seo.sitemap_noindex", "Page list only has pages for Google", 0.5, {
        score: list.length ? Math.max(40, 80 - list.length * 10) : 100,
        detail: list.length
          ? `${plural(list.length, "page")} in your page list (sitemap) ${list.length === 1 ? "is" : "are"} also marked "don't show on Google" — a mixed message.`
          : "Your page list (sitemap) doesn't include pages hidden from Google.",
        affected: list,
        facts: { conflicts: list.length },
      }));
    }
  }

  // Deep pages (more than DEEP_CLICKS clicks from the homepage).
  if (ok.length >= 10) {
    const home = findHome(ctx);
    const depths = clickDepths(ctx.pages, home ? urlOf(home) : null);
    if (depths.size >= 5) {
      const reachable = q.filter((p) => depths.has(keyOf(urlOf(p))) && !isHomeUrl(urlOf(p)));
      const deep = reachable.filter((p) => depths.get(keyOf(urlOf(p)))! > DEEP_CLICKS);
      const deepest = deep.reduce((m, p) => Math.max(m, depths.get(keyOf(urlOf(p)))!), 0);
      out.push(makeCheck(P, "seo.click_depth", "Pages easy to reach from the homepage", 1, {
        score: ratioScore(deep.length, Math.max(reachable.length, 1)),
        detail: deep.length
          ? `${plural(deep.length, "page")} need${deep.length === 1 ? "s" : ""} more than ${DEEP_CLICKS} clicks from your homepage (deepest: ${deepest} clicks).`
          : `Every page we checked is within ${DEEP_CLICKS} clicks of your homepage.`,
        affected: deep.map(urlOf),
        facts: { deep: deep.length, total: reachable.length, deepest },
      }));
    }
  }

  // Missing page language.
  {
    const missing = q.filter((p) => !p.extracted!.lang?.trim());
    out.push(makeCheck(P, "seo.lang_attribute", "Page language set", 0.5, {
      score: ratioScore(missing.length, q.length),
      detail: missing.length
        ? `${plural(missing.length, "page")} ${missing.length === 1 ? "doesn't" : "don't"} say which language ${missing.length === 1 ? "it's" : "they're"} written in.`
        : `All ${q.length} pages say which language they're written in.`,
      affected: missing.map(urlOf),
      facts: { missing: missing.length, total: q.length },
    }));
  }

  // Vague link text ("click here", "read more").
  if (v3.length) {
    const vague = v3.filter((p) => (p.extracted!.vagueLinkCount ?? 0) > 0);
    const count = vague.reduce((a, p) => a + (p.extracted!.vagueLinkCount ?? 0), 0);
    const ex = vague[0]?.extracted!.vagueLinkExamples?.[0];
    out.push(makeCheck(P, "seo.link_text", "Links that say where they go", 0.5, {
      score: ratioScore(vague.length * 0.5, v3.length),
      detail: count
        ? `${plural(count, "link")} on ${plural(vague.length, "page")} use${count === 1 ? "s" : ""} words like "click here" or "read more" that don't say where the link goes.`
        : "Your links describe where they go.",
      affected: vague.map(urlOf),
      evidence: ex ? `Example: "${ex}"` : undefined,
      facts: { links: count, pages: vague.length, total: v3.length },
    }));
  }

  return out;
}
