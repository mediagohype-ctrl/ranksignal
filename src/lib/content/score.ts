// SEO / AEO / GEO score for a blog post draft (pure — runs live in the editor and on the server).
import { links, parseMarkdown, plainText, wordCount, type Block } from "./markdown";

export interface PostDraft {
  title: string;
  metaTitle?: string | null;
  description: string;
  slug: string;
  answer: string;
  body: string;
  keyPoints: string[];
  faqs: { q: string; a: string }[];
  keywords: string[];
  authorName: string;
  coverImageUrl?: string | null;
}

export type Pillar = "seo" | "aeo" | "geo";

export interface ScoreCheck {
  id: string;
  pillar: Pillar;
  label: string;
  /** "pass" = full points, "warn" = half, "fail" = none. */
  state: "pass" | "warn" | "fail";
  tip: string;
  weight: number;
}

export interface PostScore {
  overall: number;
  pillars: Record<Pillar, number>;
  checks: ScoreCheck[];
  stats: { words: number; h2: number; internalLinks: number; externalLinks: number; readingMinutes: number };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const has = (hay: string, needle: string) => !!needle && norm(hay).includes(norm(needle));

/** Titles are shown with " · MyWebRank" appended; keep the whole thing under ~65 characters. */
export const TITLE_RANGE = [30, 60] as const;
export const DESCRIPTION_RANGE = [120, 160] as const;
export const ANSWER_WORDS = [30, 80] as const;

export function scorePost(d: PostDraft, blocks: Block[] = parseMarkdown(d.body)): PostScore {
  const kw = d.keywords[0]?.trim() ?? "";
  const title = (d.metaTitle?.trim() || d.title).trim();
  const text = plainText(blocks);
  const words = wordCount(text);
  const firstWords = text.split(/\s+/).slice(0, 100).join(" ");
  const h2 = blocks.filter((b) => b.t === "h2");
  const headings = blocks.filter((b): b is Extract<Block, { t: "h2" | "h3" }> => b.t === "h2" || b.t === "h3");
  const all = links(blocks);
  const internal = all.filter((h) => h.startsWith("/")).length;
  const external = all.filter((h) => /^https?:\/\//.test(h)).length;
  const answerWords = wordCount(d.answer);
  const numbers = (text.match(/\b\d[\d,.]*%?/g) ?? []).length;
  const imgs = blocks.filter((b) => b.t === "img");
  const listsOrTables = blocks.filter((b) => b.t === "ul" || b.t === "ol" || b.t === "table").length;
  const faqs = d.faqs.filter((f) => f.q.trim() && f.a.trim());

  const c: ScoreCheck[] = [];
  const add = (pillar: Pillar, id: string, label: string, state: ScoreCheck["state"], tip: string, weight = 1) =>
    c.push({ id, pillar, label, state, tip, weight });
  const range = (n: number, [lo, hi]: readonly [number, number], slack = 0.25): ScoreCheck["state"] =>
    n >= lo && n <= hi ? "pass" : n >= lo * (1 - slack) && n <= hi * (1 + slack) ? "warn" : "fail";

  // --- SEO
  add("seo", "keyword", "Primary search phrase is set", kw ? "pass" : "fail", "Add the phrase people type into Google, e.g. “what is GEO”.", 2);
  add("seo", "title-length", `Google headline is ${TITLE_RANGE[0]}–${TITLE_RANGE[1]} characters (now ${title.length})`, range(title.length, TITLE_RANGE), "Longer titles get cut off in search results.");
  add("seo", "title-keyword", "Search phrase is in the Google headline", has(title, kw) ? "pass" : "fail", "Put the phrase near the start of the title.", 2);
  add("seo", "desc-length", `Google summary is ${DESCRIPTION_RANGE[0]}–${DESCRIPTION_RANGE[1]} characters (now ${d.description.length})`, range(d.description.length, DESCRIPTION_RANGE), "This is the grey text under the link in Google.");
  add("seo", "desc-keyword", "Search phrase is in the Google summary", has(d.description, kw) ? "pass" : "warn", "Google bolds matching words, which earns clicks.");
  add("seo", "intro-keyword", "Search phrase appears in the first 100 words", has(firstWords, kw) || has(d.answer, kw) ? "pass" : "warn", "Say what the page is about straight away.");
  add("seo", "slug", "Address is short and readable", /^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug) && d.slug.length <= 60 ? "pass" : "fail", "Use lowercase words joined by dashes, under 60 characters.");
  add("seo", "length", `Length: ${words} words (aim for 800+)`, words >= 800 ? "pass" : words >= 500 ? "warn" : "fail", "In-depth pages rank better for competitive phrases.", 2);
  add("seo", "headings", `Sections: ${h2.length} H2 headings (aim for 3+)`, h2.length >= 3 ? "pass" : h2.length >= 1 ? "warn" : "fail", "Use ## headings to split the article into sections.");
  add("seo", "internal-links", `Links to our pages: ${internal} (aim for 2+)`, internal >= 2 ? "pass" : internal === 1 ? "warn" : "fail", "Link to /free-check, /services or related guides with descriptive words.");
  add("seo", "image-alt", "Images have descriptions (alt text)", imgs.every((i) => i.alt.trim().length >= 5) ? "pass" : "fail", "Describe each image: ![What the image shows](url).");

  // --- AEO
  add("aeo", "answer", `Short answer is ${ANSWER_WORDS[0]}–${ANSWER_WORDS[1]} words (now ${answerWords})`, range(answerWords, ANSWER_WORDS, 0.4), "A direct 40–60 word answer is what featured snippets and AI Overviews quote.", 3);
  add("aeo", "question-headings", "At least one heading is a question", headings.some((h) => h.text.trim().endsWith("?")) ? "pass" : "warn", "Write headings the way people ask: “How much does an SEO audit cost?”", 2);
  add("aeo", "faqs", `FAQs: ${faqs.length} (aim for 3+)`, faqs.length >= 3 ? "pass" : faqs.length >= 1 ? "warn" : "fail", "Each FAQ becomes FAQ schema that Google and AI tools read.", 2);
  add("aeo", "lists", "Uses a list or table", listsOrTables > 0 ? "pass" : "warn", "Steps, comparisons and prices in lists/tables are easy to lift as answers.");

  // --- GEO
  add("geo", "key-points", `Key points: ${d.keyPoints.filter((k) => k.trim()).length} (aim for 3+)`, d.keyPoints.filter((k) => k.trim()).length >= 3 ? "pass" : "warn", "Short factual bullets are what AI assistants repeat.", 2);
  add("geo", "facts", `Specific numbers: ${numbers} (aim for 3+)`, numbers >= 3 ? "pass" : numbers >= 1 ? "warn" : "fail", "Prices, percentages, dates and counts make a page worth citing.", 2);
  add("geo", "sources", `Cites outside sources: ${external} (aim for 1+)`, external >= 1 ? "pass" : "fail", "Link the study, docs or data you rely on — AI engines favour sourced pages.", 2);
  add("geo", "author", "Author name is shown", d.authorName.trim().length >= 2 ? "pass" : "fail", "Named authors build trust (E-E-A-T).");
  add("geo", "brand", "Mentions MyWebRank in the text", /mywebrank/i.test(text + d.answer) ? "pass" : "warn", "Tie the topic to our brand so AI learns the association.");

  const pillarScore = (p: Pillar) => {
    const xs = c.filter((x) => x.pillar === p);
    const max = xs.reduce((a, x) => a + x.weight, 0);
    const got = xs.reduce((a, x) => a + (x.state === "pass" ? x.weight : x.state === "warn" ? x.weight / 2 : 0), 0);
    return max ? Math.round((got / max) * 100) : 0;
  };
  const pillars = { seo: pillarScore("seo"), aeo: pillarScore("aeo"), geo: pillarScore("geo") };
  return {
    overall: Math.round((pillars.seo + pillars.aeo + pillars.geo) / 3),
    pillars,
    checks: c,
    stats: { words, h2: h2.length, internalLinks: internal, externalLinks: external, readingMinutes: Math.max(1, Math.round(words / 220)) },
  };
}
