// OpenRouter (OpenAI-compatible chat completions; one key for GPT, Claude and other models).
// Shared by the visibility adapter and the structured-generation helper. Never logs keys or prompts.
import { assertAiBudget, noteAiSpend } from "@/lib/billing/ai-budget";
import { JobError } from "@/lib/types";
import { providerError, withTimeout } from "./visibility/errors";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_OPENROUTER_VISIBILITY_MODELS = ["openai/gpt-6.1-sol", "anthropic/claude-opus-5.5"];
export const DEFAULT_OPENROUTER_ANALYSIS_MODELS = ["anthropic/claude-opus-5.5", "openai/gpt-6.1-sol"];

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function modelList(raw: string | undefined, fallback: string[]): string[] {
  const list = (raw ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return list.length ? [...new Set(list)] : fallback;
}

export function getOpenRouterVisibilityModels(): string[] {
  return modelList(process.env.OPENROUTER_VISIBILITY_MODELS, DEFAULT_OPENROUTER_VISIBILITY_MODELS);
}

export function getOpenRouterAnalysisModels(): string[] {
  return modelList(process.env.OPENROUTER_ANALYSIS_MODELS, DEFAULT_OPENROUTER_ANALYSIS_MODELS);
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * POST a chat completion. Throws JobError (transient for 408/429/5xx/network; quota when the global daily
 * AI budget is spent — checked before every request).
 */
export async function openRouterChat(body: Json, timeoutMs: number): Promise<unknown> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new JobError("OpenRouter is not configured", "permanent");
  await assertAiBudget();
  let res: Response;
  try {
    res = await withTimeout(
      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
          "X-Title": "RankSignal",
        },
        // usage.include asks OpenRouter to return the real charged cost.
        body: JSON.stringify({ ...body, usage: { include: true } }),
        signal: AbortSignal.timeout(timeoutMs),
      }),
      timeoutMs + 1000,
      "openrouter",
    );
  } catch (err) {
    if (err instanceof JobError) throw err;
    throw providerError("openrouter", undefined, (err as Error)?.name);
  }
  if (!res.ok) {
    // OpenRouter error bodies carry a short message (e.g. "insufficient credits"); safe to surface.
    const detail = await res.json().then((j: unknown) => (isObj(j) && isObj(j.error) ? String(j.error.message ?? "") : "")).catch(() => "");
    throw providerError("openrouter", res.status, detail);
  }
  const payload = (await res.json().catch(() => null)) as unknown;
  // Upstream provider errors can arrive with HTTP 200 and an `error` object.
  if (isObj(payload) && isObj(payload.error)) {
    const code = num(payload.error.code);
    throw providerError("openrouter", code || 502, String(payload.error.message ?? ""));
  }
  const cost = isObj(payload) && isObj(payload.usage) ? payload.usage.cost : undefined;
  if (typeof cost === "number") noteAiSpend(cost * 1_000_000);
  return payload;
}

/** Exported for tests. Text, url_citation annotations, usage and the real cost when reported. */
export function parseOpenRouterResponse(payload: unknown): {
  text: string;
  citations: { url: string; title?: string }[];
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  model?: string;
  id?: string;
} {
  const root = isObj(payload) ? payload : {};
  const choice = arr(root.choices)[0];
  const msg = isObj(choice) && isObj(choice.message) ? choice.message : {};
  const content = typeof msg.content === "string" ? msg.content : "";
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const citations: { url: string; title?: string }[] = [];
  const seen = new Set<string>();
  for (const a of arr(msg.annotations)) {
    const c = isObj(a) && isObj(a.url_citation) ? a.url_citation : null;
    const url = c && typeof c.url === "string" ? c.url : null;
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    citations.push({ url, title: typeof c!.title === "string" && c!.title.trim() ? c!.title.trim() : undefined });
  }

  const usage = isObj(root.usage) ? root.usage : {};
  return {
    text,
    citations,
    inputTokens: num(usage.prompt_tokens),
    outputTokens: num(usage.completion_tokens),
    costUsd: typeof usage.cost === "number" ? usage.cost : undefined,
    model: typeof root.model === "string" ? root.model : undefined,
    id: typeof root.id === "string" ? root.id : undefined,
  };
}

/** Friendly platform name for a model id, e.g. "anthropic/claude-opus-5.5" → "Claude". */
export function platformFor(model: string): string {
  const vendor = model.split("/")[0];
  if (vendor === "openai") return "ChatGPT-style answer";
  if (vendor === "anthropic") return "Claude-style answer";
  if (vendor === "google") return "Gemini-style answer";
  if (vendor === "perplexity") return "Perplexity-style answer";
  return "AI answer";
}
