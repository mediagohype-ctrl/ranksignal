// Meta title & description checker (free tool): pure analysis of one page's HTML. No network, no DB.
// Lengths follow the site audit limits in src/lib/audit/rules.ts so the tool and the full report agree.
import * as cheerio from "cheerio";
import { extractPage } from "@/lib/crawler/extract";
import { normalizeUrl } from "@/lib/crawler/normalize";
import { DESCRIPTION_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/audit/rules";

export type ToolStatus = "pass" | "warn" | "fail";

export interface ToolCheck {
  id: string;
  label: string;
  status: ToolStatus;
  /** What we found, in plain words. */
  detail: string;
  /** What to do about it (absent when it passed). */
  fix?: string;
}

/** A title under this many characters usually wastes space Google would show (warn, not fail). */
export const TITLE_SHORT = 30;
/** A summary under this many characters usually says too little to earn the click. */
export const DESCRIPTION_SHORT = 70;
/** Rough cut-off for the preview snippets (Google trims by pixel width, about 50–60 title characters). */
const PREVIEW_TITLE_CHARS = TITLE_MAX;
const PREVIEW_DESCRIPTION_CHARS = DESCRIPTION_MAX;

export type TitleVerdict = "missing" | "too_short" | "short" | "good" | "too_long";
export type DescriptionVerdict = "missing" | "short" | "good" | "too_long";

export interface MetaTagReport {
  title: { text: string | null; length: number; verdict: TitleVerdict; count: number };
  description: { text: string | null; length: number; verdict: DescriptionVerdict; count: number };
  canonical: { href: string | null; count: number; pointsElsewhere: boolean };
  robots: { content: string | null; noindex: boolean; nofollow: boolean };
  openGraph: { title: string | null; description: string | null; image: string | null; siteName: string | null };
  twitter: { card: string | null; title: string | null; description: string | null; image: string | null };
  preview: {
    /** Google-style result: trimmed title, display URL and summary. */
    search: { title: string; displayUrl: string; description: string; descriptionIsGuess: boolean };
    /** Social share card: what most apps build from Open Graph tags (falling back to title/description). */
    share: { title: string; description: string; image: string | null; domain: string };
  };
  checks: ToolCheck[];
  summary: Record<ToolStatus, number>;
}

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function titleVerdict(title: string | null): TitleVerdict {
  if (!title) return "missing";
  if (title.length < TITLE_MIN) return "too_short";
  if (title.length < TITLE_SHORT) return "short";
  if (title.length > TITLE_MAX) return "too_long";
  return "good";
}

export function descriptionVerdict(description: string | null): DescriptionVerdict {
  if (!description) return "missing";
  if (description.length < DESCRIPTION_SHORT) return "short";
  if (description.length > DESCRIPTION_MAX) return "too_long";
  return "good";
}

function displayUrl(u: string): string {
  try {
    const url = new URL(u);
    const parts = url.pathname.split("/").filter(Boolean).map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
    return [url.hostname.replace(/^www\./, ""), ...parts].join(" › ").slice(0, 120);
  } catch {
    return u.slice(0, 120);
  }
}

function sameUrl(a: string, b: string): boolean {
  const na = normalizeUrl(a, undefined, { trailingSlash: "strip" }) ?? a;
  const nb = normalizeUrl(b, undefined, { trailingSlash: "strip" }) ?? b;
  return na === nb;
}

/** Analyse one page's title, description, canonical, robots, Open Graph and Twitter/X tags. */
export function analyzeMetaTags(html: string, pageUrl: string): MetaTagReport {
  let host = "";
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    /* keep empty */
  }
  const x = extractPage(html, pageUrl, host ? [host] : []);

  // Tag counts (duplicates) — extractPage keeps only the first of each, so count them here.
  const $ = cheerio.load(html);
  const titleCount = $("title").filter((_, el) => $(el).closest("svg").length === 0).length;
  const metaCount = (attr: "name" | "property", name: string) =>
    $(`meta[${attr}]`).filter((_, el) => ($(el).attr(attr) ?? "").toLowerCase() === name).length;
  const metaValue = (name: string): string | null => {
    let v: string | null = null;
    $("meta").each((_, el) => {
      if (v !== null) return;
      const key = ($(el).attr("name") ?? $(el).attr("property") ?? "").toLowerCase();
      if (key === name) v = clean($(el).attr("content")) || null;
    });
    return v;
  };
  const descriptionCount = metaCount("name", "description");
  const canonicalCount = $("link[rel]").filter((_, el) => ($(el).attr("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")).length;
  const robotsValues = $("meta[name]")
    .filter((_, el) => ["robots", "googlebot"].includes(($(el).attr("name") ?? "").toLowerCase()))
    .map((_, el) => clean($(el).attr("content")).toLowerCase())
    .get()
    .filter(Boolean);
  const robotsContent = robotsValues.length ? robotsValues.join(", ") : (x.robotsMeta ?? null);
  const noindex = /\b(noindex|none)\b/.test(robotsContent ?? "");
  const nofollow = /\b(nofollow|none)\b/.test(robotsContent ?? "");

  const title = x.title;
  const description = x.description;
  const tVerdict = titleVerdict(title);
  const dVerdict = descriptionVerdict(description);
  const og = x.openGraph ?? { title: null, description: null, image: null, type: null, siteName: null };
  const tw = { card: x.twitter?.card ?? null, title: x.twitter?.title ?? null, description: metaValue("twitter:description"), image: x.twitter?.image ?? null };
  const canonical = x.canonical;
  const pointsElsewhere = !!canonical && !sameUrl(canonical, pageUrl);

  const checks: ToolCheck[] = [];
  const add = (c: ToolCheck) => checks.push(c);

  // Title
  if (tVerdict === "missing") {
    add({ id: "title", label: "Page title", status: "fail", detail: "This page has no <title> tag, so Google has to make up a headline for it.",
      fix: `Add a <title> of about ${TITLE_SHORT}–${TITLE_MAX} characters that says what the page offers, for example "Plumber in Pune – 24-hour repairs | Sharma Plumbing".` });
  } else if (tVerdict === "too_short") {
    add({ id: "title", label: "Page title", status: "fail", detail: `The title is only ${title!.length} characters ("${truncate(title!, 40)}"). That is too short to say what the page is about.`,
      fix: `Write a title of ${TITLE_SHORT}–${TITLE_MAX} characters: the main service or product, the place if it matters, then your brand.` });
  } else if (tVerdict === "short") {
    add({ id: "title", label: "Page title", status: "warn", detail: `The title is ${title!.length} characters. It works, but you have room to say more.`,
      fix: `Add a detail people search for, such as your town or the main benefit, to reach ${TITLE_SHORT}–${TITLE_MAX} characters.` });
  } else if (tVerdict === "too_long") {
    add({ id: "title", label: "Page title", status: "warn", detail: `The title is ${title!.length} characters. Google usually shows about 50–60, so the end may be cut off.`,
      fix: `Put the most important words first and trim it to ${TITLE_MAX} characters or fewer.` });
  } else {
    add({ id: "title", label: "Page title", status: "pass", detail: `The title is ${title!.length} characters, a good length (${TITLE_SHORT}–${TITLE_MAX}).` });
  }
  if (titleCount > 1) {
    add({ id: "title-duplicate", label: "Only one title tag", status: "warn", detail: `The page has ${titleCount} <title> tags. Browsers and Google use only one, and it may not be the one you want.`,
      fix: "Remove the extra <title> tags. This often happens when a theme and an SEO plugin both add one." });
  }

  // Description
  if (dVerdict === "missing") {
    add({ id: "description", label: "Meta description", status: "fail", detail: "This page has no meta description, so Google picks text from the page for the summary under your link.",
      fix: `Add <meta name="description" content="..."> with ${DESCRIPTION_SHORT}–${DESCRIPTION_MAX} characters: what you offer, who it is for and one reason to click.` });
  } else if (dVerdict === "short") {
    add({ id: "description", label: "Meta description", status: "warn", detail: `The description is only ${description!.length} characters, which gives searchers little reason to click.`,
      fix: `Expand it to ${DESCRIPTION_SHORT}–${DESCRIPTION_MAX} characters with a concrete detail, such as a price, area served or opening hours.` });
  } else if (dVerdict === "too_long") {
    add({ id: "description", label: "Meta description", status: "warn", detail: `The description is ${description!.length} characters, so Google will probably cut it off.`,
      fix: `Keep the key message in the first ${DESCRIPTION_MAX} characters, or trim it to that length.` });
  } else {
    add({ id: "description", label: "Meta description", status: "pass", detail: `The description is ${description!.length} characters, a good length.` });
  }
  if (descriptionCount > 1) {
    add({ id: "description-duplicate", label: "Only one meta description", status: "warn", detail: `The page has ${descriptionCount} meta description tags. Google may use either one, or neither.`,
      fix: "Keep one meta description and delete the others (check your theme and SEO plugin settings)." });
  }

  // Canonical
  if (canonicalCount === 0) {
    add({ id: "canonical", label: "Canonical link", status: "warn", detail: "No canonical link was found, so Google decides on its own which address is the main one.",
      fix: `Add <link rel="canonical" href="${truncate(pageUrl, 80)}"> to the page's <head>, pointing at the address you want in search.` });
  } else if (canonicalCount > 1) {
    add({ id: "canonical", label: "Canonical link", status: "warn", detail: `The page has ${canonicalCount} canonical links. When they conflict, Google may ignore all of them.`,
      fix: "Keep exactly one canonical link in the <head>." });
  } else if (pointsElsewhere) {
    add({ id: "canonical", label: "Canonical link", status: "warn", detail: `The canonical link points to a different address (${truncate(canonical!, 80)}). Google will usually show that address instead of this one.`,
      fix: "That is fine if this page is a copy. If this page should appear in search itself, point the canonical at this page's own address." });
  } else {
    add({ id: "canonical", label: "Canonical link", status: "pass", detail: "The canonical link points to this page." });
  }

  // Robots
  if (noindex) {
    add({ id: "robots", label: "Allowed in search results", status: "fail", detail: `The robots meta tag says "${truncate(robotsContent ?? "", 80)}". This tells Google not to show this page in search results.`,
      fix: "If you want this page found, remove noindex from the robots meta tag (in WordPress, check the SEO plugin's settings for this page)." });
  } else if (nofollow) {
    add({ id: "robots", label: "Allowed in search results", status: "warn", detail: `The robots meta tag says "${truncate(robotsContent ?? "", 80)}". Search engines won't follow the links on this page.`,
      fix: "Remove nofollow unless you have a specific reason to keep it." });
  } else {
    add({ id: "robots", label: "Allowed in search results", status: "pass", detail: robotsContent ? `The robots meta tag ("${truncate(robotsContent, 60)}") allows indexing.` : "No robots meta tag blocks this page from search results." });
  }

  // Open Graph
  const ogMissing = [!og.title && "og:title", !og.description && "og:description", !og.image && "og:image"].filter(Boolean) as string[];
  if (ogMissing.length === 0) {
    add({ id: "open-graph", label: "Share preview (Open Graph)", status: "pass", detail: "og:title, og:description and og:image are all set, so shared links get a proper card." });
  } else {
    add({ id: "open-graph", label: "Share preview (Open Graph)", status: "warn",
      detail: `Missing: ${ogMissing.join(", ")}. When someone shares this page on WhatsApp, Facebook or LinkedIn, the preview may be plain or pick a random image.`,
      fix: `Add the missing tags to the <head>, for example <meta property="og:image" content="https://.../share.jpg">. An image of 1200 × 630 pixels works on most apps.` });
  }

  // Twitter / X
  if (tw.card) {
    add({ id: "twitter", label: "X (Twitter) card", status: "pass", detail: `twitter:card is "${truncate(tw.card, 40)}".` });
  } else {
    add({ id: "twitter", label: "X (Twitter) card", status: "warn", detail: "No twitter:card tag. X uses it to choose the card layout, so links may show as a small card.",
      fix: `Add <meta name="twitter:card" content="summary_large_image">. X reads your Open Graph title, description and image when the twitter: versions are missing.` });
  }

  const shareTitle = og.title ?? tw.title ?? title ?? displayUrl(pageUrl);
  const shareDescription = og.description ?? tw.description ?? description ?? "";
  const summary: Record<ToolStatus, number> = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;

  return {
    title: { text: title, length: title?.length ?? 0, verdict: tVerdict, count: titleCount },
    description: { text: description, length: description?.length ?? 0, verdict: dVerdict, count: descriptionCount },
    canonical: { href: canonical, count: canonicalCount, pointsElsewhere },
    robots: { content: robotsContent, noindex, nofollow },
    openGraph: { title: og.title, description: og.description, image: og.image, siteName: og.siteName },
    twitter: tw,
    preview: {
      search: {
        title: truncate(title ?? displayUrl(pageUrl), PREVIEW_TITLE_CHARS),
        displayUrl: displayUrl(pageUrl),
        description: truncate(description ?? clean(x.textSample).slice(0, 300), PREVIEW_DESCRIPTION_CHARS),
        descriptionIsGuess: !description,
      },
      share: { title: truncate(shareTitle, 90), description: truncate(shareDescription, 200), image: og.image ?? tw.image, domain: host.replace(/^www\./, "") },
    },
    checks,
    summary,
  };
}
