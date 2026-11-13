// Free AI writing tools (SEO title, meta description and FAQ generators): input schemas, the shared gate
// (captcha + rate limit), ONE structured LLM call per run on a cheap model, and deterministic post-processing of
// the model output (clean, enforce lengths, dedupe) so nothing the model returns reaches the visitor unchecked.
// Server-only. Browser code uses ./ai-writing-checks and ./ai-writing-prompts.
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { clientIp } from "@/lib/auth/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { checkAiToolLimit } from "@/lib/free-check/limits";
import { fetchPublicHtml } from "./fetch-page";
import { extractPage } from "@/lib/crawler/extract";
import { generateStructured } from "@/lib/providers/llm";
import { TITLE_MAX, TITLE_MIN } from "@/lib/audit/rules";
import { addToolAiCost } from "@/lib/admin/tool-usage";
import {
  AI_INPUT_LIMITS as L,
  FAQ_ANSWER_MAX_WORDS,
  cleanInput,
  cleanLine,
  cleanMultiline,
  evaluateDescription,
  evaluateFaqAnswer,
  evaluateTitle,
  isAllCaps,
  isNotStated,
  limitWords,
  shortenAtSentence,
  type DraftCheck,
} from "./ai-writing-checks";
import {
  DESCRIPTION_SYSTEM,
  DESCRIPTION_TARGET_MAX,
  DESCRIPTION_TARGET_MIN,
  FAQ_NOT_STATED,
  FAQ_SYSTEM,
  PAGE_TYPES,
  TITLE_SYSTEM,
  descriptionUserPrompt,
  faqUserPrompt,
  titleUserPrompt,
} from "./ai-writing-prompts";

export const DEFAULT_TOOLS_MODEL = "google/gemini-3.8-flash";
/** Output token cap per run (cost control). */
export const AI_TOOL_MAX_TOKENS = 800;
export const TITLE_COUNT = 5;
export const DESCRIPTION_COUNT = 5;
export const FAQ_MIN = 6;
export const FAQ_MAX = 8;
/** Below this much page text there is nothing to ground FAQ answers in. */
export const FAQ_MIN_SOURCE_CHARS = 30;

export type AiTool = "seo-title-generator" | "meta-description-generator" | "faq-generator";

/** Cheap OpenRouter model for these tools (the analysis models are far too expensive for a free tool). */
export function aiToolsModel(): string {
  return process.env.OPENROUTER_TOOLS_MODEL?.trim() || DEFAULT_TOOLS_MODEL;
}

export const AI_BUSY_MESSAGE = "AI writing is busy right now. Please try again later.";

// ------------------------------------------------------------------------------------------------ input schemas

const token = z.string().max(4096).optional();
const req = (max: number, what: string) =>
  z
    .string()
    .max(max, `${what} can be up to ${max} characters.`)
    .transform((s) => cleanInput(s, max))
    .refine((s) => s.length > 0, `Please fill in ${what.toLowerCase()}.`);
const opt = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((s) => cleanInput(s, max));

export const titleBodySchema = z.object({
  topic: req(L.topic, "What the page is about"),
  keyword: req(L.keyword, "The main keyword"),
  brand: opt(L.brand),
  pageType: z.enum(PAGE_TYPES).default("service"),
  city: opt(L.city),
  turnstileToken: token,
});
export type TitleInput = Omit<z.infer<typeof titleBodySchema>, "turnstileToken">;

export const descriptionBodySchema = z.object({
  topic: req(L.topic, "What the page is about"),
  keyword: req(L.keyword, "The main keyword"),
  cta: opt(L.cta),
  audience: opt(L.audience),
  turnstileToken: token,
});
export type DescriptionInput = Omit<z.infer<typeof descriptionBodySchema>, "turnstileToken">;

export const faqBodySchema = z.object({
  url: z.string().max(2048).optional().transform((s) => (s ?? "").trim()),
  text: z
    .string()
    .max(L.pageText, `Paste up to ${L.pageText.toLocaleString("en-IN")} characters.`)
    .optional()
    .transform((s) => cleanMultiline(s, L.pageText)),
  audience: opt(L.audience),
  location: opt(L.location),
  turnstileToken: token,
});
export type FaqInput = Omit<z.infer<typeof faqBodySchema>, "turnstileToken">;

// ------------------------------------------------------------------------------------------------ model output

export const titleOutputSchema = z.object({ titles: z.array(z.string().max(400)).min(1).max(12) });
export const descriptionOutputSchema = z.object({ descriptions: z.array(z.string().max(600)).min(1).max(12) });
export const faqOutputSchema = z.object({
  faqs: z.array(z.object({ question: z.string().max(400), answer: z.string().max(2000) })).min(1).max(12),
});

const dedupeKey = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function dedupe<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = dedupeKey(key(t));
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Clean, length-check and dedupe model titles; at most 5, each with its pass/warn check. */
export function postProcessTitles(raw: string[], input: Pick<TitleInput, "keyword" | "brand">): DraftCheck[] {
  const cleaned = raw
    .map((t) => cleanLine(t).replace(/!+/g, "").replace(/[.\s]+$/, "").trim())
    // Way outside Google's range or shouting: not worth showing at all.
    .filter((t) => t.length >= TITLE_MIN && t.length <= TITLE_MAX + 15 && !isAllCaps(t));
  return dedupe(cleaned, (t) => t)
    .slice(0, TITLE_COUNT)
    .map((t) => evaluateTitle(t, { keyword: input.keyword, brand: input.brand }));
}

/** Clean, trim to 155 at a sentence end where possible, dedupe; at most 5 with pass/warn checks. */
export function postProcessDescriptions(raw: string[], input: Pick<DescriptionInput, "keyword">): DraftCheck[] {
  const cleaned = raw
    .map((d) => cleanLine(d).replace(/!+/g, "."))
    .map((d) => shortenAtSentence(d, DESCRIPTION_TARGET_MIN - 20, DESCRIPTION_TARGET_MAX))
    .filter((d) => d.length >= 70 && d.length <= 230 && !isAllCaps(d));
  return dedupe(cleaned, (d) => d)
    .slice(0, DESCRIPTION_COUNT)
    .map((d) => evaluateDescription(d, { keyword: input.keyword }));
}

export interface FaqDraft {
  question: string;
  answer: string;
  /** True when the page text did not support an answer (the visitor must write it). */
  notStated: boolean;
  check: DraftCheck;
}

/** Clean questions/answers, cap answers at 80 words, normalise "not stated" answers, dedupe; at most 8. */
export function postProcessFaqs(raw: { question: string; answer: string }[]): FaqDraft[] {
  const rows = raw
    .map((r) => {
      let q = cleanLine(r.question).slice(0, 200).trim();
      if (q && !/\?$/.test(q)) q = `${q.replace(/[.!:;,\s]+$/, "")}?`;
      const a0 = cleanLine(r.answer);
      const notStated = !a0 || isNotStated(a0);
      const answer = notStated ? FAQ_NOT_STATED : limitWords(a0, FAQ_ANSWER_MAX_WORDS);
      return { question: q, answer, notStated };
    })
    .filter((r) => r.question.length >= 8);
  return dedupe(rows, (r) => r.question)
    .slice(0, FAQ_MAX)
    .map((r) => ({ ...r, check: evaluateFaqAnswer(r.answer) }));
}

// ------------------------------------------------------------------------------------------------ gate + runs

/** Captcha then rate limit, exactly like the free check. Throws a friendly HttpError when refused. */
export async function gateAiTool(req: Request, tool: AiTool, turnstileToken: string | undefined): Promise<string> {
  const ip = clientIp(req);
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    throw new HttpError(400, "captcha_failed", "The security check failed. Please try again.");
  }
  const limit = checkAiToolLimit(tool, ip);
  if (!limit.allowed) {
    const message =
      limit.scope === "ip"
        ? "You've used your free AI drafts for this hour. Please try again later."
        : "Lots of people are using this tool right now. Please try again in a few minutes.";
    throw new HttpError(429, "rate_limited", message, { retryAfterSec: limit.retryAfterSec });
  }
  return ip;
}

function busy(): never {
  throw new HttpError(503, "ai_busy", AI_BUSY_MESSAGE);
}
function unusable(what: string): never {
  throw new HttpError(502, "ai_unusable", `The AI didn't write usable ${what} this time. Please try again.`);
}

async function call<T>(schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  let res: { data: T; costMicros: number } | null = null;
  try {
    res = await generateStructured({ schema, system, user, maxTokens: AI_TOOL_MAX_TOKENS, model: aiToolsModel() });
  } catch (err) {
    console.warn("[ai-tools] generation failed", { name: (err as Error)?.name });
    busy();
  }
  if (!res) busy(); // budget exhausted or no LLM configured
  addToolAiCost(res.costMicros, aiToolsModel()); // admin "Free tool usage" cost column
  return res.data;
}

export async function generateTitles(input: TitleInput): Promise<DraftCheck[]> {
  const data = await call(titleOutputSchema, TITLE_SYSTEM, titleUserPrompt(input));
  const titles = postProcessTitles(data.titles, input);
  if (!titles.length) unusable("titles");
  return titles;
}

export async function generateDescriptions(input: DescriptionInput): Promise<DraftCheck[]> {
  const data = await call(descriptionOutputSchema, DESCRIPTION_SYSTEM, descriptionUserPrompt(input));
  const out = postProcessDescriptions(data.descriptions, input);
  if (!out.length) unusable("descriptions");
  return out;
}

export async function generateFaqs(input: Pick<FaqInput, "audience" | "location">, sourceText: string, sourceUrl?: string): Promise<FaqDraft[]> {
  const data = await call(faqOutputSchema, FAQ_SYSTEM, faqUserPrompt(input, sourceText, sourceUrl));
  const out = postProcessFaqs(data.faqs);
  if (!out.length) unusable("questions");
  return out;
}

// ------------------------------------------------------------------------------------------------ FAQ source page

/** Main text of a public page for FAQ grounding (SSRF-safe fetch via fetchPublicHtml), ≤ 4,000 characters. */
export async function loadFaqSourceFromUrl(rawUrl: string): Promise<{ url: string; text: string }> {
  const res = await fetchPublicHtml(rawUrl);
  const host = new URL(res.finalUrl).hostname;
  const page = extractPage(res.html, res.finalUrl, [host]);
  const parts = [
    page.title ? `Title: ${page.title}` : "",
    page.description ? `Summary: ${page.description}` : "",
    ...page.headings.filter((h) => h.level <= 3).slice(0, 25).map((h) => `Heading: ${h.text}`),
    page.textSample ?? "",
  ];
  const text = cleanMultiline(parts.filter(Boolean).join("\n"), L.pageText);
  if (text.length < 100) {
    throw new HttpError(422, "too_little_text", "We couldn't find enough text on that page. Paste the page text instead.");
  }
  return { url: res.finalUrl, text };
}
