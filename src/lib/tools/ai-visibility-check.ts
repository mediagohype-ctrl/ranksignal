// Free AI visibility checker (/tools/ai-visibility-checker, SEO fix brief P1): asks ChatGPT, Gemini and Perplexity one
// customer-style question ("best <category> in <city>") with web search on, and reports for each whether the
// business is named, where in the list, and who is named instead.
//
// Cost control (every run is a paid AI call): captcha + a tight hourly limit (route), a 24-hour result cache for the
// same business + question, a daily spend cap just for this tool (AI_VISIBILITY_TOOL_DAILY_USD, default $3), and
// the platform-wide daily AI budget that every OpenRouter call already reserves against.
import { z } from "zod";
import { db } from "@/lib/db";
import { createOpenRouterProvider } from "@/lib/providers/visibility/openrouter";
import { getOpenRouterVisibilityModels, isOpenRouterConfigured } from "@/lib/providers/openrouter-client";
import { termRegex } from "@/lib/visibility/parse";

export const AI_CHECK_TOOL = "ai-visibility-checker";

const field = (max: number, label: string) =>
  z
    .string()
    .max(200)
    .transform((s) => s.replace(/[\u0000-\u001F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max))
    .refine((s) => s.length >= 2, `${label} is too short.`);

export const aiCheckBodySchema = z.object({
  business: field(80, "Business name"),
  category: field(80, "What you do"),
  city: z
    .string()
    .max(120)
    .optional()
    .transform((s) => (s ?? "").replace(/[\u0000-\u001F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)),
  turnstileToken: z.string().max(4096).optional(),
});
export type AiCheckInput = Omit<z.infer<typeof aiCheckBodySchema>, "turnstileToken">;

/** The customer-style question every assistant gets. */
export function aiCheckQuestion(i: Pick<AiCheckInput, "category" | "city">): string {
  const where = i.city ? ` in ${i.city}` : "";
  return `Which are the best ${i.category}${where}? Recommend a few by name and say briefly why.`;
}

/** Assistant name shown to the visitor, from the OpenRouter model id ("openai/…" → ChatGPT). */
export function assistantName(model: string): string {
  const v = model.split("/")[0];
  return v === "openai" ? "ChatGPT" : v === "google" ? "Gemini" : v === "perplexity" ? "Perplexity" : v === "anthropic" ? "Claude" : v === "x-ai" ? "Grok" : model;
}

/** Models asked: AI_VISIBILITY_TOOL_MODELS, else ChatGPT (the site's own OpenAI model), Gemini and Perplexity. */
export function aiCheckModels(env: Record<string, string | undefined> = process.env): string[] {
  const list = (env.AI_VISIBILITY_TOOL_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (list.length) return [...new Set(list)].slice(0, 3);
  const openai = getOpenRouterVisibilityModels().find((m) => m.startsWith("openai/")) ?? "openai/gpt-6.1-sol";
  return [openai, "google/gemini-3.8-flash", "perplexity/sonar"];
}

/** Daily spend cap for this tool, in USD micros. "0" switches the tool off. */
export function aiCheckDailyCapMicros(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_VISIBILITY_TOOL_DAILY_USD ?? "3");
  return Math.round((Number.isFinite(n) && n >= 0 ? n : 3) * 1_000_000);
}

export interface AssistantResult {
  assistant: string;
  named: boolean;
  /** 1-based place in the answer's list when named in a list, else null. */
  position: number | null;
  /** Other businesses the answer names (up to 5). */
  others: string[];
  /** A short quote around the mention, or the start of the answer. */
  excerpt: string;
  ok: boolean;
}

export interface AiCheckResult {
  question: string;
  business: string;
  results: AssistantResult[];
  namedCount: number;
  asked: number;
  /** 0–100: share of assistants that named the business (weighted up for a top-3 place). */
  score: number;
  checkedAt: string;
  cached: boolean;
}

const clean = (s: string) =>
  s
    .replace(/\[(\d+)\]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Label words AI answers use inside lists ("**Why go:**", "Must-try", "Location") — never business names. */
const LABELS =
  /^(why( go| visit| it stands out)?|what to (try|order|get)|must[- ]?(try|haves?)|best for|known for|famous for|specialt(y|ies)|signature|location|address|area|price|prices|cost|budget|timings?|hours|rating|ratings|highlights?|tips?|note|notes|pros|cons|overall|summary|top picks?|recommendations?|options|bonus|also|other|honou?rable mentions?|conclusion|here are|in short|verdict)\b/i;

/** The name part of a list line or heading: "**Sugar Story** – great cakes" → "Sugar Story". */
function itemName(line: string): string {
  const t = clean(line).replace(/^(\d+[.)]|[-•*])\s*/, "");
  const cut = t.split(/\s[–—-]\s|:\s|:$|\s\(|,\s|\s\|\s/)[0] ?? t;
  return cut.slice(0, 60).trim();
}

const looksLikeName = (n: string) => n.length >= 2 && n.length <= 60 && /^[\p{Lu}\p{N}]/u.test(n) && !LABELS.test(n) && n.split(/\s+/).length <= 7;

/**
 * Businesses an answer names, in order: markdown headings ("### 1. Sugar Story"), top-level list items ("1. …" or
 * "- **Sugar Story** – …", not indented sub-points) and bold names inside paragraphs. Labels like "Why go:" are skipped.
 */
export function namedInAnswer(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, "    ");
    const heading = /^#{1,4}\s+(.+)$/.exec(line);
    const item = /^(\d+[.)]|[-•*])\s+\S/.test(line); // top level only: no leading spaces
    if (heading) out.push(itemName(heading[1]!));
    else if (item) {
      const bold = /\*\*([^*]{2,60})\*\*/.exec(line);
      out.push(itemName(bold ? bold[1]! : line));
    } else if (!/^\s/.test(line)) {
      for (const m of line.matchAll(/\*\*([^*]{2,60})\*\*/g)) if (!/:\s*$/.test(m[1]!)) out.push(itemName(m[1]!));
    }
  }
  const seen = new Set<string>();
  return out.filter((n) => {
    const k = n.toLowerCase();
    if (!looksLikeName(n) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Pure: read one answer for the business. Exported for tests. */
export function analyseAnswer(text: string, business: string): Omit<AssistantResult, "assistant" | "ok"> {
  const named = termRegex(business).test(text);
  const names = namedInAnswer(text);
  let position: number | null = null;
  if (named) {
    const idx = names.findIndex((n) => termRegex(business).test(n));
    position = idx >= 0 ? idx + 1 : null;
  }
  const others = names.filter((n) => !termRegex(business).test(n)).slice(0, 5);
  let excerpt = "";
  const flat = clean(text);
  const m = termRegex(business).exec(flat);
  if (m) {
    const start = Math.max(0, m.index - 80);
    excerpt = `${start > 0 ? "…" : ""}${flat.slice(start, m.index + business.length + 120).trim()}…`;
  } else {
    excerpt = flat.length > 200 ? `${flat.slice(0, 200).trim()}…` : flat;
  }
  return { named, position, others, excerpt };
}

/** 0–100 from the per-assistant results: named = 1, named in the top 3 = 1, else 0.5 for a mention lower down. */
export function aiCheckScore(results: Pick<AssistantResult, "named" | "position" | "ok">[]): number {
  const asked = results.filter((r) => r.ok);
  if (!asked.length) return 0;
  const pts = asked.reduce((s, r) => s + (r.named ? (r.position === null || r.position <= 3 ? 1 : 0.6) : 0), 0);
  return Math.round((pts / asked.length) * 100);
}

/* ------------------------------------------------------------------ cache + daily cap */

const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; result: AiCheckResult }>();
const cacheKey = (i: AiCheckInput) => [i.business, i.category, i.city].map((s) => s.toLowerCase()).join("|");

export class AiCheckBusyError extends Error {}

async function spentTodayMicros(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const r = await db.toolUse
    .aggregate({ where: { tool: AI_CHECK_TOOL, createdAt: { gte: start } }, _sum: { aiCostMicros: true } })
    .catch(() => null);
  return r?._sum.aiCostMicros ?? 0;
}

/**
 * Ask every assistant (in parallel, each with its own timeout). Throws AiCheckBusyError when the tool's daily cap
 * is used up or no AI provider is configured. `onCost` reports each call's real cost (for the usage log).
 */
export async function runAiVisibilityCheck(input: AiCheckInput, onCost: (micros: number, model: string) => void = () => {}): Promise<AiCheckResult> {
  const key = cacheKey(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.result, cached: true };

  if (!isOpenRouterConfigured()) throw new AiCheckBusyError("not configured");
  const cap = aiCheckDailyCapMicros();
  if (cap === 0 || (await spentTodayMicros()) >= cap) throw new AiCheckBusyError("daily cap");

  const question = aiCheckQuestion(input);
  const models = aiCheckModels();
  const results = await Promise.all(
    models.map(async (model): Promise<AssistantResult> => {
      const assistant = assistantName(model);
      try {
        const answer = await createOpenRouterProvider(model).run({ promptId: "free-ai-check", text: question, locale: "en-IN" });
        onCost(answer.costMicros, model);
        return { assistant, ok: true, ...analyseAnswer(answer.answerText, input.business) };
      } catch (e) {
        console.warn(`[ai-check] ${model} failed`, (e as Error)?.name ?? "error");
        return { assistant, ok: false, named: false, position: null, others: [], excerpt: "" };
      }
    }),
  );
  if (!results.some((r) => r.ok)) throw new AiCheckBusyError("all failed");

  const result: AiCheckResult = {
    question,
    business: input.business,
    results,
    namedCount: results.filter((r) => r.ok && r.named).length,
    asked: results.filter((r) => r.ok).length,
    score: aiCheckScore(results),
    checkedAt: new Date().toISOString(),
    cached: false,
  };
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), result });
  return result;
}
