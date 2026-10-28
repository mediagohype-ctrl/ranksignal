// AEO checks: is content shaped so answer engines (featured snippets, AI overviews, voice) can lift answers?
import { isHomeUrl, isKeyPageUrl, isUtilityUrl } from "@/lib/audit/page-kind";
import {
  findHome, makeCheck, notMeasured, okPages, pct, plural, ratioScore, targetScore, urlOf, v2Pages, NEEDS_RESCAN,
  type CheckContext, type EvaluatedCheck, type ReportPage,
} from "@/lib/report/inputs";

const P = "aeo" as const;
const ANSWER_SCHEMA = ["FAQPage", "QAPage", "HowTo"];
export const QUESTION_PAGE_TARGET = 0.4;
export const KEY_PAGE_MIN_WORDS = 300;

export const contentPages = (pages: ReportPage[]) =>
  pages.filter((p) => !isUtilityUrl(urlOf(p)) && p.extracted!.wordCount >= 150);

const isInvalidLd = (j: unknown) => typeof j === "object" && j !== null && (j as Record<string, unknown>)["@invalid"] === true;

export function aeoChecks(ctx: CheckContext): EvaluatedCheck[] {
  const ok = okPages(ctx.pages);
  if (ok.length === 0) return [];
  const out: EvaluatedCheck[] = [];
  const v2 = v2Pages(ctx.pages);
  const v2Content = contentPages(v2);

  // Question-style headings.
  if (v2.length === 0) {
    out.push(notMeasured(P, "aeo.question_headings", "Headings that ask real questions", 2, NEEDS_RESCAN));
    out.push(notMeasured(P, "aeo.direct_answers", "Short, direct answers", 2.5, NEEDS_RESCAN));
  } else {
    const base = v2Content.length ? v2Content : v2;
    const withQ = base.filter((p) => (p.extracted!.questionHeadings?.length ?? 0) > 0);
    const share = withQ.length / base.length;
    out.push(makeCheck(P, "aeo.question_headings", "Headings that ask real questions", 2, {
      score: targetScore(share, QUESTION_PAGE_TARGET),
      detail: `${withQ.length} of ${base.length} content pages use question-style headings (e.g. "How much does … cost?"); aim for at least ${pct(QUESTION_PAGE_TARGET)}.`,
      affected: base.filter((p) => !withQ.includes(p)).map(urlOf),
      evidence: withQ[0]?.extracted?.questionHeadings?.[0] ? `Example: "${withQ[0].extracted.questionHeadings[0].slice(0, 100)}"` : undefined,
      facts: { withQuestions: withQ.length, total: base.length },
    }));

    const questions = v2.reduce((a, p) => a + (p.extracted!.questionHeadings?.length ?? 0), 0);
    const answered = v2.reduce((a, p) => a + (p.extracted!.questionsWithConciseAnswer ?? 0), 0);
    const unanswered = v2.filter((p) => (p.extracted!.questionHeadings?.length ?? 0) > (p.extracted!.questionsWithConciseAnswer ?? 0));
    out.push(questions === 0
      ? makeCheck(P, "aeo.direct_answers", "Short, direct answers", 2.5, {
          score: 40,
          status: "warn",
          detail: "No question headings were found, so there are no ready-made answers for answer engines to quote.",
          facts: { questions: 0, answered: 0 },
        })
      : makeCheck(P, "aeo.direct_answers", "Short, direct answers", 2.5, {
          score: targetScore(answered / questions, 0.6),
          detail: `${answered} of ${questions} question headings are followed by a short, direct answer (about 25–90 words).`,
          affected: unanswered.map(urlOf),
          facts: { questions, answered },
        }));
  }

  // FAQ / HowTo / QAPage structured data on question-heavy pages.
  {
    const qPages = ok.filter((p) => {
      const qs = p.extracted!.questionHeadings?.length ?? p.extracted!.headings.filter((h) => h.level >= 2 && h.text.trim().endsWith("?")).length;
      return qs >= 2;
    });
    const hasSchema = (p: ReportPage) => p.extracted!.schemaTypes.some((t) => ANSWER_SCHEMA.includes(t));
    const anySchema = ok.some(hasSchema);
    if (qPages.length === 0) {
      out.push(makeCheck(P, "aeo.faq_schema", "FAQ / How-to markup", 1.5, {
        score: anySchema ? 100 : 55,
        detail: anySchema ? "FAQ or How-to markup is in use on your site." : "No pages have question-and-answer sections, and no FAQ or How-to markup was found.",
        facts: { questionPages: 0, anySchema },
      }));
    } else {
      const missing = qPages.filter((p) => !hasSchema(p));
      out.push(makeCheck(P, "aeo.faq_schema", "FAQ / How-to markup", 1.5, {
        score: ratioScore(missing.length, qPages.length),
        detail: missing.length ? `${missing.length} of ${qPages.length} pages with several questions have no FAQ/How-to markup.` : `All ${qPages.length} question-and-answer pages carry FAQ/How-to markup.`,
        affected: missing.map(urlOf),
        facts: { questionPages: qPages.length, missing: missing.length },
      }));
    }
  }

  // Lists & tables.
  if (v2Content.length === 0) {
    out.push(v2.length === 0
      ? notMeasured(P, "aeo.lists_tables", "Lists and tables", 1, NEEDS_RESCAN)
      : notMeasured(P, "aeo.lists_tables", "Lists and tables", 1, "No content pages long enough to assess."));
  } else {
    const without = v2Content.filter((p) => (p.extracted!.listCount ?? 0) + (p.extracted!.tableCount ?? 0) === 0);
    out.push(makeCheck(P, "aeo.lists_tables", "Lists and tables", 1, {
      score: targetScore(1 - without.length / v2Content.length, 0.6),
      detail: `${v2Content.length - without.length} of ${v2Content.length} content pages use bullet lists, numbered steps or tables.`,
      affected: without.map(urlOf),
      facts: { without: without.length, total: v2Content.length },
    }));
  }

  // Readability (Flesch, English only).
  {
    const scored = v2.filter((p) => typeof p.extracted!.readingEase === "number");
    if (scored.length === 0) {
      out.push(notMeasured(P, "aeo.readability", "Easy-to-read writing", 1.5, v2.length ? "Not enough English body text to score readability." : NEEDS_RESCAN));
    } else {
      const avg = scored.reduce((a, p) => a + (p.extracted!.readingEase as number), 0) / scored.length;
      const hard = scored.filter((p) => (p.extracted!.readingEase as number) < 40);
      out.push(makeCheck(P, "aeo.readability", "Easy-to-read writing", 1.5, {
        score: Math.max(0, Math.min(100, ((avg - 20) / 40) * 100)),
        detail: `Average reading-ease score is ${Math.round(avg)} out of 100 (60+ reads easily for most adults); ${plural(hard.length, "page")} ${hard.length === 1 ? "is" : "are"} hard to read (below 40).`,
        affected: hard.sort((a, b) => (a.extracted!.readingEase as number) - (b.extracted!.readingEase as number)).map(urlOf),
        facts: { avg: Math.round(avg), hard: hard.length, scored: scored.length },
      }));
    }
  }

  // Structured data coverage + validity.
  {
    const invalid = ok.filter((p) => p.extracted!.jsonLd.some(isInvalidLd));
    const valid = ok.filter((p) => p.extracted!.jsonLd.some((j) => !isInvalidLd(j)));
    const coverage = valid.length / ok.length;
    const score = Math.max(0, targetScore(coverage, 0.8) - invalid.length * 10);
    out.push(makeCheck(P, "aeo.structured_data", "Structured data (schema)", 2, {
      score,
      detail: `${valid.length} of ${ok.length} pages include structured data${invalid.length ? `; ${plural(invalid.length, "page")} ${invalid.length === 1 ? "has" : "have"} broken markup that can't be read` : ""}.`,
      affected: [...invalid.map(urlOf), ...ok.filter((p) => !valid.includes(p)).map(urlOf)],
      facts: { valid: valid.length, invalid: invalid.length, total: ok.length },
    }));
  }

  // Content depth on key pages.
  {
    const home = findHome(ctx);
    const key = ok.filter((p) => (home && p === home) || isHomeUrl(urlOf(p)) || isKeyPageUrl(urlOf(p))).filter((p) => !isUtilityUrl(urlOf(p)));
    if (key.length === 0) {
      out.push(notMeasured(P, "aeo.content_depth", "Depth of key pages", 2, "No key pages (home, services, pricing, about) were found in the sample."));
    } else {
      const shallow = key.filter((p) => p.extracted!.wordCount < KEY_PAGE_MIN_WORDS);
      out.push(makeCheck(P, "aeo.content_depth", "Depth of key pages", 2, {
        score: ratioScore(shallow.length, key.length),
        detail: shallow.length ? `${shallow.length} of ${key.length} key pages (home, services, pricing, about…) have under ${KEY_PAGE_MIN_WORDS} words to explain what you offer.` : `All ${key.length} key pages explain your offer in reasonable depth.`,
        affected: shallow.map(urlOf),
        facts: { shallow: shallow.length, total: key.length },
      }));
    }
  }
  return out;
}
