// Heading structure checker (free tool): pure analysis of one page's H1–H6 outline. No network, no DB.
// Question headings and "concise answer" counts come from extractPage (H2/H3 questions followed by a 25–90 word answer).
import { ANSWER_MAX_WORDS, ANSWER_MIN_WORDS, extractPage, isQuestionHeading } from "@/lib/crawler/extract";
import type { ToolCheck, ToolStatus } from "@/lib/tools/meta-tags";

/** Headings longer than this read like sentences, not signposts. */
export const HEADING_LONG_CHARS = 70;

export interface HeadingNode {
  level: number;
  text: string;
  /** Indent depth for the outline (0 = top). Never jumps more than one step past the previous heading. */
  depth: number;
  empty: boolean;
  long: boolean;
  /** An H2/H3 phrased as a question (what AI answer engines quote). */
  question: boolean;
  /** Level skipped before this heading, e.g. H2 → H4 gives { from: 2 }. */
  skippedFrom: number | null;
}

export interface HeadingReport {
  outline: HeadingNode[];
  /** True when the page had more headings than we list (extractPage keeps the first 200). */
  truncated: boolean;
  counts: { total: number; byLevel: Record<1 | 2 | 3 | 4 | 5 | 6, number> };
  h1: string[];
  skips: { from: number; to: number; text: string }[];
  emptyCount: number;
  longCount: number;
  questionCount: number;
  questionsWithConciseAnswer: number;
  /** questionsWithConciseAnswer / questionCount, 0..1 (null when there are no question headings). */
  conciseAnswerShare: number | null;
  checks: ToolCheck[];
  summary: Record<ToolStatus, number>;
}

const MAX_HEADINGS = 200;

/** Build the indented outline and per-heading flags from a flat heading list. */
export function buildOutline(headings: { level: number; text: string }[]): HeadingNode[] {
  const out: HeadingNode[] = [];
  const stack: number[] = []; // levels of open ancestors
  let prevLevel = 0;
  for (const h of headings) {
    while (stack.length && stack[stack.length - 1] >= h.level) stack.pop();
    const depth = stack.length;
    stack.push(h.level);
    const text = h.text.trim();
    out.push({
      level: h.level,
      text,
      depth,
      empty: text.length === 0,
      long: text.length > HEADING_LONG_CHARS,
      question: (h.level === 2 || h.level === 3) && isQuestionHeading(text),
      skippedFrom: prevLevel > 0 && h.level > prevLevel + 1 ? prevLevel : null,
    });
    prevLevel = h.level;
  }
  return out;
}

/** Analyse a page's heading structure. */
export function analyzeHeadings(html: string, pageUrl: string): HeadingReport {
  let host = "";
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    /* keep empty */
  }
  const x = extractPage(html, pageUrl, host ? [host] : []);
  const outline = buildOutline(x.headings);
  const byLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  for (const h of outline) byLevel[h.level as 1 | 2 | 3 | 4 | 5 | 6]++;
  const skips = outline.filter((h) => h.skippedFrom !== null).map((h) => ({ from: h.skippedFrom!, to: h.level, text: h.text }));
  const emptyCount = outline.filter((h) => h.empty).length;
  const longOnes = outline.filter((h) => h.long);
  const questionCount = x.questionHeadings?.length ?? outline.filter((h) => h.question).length;
  const concise = Math.min(x.questionsWithConciseAnswer ?? 0, questionCount);
  const share = questionCount ? concise / questionCount : null;

  const checks: ToolCheck[] = [];
  const add = (c: ToolCheck) => checks.push(c);
  const quote = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  if (outline.length === 0) {
    add({ id: "headings", label: "Page has headings", status: "fail", detail: "We found no H1–H6 headings in this page's HTML.",
      fix: "Add a main heading (H1) and section headings (H2) as real heading tags, not just bold or large text. If your site builds pages with JavaScript, the headings may only appear after the page loads, and some search and AI tools never see them." });
  }

  if (byLevel[1] === 0) {
    add({ id: "h1", label: "One main heading (H1)", status: "fail", detail: "There is no H1. Visitors, Google and AI tools rely on it to see what the page is about.",
      fix: "Turn the page's main title into an H1, for example \"Wedding cakes in Jaipur\". In most page builders this is the \"Heading 1\" option." });
  } else if (byLevel[1] > 1) {
    add({ id: "h1", label: "One main heading (H1)", status: "warn", detail: `There are ${byLevel[1]} H1 headings: ${x.h1.slice(0, 3).map((t) => `"${quote(t, 40)}"`).join(", ")}${byLevel[1] > 3 ? "…" : ""}.`,
      fix: "Keep one H1 for the page's main topic and change the others to H2. Logos and site names in the header often use an H1 by mistake." });
  } else {
    add({ id: "h1", label: "One main heading (H1)", status: "pass", detail: `One H1: "${quote(x.h1[0] || "(empty)")}".` });
  }

  if (outline.length) {
    if (skips.length) {
      const s = skips[0];
      add({ id: "skips", label: "No skipped levels", status: "warn",
        detail: `${skips.length} heading${skips.length === 1 ? " skips" : "s skip"} a level, for example H${s.from} → H${s.to} at "${quote(s.text || "(empty)", 50)}".`,
        fix: "Go down one level at a time (H2, then H3). Pick headings by their place in the outline, not by their size; change the size with styling instead." });
    } else {
      add({ id: "skips", label: "No skipped levels", status: "pass", detail: "Heading levels step down one at a time." });
    }

    if (emptyCount) {
      add({ id: "empty", label: "No empty headings", status: "warn", detail: `${emptyCount} heading${emptyCount === 1 ? " has" : "s have"} no text. Screen readers announce them as blank.`,
        fix: "Add text to the heading or remove the heading tag. If it only holds an image or icon, use a normal element instead." });
    } else {
      add({ id: "empty", label: "No empty headings", status: "pass", detail: "Every heading has text." });
    }

    if (longOnes.length) {
      add({ id: "long", label: `Headings under ${HEADING_LONG_CHARS} characters`, status: "warn",
        detail: `${longOnes.length} heading${longOnes.length === 1 ? " is" : "s are"} longer than ${HEADING_LONG_CHARS} characters, for example "${quote(longOnes[0].text, 60)}".`,
        fix: "Keep headings short signposts of about 3–10 words. Move the extra detail into the paragraph below." });
    } else {
      add({ id: "long", label: `Headings under ${HEADING_LONG_CHARS} characters`, status: "pass", detail: "All headings are short and scannable." });
    }

    if (questionCount === 0) {
      add({ id: "questions", label: "Question headings (for AI answers)", status: "warn", detail: "None of the H2 or H3 headings is phrased as a question.",
        fix: "Where it fits, phrase a few section headings as the questions customers ask, such as \"How much does a website audit cost?\", and answer right below." });
    } else {
      add({ id: "questions", label: "Question headings (for AI answers)", status: "pass", detail: `${questionCount} H2/H3 heading${questionCount === 1 ? " is" : "s are"} phrased as a question.` });
      const pct = Math.round((share ?? 0) * 100);
      add({ id: "answers", label: "Short answer under each question", status: pct >= 50 ? "pass" : "warn",
        detail: `${concise} of ${questionCount} question heading${questionCount === 1 ? "" : "s"} (${pct}%) ${concise === 1 ? "is" : "are"} followed by a direct answer of ${ANSWER_MIN_WORDS}–${ANSWER_MAX_WORDS} words.`,
        fix: pct >= 50 ? undefined : `Start the text under each question with a ${ANSWER_MIN_WORDS}–${ANSWER_MAX_WORDS} word answer that makes sense on its own, then add detail. AI tools quote answers like that.` });
    }
  }

  const summary: Record<ToolStatus, number> = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) summary[c.status]++;

  return {
    outline,
    truncated: x.headings.length >= MAX_HEADINGS,
    counts: { total: outline.length, byLevel },
    h1: x.h1,
    skips,
    emptyCount,
    longCount: longOnes.length,
    questionCount,
    questionsWithConciseAnswer: concise,
    conciseAnswerShare: share,
    checks,
    summary,
  };
}
