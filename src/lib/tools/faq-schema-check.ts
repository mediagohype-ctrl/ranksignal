// FAQ schema checker: validates pasted FAQPage JSON-LD (raw JSON or a <script type="application/ld+json"> block) and
// returns a short, plain-words result list, one line per check with a next step. Pure and browser-only: nothing is sent.
import type { CheckItem, CheckLevel } from "./llms-txt-check";

export type { CheckItem, CheckLevel };

/** Largest paste we check (characters). */
export const FAQ_CHECK_MAX_CHARS = 200_000;

export interface FaqCheckResult {
  items: CheckItem[];
  errors: number;
  warnings: number;
  /** Questions found across every FAQPage. */
  questions: number;
}

/** Shown under every result: Google's August 2023 change, in one plain line. */
export const FAQ_GOOGLE_2023_NOTE =
  "Since August 2023 Google shows FAQ drop-downs in search only for well-known government and health websites. The code still helps Google and AI tools read your questions and answers.";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function numList(nums: number[]): string {
  const shown = nums.slice(0, 5).join(", ");
  return nums.length > 5 ? `${shown} and ${nums.length - 5} more` : shown;
}

function types(v: Json | undefined): string[] {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return list.filter((t): t is string => typeof t === "string").map((t) => t.replace(/^(https?:\/\/)?schema\.org\//i, ""));
}

function str(v: Json | undefined): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function contextIsSchemaOrg(ctx: Json | undefined): boolean {
  if (ctx === undefined || ctx === null) return false;
  if (typeof ctx === "string") return /^(https?:\/\/)?schema\.org\/?$/i.test(ctx.trim());
  if (Array.isArray(ctx)) return ctx.some((c) => contextIsSchemaOrg(c));
  if (isObj(ctx)) return contextIsSchemaOrg(ctx["@vocab"]);
  return false;
}

/** Pull the JSON out of the paste: every ld+json script block, or the whole text when there are no script tags. */
export function extractJsonBlocks(input: string): { blocks: string[]; scriptTags: boolean } {
  // Raw JSON (starts with { or [) may itself mention <script> inside an answer, so only look for tags otherwise.
  if (/^\s*[{[]/.test(input) || !/<script\b/i.test(input)) return { blocks: [input.trim()], scriptTags: false };
  const blocks: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (let m = re.exec(input); m; m = re.exec(input)) {
    if (/type\s*=\s*["']?application\/ld\+json/i.test(m[1])) blocks.push(m[2].trim());
  }
  return { blocks, scriptTags: true };
}

function jsonFix(block: string): string {
  if (/,\s*[}\]]/.test(block)) return "Remove the comma just before a closing } or ] (JSON doesn't allow it).";
  if (/[“”‘’]/.test(block)) return "Replace curly quotes (“ ”) with straight quotes (\"). Word processors change them.";
  if (/'[^']*'\s*:/.test(block)) return "Use double quotes (\") around names and text, not single quotes.";
  return "Look for a missing comma, quote or bracket. Easiest fix: make the code again with the Make FAQ code tab.";
}

interface FaqNode {
  node: Obj;
  ctx: Json | undefined;
}

/** Find every FAQPage node, including inside @graph and nested objects, with the @context that applies to it. */
function findFaqPages(value: Json, ctx: Json | undefined, found: FaqNode[], depth = 0): void {
  if (depth > 20) return;
  if (Array.isArray(value)) {
    for (const v of value) findFaqPages(v, ctx, found, depth + 1);
    return;
  }
  if (!isObj(value)) return;
  const here = value["@context"] ?? ctx;
  if (types(value["@type"]).includes("FAQPage")) {
    found.push({ node: value, ctx: here });
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if (k === "@context") continue;
    findFaqPages(v, here, found, depth + 1);
  }
}

function hasType(value: Json, type: string, depth = 0): boolean {
  if (depth > 20) return false;
  if (Array.isArray(value)) return value.some((v) => hasType(v, type, depth + 1));
  if (!isObj(value)) return false;
  if (types(value["@type"]).includes(type)) return true;
  return Object.values(value).some((v) => hasType(v, type, depth + 1));
}

export function checkFaqSchema(input: string): FaqCheckResult {
  const items: CheckItem[] = [];
  let questions = 0;
  const out = (): FaqCheckResult => ({
    items,
    errors: items.filter((i) => i.level === "error").length,
    warnings: items.filter((i) => i.level === "warn").length,
    questions,
  });

  if (input.trim() === "") {
    items.push({ id: "empty", level: "error", title: "Nothing to check yet.", fix: "Paste your FAQ code, or use the Make FAQ code tab to create it." });
    return out();
  }

  // 1. Find and read the JSON.
  const { blocks, scriptTags } = extractJsonBlocks(input);
  if (scriptTags && blocks.length === 0) {
    items.push({
      id: "no-ld-json",
      level: "error",
      title: "We found a <script> tag, but not one with type=\"application/ld+json\".",
      fix: "Start the code with <script type=\"application/ld+json\"> so Google knows it's structured info.",
    });
    return out();
  }
  const parsed: Json[] = [];
  blocks.forEach((b, i) => {
    try {
      parsed.push(JSON.parse(b) as Json);
    } catch {
      items.push({
        id: `json-invalid-${i}`,
        level: "error",
        title: blocks.length > 1 ? `Code block ${i + 1} isn't valid JSON, so Google can't read it.` : "The code isn't valid JSON, so Google can't read it.",
        fix: jsonFix(b),
      });
    }
  });
  if (parsed.length === 0) return out();
  items.push({ id: "json", level: "ok", title: "The code is valid JSON.", fix: "Nothing to change." });

  // 2. Find the FAQPage.
  const pages: FaqNode[] = [];
  for (const p of parsed) findFaqPages(p, undefined, pages);
  if (pages.length === 0) {
    const qa = parsed.some((p) => hasType(p, "QAPage"));
    items.push({
      id: "no-faqpage",
      level: "error",
      title: qa ? "This is a QAPage (one question with answers from many people), not an FAQPage." : "No FAQPage found in the code.",
      fix: qa
        ? "If you wrote both the questions and the answers, change \"@type\": \"QAPage\" to \"@type\": \"FAQPage\"."
        : "Set \"@type\": \"FAQPage\" on the main object, or make the code again with the Make FAQ code tab.",
    });
    return out();
  }
  items.push({ id: "faqpage", level: "ok", title: "FAQPage found.", fix: "Nothing to change." });
  if (pages.length > 1) {
    items.push({
      id: "faqpage-multiple",
      level: "warn",
      title: `${pages.length} FAQPage blocks found. Google reads only one per page.`,
      fix: "Merge all questions into a single FAQPage.",
    });
  }

  // 3. @context.
  const badCtx = pages.filter((p) => !contextIsSchemaOrg(p.ctx));
  if (badCtx.length) {
    const missing = badCtx.some((p) => p.ctx === undefined);
    items.push({
      id: "context",
      level: "error",
      title: missing ? "The \"@context\" line is missing." : "The \"@context\" doesn't point to schema.org.",
      fix: "Add \"@context\": \"https://schema.org\" at the top of the code.",
    });
  } else {
    items.push({ id: "context-ok", level: "ok", title: "Uses the schema.org vocabulary.", fix: "Nothing to change." });
  }

  // 4. mainEntity and each question.
  const noMain: number[] = [];
  const notArray: number[] = [];
  const notQuestion: number[] = [];
  const noName: number[] = [];
  const noAnswer: number[] = [];
  const answerType: number[] = [];
  const noText: number[] = [];
  const scripts: number[] = [];
  const seen = new Map<string, number>();
  const dupes: number[] = [];

  pages.forEach((p, pi) => {
    const main = p.node.mainEntity;
    if (main === undefined || main === null || (Array.isArray(main) && main.length === 0)) {
      noMain.push(pi + 1);
      return;
    }
    if (!Array.isArray(main)) notArray.push(pi + 1);
    const list = Array.isArray(main) ? main : [main];
    for (const q of list) {
      questions++;
      const n = questions;
      if (!isObj(q)) {
        notQuestion.push(n);
        continue;
      }
      if (!types(q["@type"]).includes("Question")) notQuestion.push(n);
      const name = str(q.name);
      if (!name) noName.push(n);
      else {
        const key = name.toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
        if (seen.has(key)) dupes.push(n);
        else seen.set(key, n);
      }
      const answers = Array.isArray(q.acceptedAnswer) ? q.acceptedAnswer : q.acceptedAnswer === undefined || q.acceptedAnswer === null ? [] : [q.acceptedAnswer];
      if (answers.length === 0) {
        noAnswer.push(n);
        continue;
      }
      const a = answers[0];
      if (!isObj(a)) {
        noText.push(n);
        continue;
      }
      if (!types(a["@type"]).includes("Answer")) answerType.push(n);
      const text = str(a.text);
      if (!text) noText.push(n);
      else if (/<\s*script\b/i.test(text)) scripts.push(n);
    }
  });

  if (noMain.length) {
    items.push({
      id: "main-missing",
      level: "error",
      title: "The FAQPage has no questions (no \"mainEntity\" list).",
      fix: "Add \"mainEntity\": [ ... ] with one Question for each question on your page.",
    });
  }
  if (notArray.length) {
    items.push({
      id: "main-not-list",
      level: "warn",
      title: "\"mainEntity\" is a single item, not a list.",
      fix: "Wrap the questions in square brackets [ ], even when there is only one.",
    });
  }
  if (questions > 0) {
    const bad = (nums: number[], id: string, level: CheckLevel, what: string, fix: string) => {
      if (nums.length) items.push({ id, level, title: `${nums.length === 1 ? "Question" : "Questions"} ${numList(nums)}: ${what}`, fix });
    };
    bad(notQuestion, "q-type", "error", "not marked as a Question.", "Add \"@type\": \"Question\" to each item in mainEntity.");
    bad(noName, "q-name", "error", "the question text is empty.", "Put the question in \"name\", for example \"name\": \"Do you deliver on Sundays?\".");
    bad(noAnswer, "q-answer", "error", "no answer (\"acceptedAnswer\" is missing).", "Add \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"Your answer\" }.");
    bad(answerType, "a-type", "error", "the answer isn't marked as an Answer.", "Add \"@type\": \"Answer\" inside acceptedAnswer.");
    bad(noText, "a-text", "error", "the answer text is empty.", "Put the answer in \"text\" inside acceptedAnswer, matching the answer visitors see.");
    bad(scripts, "a-script", "error", "the answer contains a <script> tag.", "Remove script tags from answers. Simple tags like <p>, <a>, <b> and <br> are fine.");
    bad(dupes, "q-duplicate", "warn", "the same question appears more than once.", "Keep one copy of each question and delete the repeats.");

    const clean = notQuestion.length + noName.length + noAnswer.length + answerType.length + noText.length + scripts.length === 0;
    if (clean) {
      items.push({
        id: "questions-ok",
        level: "ok",
        title: `${plural(questions, "question has", "questions have")} a question and an answer.`,
        fix: "Make sure the same questions and answers are visible on your page.",
      });
    }
  }

  return out();
}

/** A clearly-labelled sample FAQPage JSON-LD with two questions (shown on the page and used by "Use an example"). */
export const FAQ_SCHEMA_EXAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do you deliver on Sundays?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. We deliver every day from 9 am to 8 pm across Pune, including Sundays and public holidays."
      }
    },
    {
      "@type": "Question",
      "name": "How much does delivery cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Delivery is free on orders over ₹500. Smaller orders pay a flat ₹40."
      }
    }
  ]
}
</script>`;
