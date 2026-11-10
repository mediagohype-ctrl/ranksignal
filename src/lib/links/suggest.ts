// Internal link suggestions (pure, no I/O). Built from one finished crawl's pages:
//  1. Count how many distinct crawled pages link to each page ("links in").
//  2. Pages with 0–1 links in are orphan / weakly linked — Google and AI crawlers find them hardest.
//  3. For each important target page, find source pages whose visible text already contains the target's
//     main topic words (from its title / H1) but that do not link to it yet, and suggest that exact phrase as
//     the link text. Sources are ranked by their own authority (links in) and topical overlap with the target.
// Utility pages (contact, legal, login, cart…), noindex pages and pages folded into another URL by a canonical
// are never suggested as a source or a target. Nothing here edits a website — these are suggestions only.
import type { AuditPage } from "@/lib/audit/rules";
import type { ExtractedPage } from "@/lib/types";
import { isHomeUrl, isKeyPageUrl, isUtilityUrl } from "@/lib/audit/page-kind";
import { isConsolidated } from "@/lib/report/inputs";
import { urlKey } from "@/lib/crawler/normalize";

export type LinkExtract = Pick<ExtractedPage, "internalLinks" | "headings" | "title" | "textSample" | "wordCount"> &
  Partial<Pick<ExtractedPage, "h1" | "canonical" | "robotsMeta">>;

export interface LinkPage {
  url: string;
  finalUrl?: string | null;
  statusCode: number | null;
  contentType?: string | null;
  extracted: LinkExtract | null;
}

/** orphan = no other crawled page links to it; weak = exactly one does. */
export type LinkStrength = "orphan" | "weak" | "ok";

export interface LinkSnippet {
  before: string;
  match: string;
  after: string;
}

export interface LinkSuggestion {
  /** Stable id for this source→target pair (used for keys and to-do de-duplication). */
  id: string;
  sourceUrl: string;
  sourceLabel: string;
  /** Distinct crawled pages linking to the source page (its "authority" on your site). */
  sourceLinksIn: number;
  targetUrl: string;
  targetLabel: string;
  targetLinksIn: number;
  targetStrength: LinkStrength;
  /** The exact words found in the source page's text, to turn into the link. */
  anchor: string;
  snippet: LinkSnippet;
  /** 0–100: authority of the source + topic overlap + phrase quality. */
  score: number;
  /** Share (0–1) of the target's topic words that also appear on the source page. */
  overlap: number;
  /** Plain-English instruction. */
  sentence: string;
  /** Plain-English reason. */
  why: string;
}

export interface WeakPage {
  url: string;
  label: string;
  linksIn: number;
  strength: Exclude<LinkStrength, "ok">;
  suggestionCount: number;
}

export interface LinkReport {
  /** OK HTML pages we looked at (excluding utility / noindex / consolidated pages). */
  pagesAnalysed: number;
  orphanCount: number;
  weakCount: number;
  weakPages: WeakPage[];
  suggestions: LinkSuggestion[];
  targetsWithSuggestions: number;
  sourcesUsed: number;
}

export interface SuggestOptions {
  /** Brand names / aliases: removed from titles and never used as link words on their own. */
  brandNames?: string[];
  homepageUrl?: string;
  /** Suggestions kept per target page (best first). */
  perTarget?: number;
  /** Target pages considered (neediest first). */
  maxTargets?: number;
  maxSuggestions?: number;
}

const PER_TARGET = 3;
const MAX_TARGETS = 80;
const MAX_SUGGESTIONS = 300;
const MAX_PAGES = 1500;
const MIN_TARGET_WORDS = 80;
const SNIPPET_CHARS = 90;

const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have how i in into is it its of on or our so than that the their them then there " +
    "these they this to us was we what when where which who why will with you your yours my me can do does get got all any more " +
    "most not no nor only own same such too very just also about after before over under up down out off again here"
  ).split(" "),
);
/** Words that make a weak link on their own ("read more", "home page"). A phrase made only of these is skipped. */
const GENERIC = new Set(
  "home page welcome read more learn click here menu index untitled official website site online best top new latest info information details view see now today"
    .split(" "),
);

const WORD = /[\p{L}\p{N}]/u;
const isWordChar = (c: string | undefined) => !!c && WORD.test(c);

// ---------------------------------------------------------------------------------------------
// Small helpers

function okHtml(p: LinkPage): boolean {
  return p.statusCode === 200 && !!p.extracted && (!p.contentType || /html/i.test(p.contentType));
}

/** Scheme- and www-insensitive page key, so http/https and www variants count as one page. */
export function pageKey(u: string): string | null {
  const k = urlKey(u);
  return k ? k.replace(/^https?:\/\/(www\.)?/i, "").toLowerCase() : null;
}

function tokens(s: string): string[] {
  return s
    .split(/[^\p{L}\p{N}'’&+.-]+/u)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

const stem = (w: string) => {
  const l = w.toLowerCase();
  return l.length > 4 && l.endsWith("s") && !l.endsWith("ss") ? l.slice(0, -1) : l;
};

function contentWords(s: string): string[] {
  return tokens(s)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !GENERIC.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * The part of a page title that names the page (drops "| Brand" style suffixes/prefixes).
 * "Website SEO audit | Acme" → "Website SEO audit".
 */
export function titleTopic(title: string | null | undefined, brandNames: string[] = []): string {
  const t = norm(title ?? "");
  if (!t) return "";
  const brands = brandNames.map((b) => b.trim().toLowerCase()).filter((b) => b.length >= 2);
  const parts = t.split(/\s+[|–—·•:-]\s+|\s*[|·•]\s*/).map(norm).filter(Boolean);
  const notBrand = parts.filter((p) => {
    const l = p.toLowerCase();
    return !brands.some((b) => l === b || l === `${b}.com` || l.replace(/[^\p{L}\p{N}]/gu, "") === b.replace(/[^\p{L}\p{N}]/gu, ""));
  });
  const pick = notBrand[0] ?? parts[0] ?? t;
  return pick.slice(0, 120);
}

function pathLabel(url: string): string {
  try {
    const segs = new URL(url).pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(segs[segs.length - 1] ?? "").replace(/\.(html?|php|aspx?)$/i, "");
    const words = last.replace(/[-_+]+/g, " ").trim();
    if (!words) return "Home";
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch {
    return url;
  }
}

/** Short human name for a page: its title topic, else H1, else its address. */
export function pageLabel(p: LinkPage, brandNames: string[] = []): string {
  const url = p.finalUrl || p.url;
  if (isHomeUrl(url)) return "Home";
  const fromTitle = titleTopic(p.extracted?.title, brandNames);
  const h1 = norm(p.extracted?.h1?.[0] ?? p.extracted?.headings?.find((h) => h.level === 1)?.text ?? "");
  const label = fromTitle || h1 || pathLabel(url);
  return label.length > 70 ? `${label.slice(0, 67).trimEnd()}…` : label;
}

/**
 * Candidate link phrases for a target page, best first: 2–5 word runs from its title topic and H1 that
 * don't start/end on a filler word, aren't only generic words, and aren't just the brand name.
 */
export function topicPhrases(p: LinkPage, brandNames: string[] = []): string[] {
  const brands = new Set(brandNames.map((b) => b.trim().toLowerCase()).filter(Boolean));
  const brandTokens = new Set(brandNames.flatMap((b) => tokens(b.toLowerCase())));
  const sources = [
    titleTopic(p.extracted?.title, brandNames),
    norm(p.extracted?.h1?.[0] ?? p.extracted?.headings?.find((h) => h.level === 1)?.text ?? ""),
  ].filter(Boolean);
  const out: { phrase: string; words: number; order: number }[] = [];
  const seen = new Set<string>();
  let order = 0;
  for (const s of sources) {
    const toks = tokens(s).slice(0, 14);
    for (let n = Math.min(5, toks.length); n >= 2; n--) {
      for (let i = 0; i + n <= toks.length; i++) {
        const run = toks.slice(i, i + n);
        const lower = run.map((w) => w.toLowerCase());
        if (STOPWORDS.has(lower[0]) || STOPWORDS.has(lower[n - 1])) continue;
        if (lower.every((w) => GENERIC.has(w) || STOPWORDS.has(w) || /^\d+$/.test(w))) continue;
        if (lower.every((w) => brandTokens.has(w) || STOPWORDS.has(w))) continue;
        const phrase = lower.join(" ");
        if (brands.has(phrase) || phrase.length < 6 || seen.has(phrase)) continue;
        seen.add(phrase);
        out.push({ phrase, words: n, order: order++ });
      }
    }
  }
  return out.sort((a, b) => b.words - a.words || a.order - b.order).slice(0, 12).map((x) => x.phrase);
}

const PHRASE_RE = new Map<string, string>();

/** First whole-word, case-insensitive occurrence of `phrase` in `text` (whitespace-tolerant). */
export function findPhrase(text: string, phrase: string): { index: number; length: number } | null {
  if (!text || !phrase) return null;
  let src = PHRASE_RE.get(phrase);
  if (src === undefined) {
    src = phrase.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
    if (PHRASE_RE.size > 5000) PHRASE_RE.clear();
    PHRASE_RE.set(phrase, src);
  }
  const re = new RegExp(src, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text[m.index - 1];
    const after = text[m.index + m[0].length];
    if (!isWordChar(before) && !isWordChar(after)) return { index: m.index, length: m[0].length };
    re.lastIndex = m.index + 1;
  }
  return null;
}

/** ~SNIPPET_CHARS of context either side of the match, cut on word boundaries. */
export function snippetAround(text: string, index: number, length: number, chars = SNIPPET_CHARS): LinkSnippet {
  let start = Math.max(0, index - chars);
  let end = Math.min(text.length, index + length + chars);
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp !== -1 && sp < index) start = sp + 1;
  }
  if (end < text.length) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > index + length) end = sp;
  }
  return {
    before: `${start > 0 ? "…" : ""}${text.slice(start, index)}`,
    match: text.slice(index, index + length),
    after: `${text.slice(index + length, end)}${end < text.length ? "…" : ""}`,
  };
}

function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

const strengthOf = (n: number): LinkStrength => (n === 0 ? "orphan" : n === 1 ? "weak" : "ok");
const pagesWord = (n: number) => (n === 1 ? "1 page links" : `${n} pages link`);

// ---------------------------------------------------------------------------------------------
// Main

interface Node {
  key: string;
  page: LinkPage;
  url: string;
  label: string;
  /** Keys of distinct pages linking here. */
  inbound: Set<string>;
  outbound: Set<string>;
  eligible: boolean;
  home: boolean;
}

export function suggestInternalLinks(pages: LinkPage[], opts: SuggestOptions = {}): LinkReport {
  const brandNames = (opts.brandNames ?? []).filter((b) => typeof b === "string" && b.trim().length >= 2);
  const perTarget = opts.perTarget ?? PER_TARGET;
  const maxTargets = opts.maxTargets ?? MAX_TARGETS;
  const maxSuggestions = opts.maxSuggestions ?? MAX_SUGGESTIONS;
  const homeKey = opts.homepageUrl ? pageKey(opts.homepageUrl) : null;

  // Nodes: one per distinct OK HTML page; url + finalUrl (redirects) both resolve to it.
  const nodes = new Map<string, Node>();
  const alias = new Map<string, string>();
  for (const p of pages.slice(0, MAX_PAGES)) {
    if (!okHtml(p)) continue;
    const url = p.finalUrl || p.url;
    const key = pageKey(url);
    if (!key || nodes.has(key)) {
      const k2 = pageKey(p.url);
      if (key && k2 && !alias.has(k2)) alias.set(k2, key);
      continue;
    }
    let consolidated = false;
    try {
      consolidated = isConsolidated({ ...p, finalUrl: url, redirectChain: [], contentType: p.contentType ?? null } as unknown as AuditPage);
    } catch {
      consolidated = false;
    }
    const home = isHomeUrl(url) || (!!homeKey && key === homeKey);
    nodes.set(key, {
      key,
      page: p,
      url,
      label: pageLabel(p, brandNames),
      inbound: new Set(),
      outbound: new Set(),
      eligible: !consolidated && !isUtilityUrl(url),
      home,
    });
    alias.set(key, key);
    const k2 = pageKey(p.url);
    if (k2 && !alias.has(k2)) alias.set(k2, key);
  }

  // Link graph between crawled pages (distinct source pages only; self-links ignored).
  for (const n of nodes.values()) {
    for (const href of n.page.extracted?.internalLinks ?? []) {
      if (typeof href !== "string") continue;
      const raw = pageKey(href);
      const to = raw ? alias.get(raw) : undefined;
      if (!to || to === n.key) continue;
      n.outbound.add(to);
      nodes.get(to)!.inbound.add(n.key);
    }
  }

  const eligible = [...nodes.values()].filter((n) => n.eligible);
  const maxIn = Math.max(1, ...eligible.map((n) => n.inbound.size));
  const authority = (n: Node) => Math.log1p(n.inbound.size) / Math.log1p(maxIn);

  // Source text + vocabulary, computed once.
  const sourceText = new Map<string, string>();
  const sourceLower = new Map<string, string>();
  const sourceVocab = new Map<string, Set<string>>();
  for (const n of eligible) {
    const e = n.page.extracted!;
    const text = norm(typeof e.textSample === "string" ? e.textSample : "");
    sourceText.set(n.key, text);
    sourceLower.set(n.key, text.toLowerCase());
    const heads = (e.headings ?? []).map((h) => h.text).join(" ");
    sourceVocab.set(n.key, new Set(contentWords(`${e.title ?? ""} ${heads} ${text}`)));
  }

  // Targets: eligible non-home pages with real content (or key business pages), neediest first.
  const targets = eligible
    .filter((n) => !n.home && ((n.page.extracted?.wordCount ?? 0) >= MIN_TARGET_WORDS || isKeyPageUrl(n.url)))
    .sort(
      (a, b) =>
        a.inbound.size - b.inbound.size ||
        Number(isKeyPageUrl(b.url)) - Number(isKeyPageUrl(a.url)) ||
        (b.page.extracted?.wordCount ?? 0) - (a.page.extracted?.wordCount ?? 0) ||
        a.url.localeCompare(b.url),
    )
    .slice(0, maxTargets);

  const suggestions: LinkSuggestion[] = [];
  for (const t of targets) {
    const phrases = topicPhrases(t.page, brandNames);
    if (!phrases.length) continue;
    const e = t.page.extracted!;
    const h2 = (e.headings ?? []).filter((h) => h.level === 2).slice(0, 10).map((h) => h.text).join(" ");
    const topic = [...new Set(contentWords(`${titleTopic(e.title, brandNames)} ${e.h1?.[0] ?? ""} ${h2}`))];

    const found: LinkSuggestion[] = [];
    for (const s of eligible) {
      if (s.key === t.key || s.outbound.has(t.key)) continue;
      const text = sourceText.get(s.key) ?? "";
      if (!text) continue;
      let hit: { phrase: string; index: number; length: number } | null = null;
      for (const ph of phrases) {
        if (!(sourceLower.get(s.key) ?? "").includes(ph)) continue; // cheap pre-check before the whole-word match
        const f = findPhrase(text, ph);
        if (f) {
          hit = { phrase: ph, ...f };
          break;
        }
      }
      if (!hit) continue;
      const vocab = sourceVocab.get(s.key)!;
      const overlap = topic.length ? topic.filter((w) => vocab.has(w)).length / topic.length : 0;
      const phraseQuality = Math.min(1, hit.phrase.split(" ").length / 4);
      const score = Math.round(100 * (0.45 * authority(s) + 0.4 * overlap + 0.15 * phraseQuality));
      const anchor = text.slice(hit.index, hit.index + hit.length);
      const tIn = t.inbound.size;
      const sIn = s.inbound.size;
      const need =
        tIn === 0
          ? `No other page on your site links to your "${t.label}" page, so Google and AI tools may never find it.`
          : tIn === 1
            ? `Only 1 page on your site links to your "${t.label}" page.`
            : `${pagesWord(tIn)} to your "${t.label}" page — one more link from a related page helps.`;
      const fromWhy =
        sIn >= 2
          ? `Your "${s.label}" page is well connected (${pagesWord(sIn)} to it) and already mentions "${anchor}".`
          : `Your "${s.label}" page already mentions "${anchor}".`;
      found.push({
        id: `l${shortHash(`${s.key}>${t.key}`)}`,
        sourceUrl: s.url,
        sourceLabel: s.label,
        sourceLinksIn: sIn,
        targetUrl: t.url,
        targetLabel: t.label,
        targetLinksIn: tIn,
        targetStrength: strengthOf(tIn),
        anchor,
        snippet: snippetAround(text, hit.index, hit.length),
        score,
        overlap: Math.round(overlap * 100) / 100,
        sentence: `Add a link from your "${s.label}" page to your "${t.label}" page using the words "${anchor}".`,
        why: `${need} ${fromWhy}`,
      });
    }
    found.sort((a, b) => b.score - a.score || a.sourceUrl.localeCompare(b.sourceUrl));
    const kept = found.slice(0, perTarget);
    suggestions.push(...kept);
  }

  const order: Record<LinkStrength, number> = { orphan: 0, weak: 1, ok: 2 };
  suggestions.sort(
    (a, b) => order[a.targetStrength] - order[b.targetStrength] || b.score - a.score || a.targetUrl.localeCompare(b.targetUrl),
  );
  const finalList = suggestions.slice(0, maxSuggestions);
  const finalByTarget = new Map<string, number>();
  for (const s of finalList) finalByTarget.set(s.targetUrl, (finalByTarget.get(s.targetUrl) ?? 0) + 1);

  const weakPages: WeakPage[] = eligible
    .filter((n) => !n.home && n.inbound.size <= 1)
    .map((n) => ({
      url: n.url,
      label: n.label,
      linksIn: n.inbound.size,
      strength: n.inbound.size === 0 ? ("orphan" as const) : ("weak" as const),
      suggestionCount: finalByTarget.get(n.url) ?? 0,
    }))
    .sort((a, b) => a.linksIn - b.linksIn || b.suggestionCount - a.suggestionCount || a.url.localeCompare(b.url));

  return {
    pagesAnalysed: eligible.length,
    orphanCount: weakPages.filter((w) => w.strength === "orphan").length,
    weakCount: weakPages.filter((w) => w.strength === "weak").length,
    weakPages,
    suggestions: finalList,
    targetsWithSuggestions: finalByTarget.size,
    sourcesUsed: new Set(finalList.map((s) => s.sourceUrl)).size,
  };
}

// ---------------------------------------------------------------------------------------------
// CSV + to-do helpers (pure; used by the client table)

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const LINK_CSV_HEADER = ["From page", "From URL", "To page", "To URL", "Link words", "Where on the page", "Why", "Score"];

export function suggestionsToCsv(rows: LinkSuggestion[]): string {
  const lines = [LINK_CSV_HEADER.join(",")];
  for (const r of rows) {
    const snippet = `${r.snippet.before}${r.snippet.match}${r.snippet.after}`;
    lines.push([r.sourceLabel, r.sourceUrl, r.targetLabel, r.targetUrl, r.anchor, snippet, r.why, r.score].map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Title used for the to-do item; also how the page recognises suggestions already added. */
export function linkTaskTitle(s: Pick<LinkSuggestion, "sourceLabel" | "targetLabel">): string {
  const t = `Add a link from "${s.sourceLabel}" to "${s.targetLabel}"`;
  return t.length > 200 ? `${t.slice(0, 199)}…` : t;
}

export function linkTaskDescription(s: LinkSuggestion): string {
  return [
    s.sentence,
    "",
    `On this page: ${s.sourceUrl}`,
    `Find this text: "${s.snippet.before}${s.snippet.match}${s.snippet.after}"`,
    `Turn the words "${s.anchor}" into a link to: ${s.targetUrl}`,
    "",
    `Why: ${s.why}`,
  ].join("\n").slice(0, 5000);
}
