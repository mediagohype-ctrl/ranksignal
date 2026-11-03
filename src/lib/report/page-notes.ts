// One plain sentence per affected page: what we actually found on THAT page for a given check, so an owner can
// see the problem page by page ("0 words", "No Google summary"). Pure: reads stored crawl data only.
import type { ExtractedPage } from "@/lib/types";
import { DESCRIPTION_MAX, THIN_WORDS, TITLE_MAX, TITLE_MIN } from "@/lib/audit/rules";

export interface NotePage {
  statusCode: number | null;
  redirectChain: string[];
  responseBytes: number | null;
  extracted: ExtractedPage | null;
  error: string | null;
}

const clip = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const quote = (s: string) => `“${clip(s)}”`;
const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

const NO_TEXT =
  "We found no text. This page may only show its words after JavaScript runs, so Google and AI tools can see an empty page.";

type Note = (x: ExtractedPage, p: NotePage, dup: (v: string | null | undefined) => boolean) => string | null;

const NOTES: Record<string, Note> = {
  "seo.thin_content": (x) => (x.wordCount === 0 ? NO_TEXT : `Only ${n(x.wordCount, "word")} (aim for at least ${THIN_WORDS}).`),
  "aeo.content_depth": (x) => {
    const w = x.contentWordCount ?? x.wordCount;
    return w === 0 ? NO_TEXT : `Only ${n(w, "word")} of main text.`;
  },
  "seo.titles": (x, _p, dup) => {
    const t = x.title?.trim();
    if (!t) return "No Google headline.";
    if (t.length > TITLE_MAX) return `Too long (${t.length} characters, Google cuts it after about ${TITLE_MAX}): ${quote(t)}`;
    if (t.length < TITLE_MIN) return `Too short: ${quote(t)}`;
    return dup(t) ? `Same Google headline as another page: ${quote(t)}` : `Google headline: ${quote(t)}`;
  },
  "seo.meta_description": (x, _p, dup) => {
    const d = x.description?.trim();
    if (!d) return "No Google summary.";
    if (d.length > DESCRIPTION_MAX) return `Too long (${d.length} characters, Google cuts it after about ${DESCRIPTION_MAX}).`;
    return dup(d) ? `Same Google summary as another page: ${quote(d)}` : `Google summary: ${quote(d)}`;
  },
  "seo.h1": (x) =>
    x.h1.length === 0 ? "No main heading." : x.h1.length > 1 ? `${x.h1.length} main headings: ${x.h1.slice(0, 3).map(quote).join(", ")}` : null,
  "seo.canonical": (x) =>
    !x.canonical ? "Doesn't say which version of the page is the main one." : `Says the main version is on another website: ${clip(x.canonical)}`,
  "seo.indexability": (x, p) =>
    /noindex/i.test(x.robotsMeta ?? "") ? "Set to stay hidden from Google." : p.statusCode && p.statusCode >= 400 ? `Shows an error (code ${p.statusCode}).` : null,
  "seo.redirects": (_x, p) => (p.redirectChain.length ? `Sends visitors through ${n(p.redirectChain.length, "redirect")} before it loads.` : null),
  "seo.internal_links": () => "No other page on your website links here, so it's hard to find.",
  "seo.broken_links": () => "Has a link to one of your pages that doesn't work.",
  "seo.image_alt": (x) => {
    const missing = x.images.filter((i) => !i.alt?.trim()).length;
    return missing ? `${missing} of ${n(x.images.length, "image")} have no image description.` : null;
  },
  "seo.duplicate_content": () => "Its text is the same, or almost the same, as another page.",
  "seo.mobile_viewport": () => "No mobile setting, so phones may show it tiny or zoomed out.",
  "seo.page_speed_proxy": (_x, p) => (p.responseBytes ? `Page is ${Math.round(p.responseBytes / 1024)} KB, which is heavy to load.` : null),
  "seo.open_graph": (x) => {
    const miss = [!x.openGraph?.title && "title", !x.openGraph?.image && "picture"].filter(Boolean);
    return miss.length ? `Share preview has no ${miss.join(" or ")}.` : null;
  },
  "aeo.question_headings": () => "No headings written as questions customers ask.",
  "aeo.direct_answers": (x) => {
    const q = x.questionHeadings?.length ?? 0;
    return q ? `${n(q, "question heading")}, ${x.questionsWithConciseAnswer ?? 0} with a short, direct answer under it.` : "No questions answered directly.";
  },
  "aeo.lists_tables": () => "No lists or tables. Everything is in long paragraphs.",
  "aeo.readability": (x) => (typeof x.readingEase === "number" ? `Hard to read (reading score ${Math.round(x.readingEase)} out of 100; aim for 50 or more).` : null),
  "aeo.structured_data": (x) =>
    x.schemaTypes.length ? `Has info for Google and AI (${x.schemaTypes.slice(0, 3).join(", ")}), but some of it is broken or incomplete.` : "No info for Google and AI on this page.",
  "aeo.faq_schema": () => "Has questions and answers, but they aren't marked so Google and AI can spot them.",
  "geo.quotable_facts": (x) => `${n(x.statSentenceCount ?? 0, "sentence")} with a fact or number (aim for 2 or more).`,
  "geo.cited_sources": () => "Doesn't link to any trusted source (government, research, news).",
  "geo.freshness": (x) => {
    const d = x.dateModified ?? x.datePublished;
    return d ? `Last updated ${d.slice(0, 10)}, more than a year ago.` : "No date shown, so AI tools can't tell if it's up to date.";
  },
  "geo.author_signals": () => "No author named.",
  "brand.name_consistency": (x) => (x.title ? `Your business name isn't in the Google headline: ${quote(x.title)}` : "Your business name isn't in the Google headline."),
};

/** Builds a note function for one check over its affected pages (needed to spot duplicates among them). */
export function pageNotesFor(checkId: string, pages: NotePage[]): (p: NotePage) => string | null {
  const note = NOTES[checkId];
  const counts = new Map<string, number>();
  const key = (v: string | null | undefined) => v?.trim().toLowerCase() ?? "";
  if (checkId === "seo.titles" || checkId === "seo.meta_description") {
    for (const p of pages) {
      const k = key(checkId === "seo.titles" ? p.extracted?.title : p.extracted?.description);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const dup = (v: string | null | undefined) => (counts.get(key(v)) ?? 0) > 1;
  return (p) => {
    if (p.error || (p.statusCode !== null && p.statusCode >= 400 && checkId !== "seo.indexability")) {
      return `We couldn't open this page${p.statusCode ? ` (error code ${p.statusCode})` : ""}.`;
    }
    if (!note || !p.extracted) return null;
    return note(p.extracted, p, dup);
  };
}

/** Report issue id → check id ("seo-thin_content" → "seo.thin_content"); null for audit-finding issues. */
export function checkIdOfIssue(issueId: string): string | null {
  if (issueId.startsWith("finding-")) return null;
  const i = issueId.indexOf("-");
  return i > 0 ? `${issueId.slice(0, i)}.${issueId.slice(i + 1).replace(/-/g, ".")}` : null;
}

/** Report issue id → audit finding code ("finding-no-llms-txt" → "no_llms_txt"). */
export function findingCodeOfIssue(issueId: string): string | null {
  return issueId.startsWith("finding-") ? issueId.slice("finding-".length).replace(/-/g, "_") : null;
}
