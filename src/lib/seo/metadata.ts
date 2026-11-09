// Page metadata for our own marketing site: one shape for title, description, canonical, Open Graph and Twitter.
// Pages that set `openGraph` replace the layout's, which drops the file-based og:image — so the image is always
// set explicitly here.
import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { PAGE_SEO, type PageSeo, type StaticPath } from "./pages";

/** What the root layout's title template appends. */
export const TITLE_SUFFIX = ` · ${BRAND.name}`;
/** Longest full title Google shows without cutting it off (roughly). */
export const TITLE_MAX = 60;

export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${BRAND.name} — ${BRAND.tagline}` };

type OgImage = { url: string; width?: number; height?: number; alt?: string };

const CONNECTORS = /\s+(and|or|the|to|for|with|of|a|an|in|on|by|&|vs|—|-|–|:|,)$/i;

/** Cut `s` to at most `max` characters at a word boundary, without a dangling connector word or punctuation. */
function cutAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = s.slice(0, max + 1);
  const space = out.lastIndexOf(" ");
  out = space > 0 ? out.slice(0, space) : s.slice(0, max);
  out = out.replace(/[\s,:;—–\-|(]+$/, "");
  while (CONNECTORS.test(out)) out = out.replace(CONNECTORS, "");
  return out.replace(/[\s,:;—–\-|(]+$/, "");
}

/**
 * Fit a page title so the rendered <title> is at most 60 characters:
 * keep the " · MyWebRank" suffix when it fits, else drop it, else shorten the title smartly
 * (drop a trailing "(…)", keep the part before a ":" / "—" / "|" if long enough, else cut at a word).
 */
export function fitTitle(raw: string): { title: Metadata["title"]; full: string } {
  const t = raw.replace(/\s+/g, " ").trim();
  const done = (s: string) =>
    (s + TITLE_SUFFIX).length <= TITLE_MAX ? { title: s, full: s + TITLE_SUFFIX } : { title: { absolute: s }, full: s };
  if (t.length <= TITLE_MAX) return done(t);
  const noParen = t.replace(/\s*\([^)]*\)\s*$/, "");
  if (noParen.length <= TITLE_MAX && noParen.length >= 30) return done(noParen);
  const head = noParen.split(/\s*(?::|—|–|\|)\s+/)[0];
  if (head.length <= TITLE_MAX && head.length >= 30) return done(head);
  return done(cutAtWord(noParen, TITLE_MAX));
}

/** Longest meta description we emit; Google cuts snippets at roughly 155–160 characters. */
export const DESCRIPTION_MAX = 155;

/** Keep a (database or article) description within DESCRIPTION_MAX: whole sentences first, else cut at a word + "…". */
export function fitDescription(raw: string): string {
  const d = raw.replace(/\s+/g, " ").trim();
  if (d.length <= DESCRIPTION_MAX) return d;
  const sentences = d.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > DESCRIPTION_MAX) break;
    out += s;
  }
  if (out.trim().length >= 100) return out.trim();
  return `${cutAtWord(d, DESCRIPTION_MAX - 1)}…`;
}

export interface PageMetadataInput {
  title: string;
  description: string;
  /** Site-relative path, used for the canonical URL and og:url. */
  path: string;
  /** Render `title` exactly as given (no suffix, no shortening). */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  /** ISO dates; only emitted for `type: "article"` (Open Graph has no times for websites). */
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  /** Defaults to the site's /opengraph-image card. */
  images?: OgImage[];
  keywords?: string[];
  robots?: Metadata["robots"];
}

export function pageMetadata(o: PageMetadataInput): Metadata {
  const fitted = o.absoluteTitle ? { title: { absolute: o.title }, full: o.title } : fitTitle(o.title);
  const images = o.images?.length ? o.images : [OG_IMAGE];
  const base = { title: fitted.full, description: o.description, url: o.path, siteName: BRAND.name, locale: "en_IN", images };
  return {
    title: fitted.title,
    description: o.description,
    ...(o.keywords?.length ? { keywords: o.keywords } : {}),
    alternates: { canonical: o.path },
    ...(o.robots ? { robots: o.robots } : {}),
    openGraph:
      o.type === "article"
        ? {
            ...base,
            type: "article",
            ...(o.publishedTime ? { publishedTime: o.publishedTime } : {}),
            ...(o.modifiedTime ? { modifiedTime: o.modifiedTime } : {}),
            ...(o.authors?.length ? { authors: o.authors } : {}),
          }
        : { ...base, type: "website" },
    twitter: { card: "summary_large_image", title: fitted.full, description: o.description, images: images.map((i) => i.url) },
  };
}

/** Metadata for a page listed in PAGE_SEO (src/lib/seo/pages.ts). Auth pages come back noindex. */
export function staticPageMetadata(path: StaticPath, extra: Partial<PageMetadataInput> = {}): Metadata {
  const p: PageSeo = PAGE_SEO[path];
  return pageMetadata({
    title: p.title,
    description: p.description,
    path,
    absoluteTitle: p.absolute,
    ...(p.noindex ? { robots: { index: false, follow: true } } : {}),
    ...extra,
  });
}

/** The full <title> a PAGE_SEO entry renders to (for tests and audits). */
export function renderedTitle(p: Pick<PageSeo, "title" | "absolute">): string {
  return p.absolute ? p.title : fitTitle(p.title).full;
}
