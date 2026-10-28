// Parses an AI answer (untrusted text) into visibility signals. Pure functions — no I/O.
import type { Citation } from "@/lib/types";

export const PARSER_VERSION = "parse-1";

/** Documented recommendation rule (shown in UI / methodology). */
export const RECOMMENDATION_RULE =
  "The brand counts as recommended when (a) it is mentioned in the same list item or sentence as a " +
  "recommendation cue (recommend, best, top, consider, try, ideal, go with, great choice, stands out) without a " +
  "negation (not recommend, avoid, don't), or (b) it appears in a numbered or bulleted list at position 1–3.";

const RECOMMEND_CUES = /\b(recommend(?:ed|s|ation)?|best|top|consider|try|ideal|go with|great (?:choice|option)|stands? out|leading|excellent choice)\b/i;
const NEGATION = /\b(not recommend(?:ed)?|don'?t recommend|do not recommend|avoid|not the best|steer clear|isn'?t recommended)\b/i;
const POSITIVE = /\b(best|great|excellent|reliable|trusted|popular|recommend(?:ed)?|good|top|leading|affordable|well[- ]reviewed|strong|innovative|quality)\b/gi;
const NEGATIVE = /\b(poor|bad|worst|avoid|complaints?|expensive|overpriced|unreliable|slow|issues?|problems?|scam|lawsuit|negative|lacks?|limited)\b/gi;

export interface EntityRef {
  name: string;
  aliases?: string[];
  domain?: string;
}

export interface ParseContext {
  brandNames: string[]; // first = canonical name, rest = aliases
  competitors: EntityRef[];
  websiteUrl: string; // or bare domain
}

export interface ParsedAnswer {
  brandMentioned: boolean;
  brandMentionCount: number;
  brandRecommended: boolean;
  brandCited: boolean;
  competitorMentions: Record<string, number>;
  citations: Citation[];
  sentiment: "positive" | "neutral" | "negative" | null;
  parseConfidence: number;
  parserVersion: string;
}

export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  try {
    if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `https://${s}`;
    s = new URL(s).hostname;
  } catch {
    s = s.replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0];
  }
  return s.replace(/^www\./, "").replace(/\.$/, "");
}

export function isOwnedDomain(domain: string, projectDomain: string): boolean {
  const d = normalizeDomain(domain);
  const p = normalizeDomain(projectDomain);
  return !!p && (d === p || d.endsWith(`.${p}`));
}

/** Hosts that wrap the real source behind an opaque redirect (e.g. Gemini grounding links). */
const REDIRECT_HOSTS = new Set(["vertexaisearch.cloud.google.com"]);

export function isRedirectCitationUrl(url: string): boolean {
  try {
    return REDIRECT_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** "example.com" / "www.example.co.in" style titles → bare domain; anything else → null. */
export function domainFromTitle(title: string | undefined | null): string | null {
  const t = title?.trim().toLowerCase();
  if (!t || /\s/.test(t)) return null;
  const d = normalizeDomain(t);
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d) ? d : null;
}

export function toCitations(raw: { url: string; title?: string }[], projectDomain: string): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    if (!c?.url || seen.has(c.url)) continue;
    let domain: string;
    try {
      domain = normalizeDomain(new URL(c.url).hostname);
    } catch {
      continue; // not a URL
    }
    if (REDIRECT_HOSTS.has(domain)) {
      // Opaque redirect: the title usually carries the source domain. Unknown source → skip, never guess.
      const fromTitle = domainFromTitle(c.title);
      if (!fromTitle) continue;
      domain = fromTitle;
    }
    seen.add(c.url);
    out.push({ url: c.url, domain, title: c.title, ownedByCustomer: isOwnedDomain(domain, projectDomain) });
  }
  return out;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive match with Unicode letter/digit boundaries so "Acme" ≠ "Acmeville" but matches "Acme's", "(Acme)". */
export function termRegex(term: string): RegExp {
  const body = escapeRe(term.trim()).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}

/** Short (≤3 chars) or all-lowercase dictionary-like aliases are ambiguous. */
export function isAmbiguousAlias(term: string): boolean {
  const t = term.trim();
  return t.length <= 3;
}

interface Match {
  entity: string; // "__brand__" or competitor name
  start: number;
  end: number;
  term: string;
}

function findMatches(text: string, entities: { key: string; terms: string[] }[]): Match[] {
  const all: { key: string; term: string }[] = [];
  for (const e of entities) for (const t of e.terms) if (t.trim()) all.push({ key: e.key, term: t.trim() });
  all.sort((a, b) => b.term.length - a.term.length); // longest first so "Acme Pro" wins over "Acme"
  const taken: [number, number][] = [];
  const matches: Match[] = [];
  for (const { key, term } of all) {
    for (const m of text.matchAll(termRegex(term))) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      matches.push({ entity: key, start, end, term });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

interface Segment {
  start: number;
  end: number;
  text: string;
  listPosition: number | null;
}

/** Split into list items (with position within their list) and sentences. */
export function segment(text: string): Segment[] {
  const segs: Segment[] = [];
  let offset = 0;
  let bulletCounter = 0;
  for (const line of text.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const numbered = /^(?:#+\s*)?(\d{1,2})[.)]\s+/.exec(trimmed);
    const bullet = /^[-*•]\s+/.exec(trimmed);
    if (numbered || bullet) {
      const pos = numbered ? Number(numbered[1]) : ++bulletCounter;
      segs.push({ start: lineStart, end: lineStart + line.length, text: line, listPosition: pos });
      continue;
    }
    bulletCounter = 0;
    // sentences
    const re = /[^.!?]+(?:[.!?]+|$)/g;
    for (const m of line.matchAll(re)) {
      const s = lineStart + (m.index ?? 0);
      segs.push({ start: s, end: s + m[0].length, text: m[0], listPosition: null });
    }
  }
  return segs;
}

function segmentFor(segs: Segment[], pos: number): Segment | undefined {
  return segs.find((s) => pos >= s.start && pos < s.end);
}

export function parseAnswer(answer: { answerText: string; citations: { url: string; title?: string }[] }, ctx: ParseContext): ParsedAnswer {
  const text = answer.answerText ?? "";
  const projectDomain = normalizeDomain(ctx.websiteUrl);
  const citations = toCitations(answer.citations ?? [], projectDomain);
  const brandTerms = ctx.brandNames.filter((b) => b.trim());

  const entities = [
    { key: "__brand__", terms: brandTerms },
    ...ctx.competitors.map((c) => ({ key: c.name, terms: [c.name, ...(c.aliases ?? [])] })),
  ];
  const matches = findMatches(text, entities);
  const brandMatches = matches.filter((m) => m.entity === "__brand__");

  const competitorMentions: Record<string, number> = {};
  for (const c of ctx.competitors) {
    const n = matches.filter((m) => m.entity === c.name).length;
    if (n > 0) competitorMentions[c.name] = n;
  }

  const segs = segment(text);
  let brandRecommended = false;
  const brandSegs = new Set<Segment>();
  for (const m of brandMatches) {
    const seg = segmentFor(segs, m.start);
    if (!seg) continue;
    brandSegs.add(seg);
    const negated = NEGATION.test(seg.text);
    if (!negated && (RECOMMEND_CUES.test(seg.text) || (seg.listPosition !== null && seg.listPosition <= 3))) {
      brandRecommended = true;
    }
  }

  let sentiment: ParsedAnswer["sentiment"] = null;
  if (brandMatches.length > 0) {
    let pos = 0;
    let neg = 0;
    for (const s of brandSegs) {
      pos += (s.text.match(POSITIVE) ?? []).length;
      neg += (s.text.match(NEGATIVE) ?? []).length;
    }
    sentiment = pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
  }

  // Confidence: lower when brand detection relied solely on ambiguous short aliases, or the answer is tiny.
  let parseConfidence = 1;
  if (brandMatches.length > 0 && brandMatches.every((m) => isAmbiguousAlias(m.term))) parseConfidence *= 0.6;
  const ambiguousCompetitor = matches.some((m) => m.entity !== "__brand__" && isAmbiguousAlias(m.term));
  if (ambiguousCompetitor) parseConfidence *= 0.85;
  if (text.trim().length < 40) parseConfidence *= 0.7;

  return {
    brandMentioned: brandMatches.length > 0,
    brandMentionCount: brandMatches.length,
    brandRecommended,
    brandCited: citations.some((c) => c.ownedByCustomer),
    competitorMentions,
    citations,
    sentiment,
    parseConfidence: Math.round(parseConfidence * 100) / 100,
    parserVersion: PARSER_VERSION,
  };
}
