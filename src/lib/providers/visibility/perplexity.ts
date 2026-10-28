// Perplexity Sonar API (OpenAI-compatible chat completions with built-in web search).
import { JobError, type ProviderAnswer, type VisibilityProvider, type VisibilityQuery } from "@/lib/types";
import { estimatePerplexityCostMicros } from "@/lib/providers/pricing";
import { assertAiBudget, noteAiSpend } from "@/lib/billing/ai-budget";
import { providerError, withTimeout } from "./errors";
import { describeLocale } from "./locale";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const TIMEOUT_MS = 90_000;
export const DEFAULT_PERPLEXITY_MODEL = "sonar";
export const PERPLEXITY_LIMITATIONS =
  "API answers can differ from the Perplexity app (account personalisation, Pro Search and model selection).";

export function getPerplexityModel(): string {
  return process.env.PERPLEXITY_MODEL?.trim() || DEFAULT_PERPLEXITY_MODEL;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Exported for tests. Prefers `search_results[]` {url,title}; falls back to `citations[]` URL strings. */
export function parsePerplexityResponse(payload: unknown): {
  text: string;
  citations: { url: string; title?: string }[];
  inputTokens: number;
  outputTokens: number;
  reportedCostUsd?: number;
  model?: string;
} {
  const root = isObj(payload) ? payload : {};
  const choice = arr(root.choices)[0];
  const msg = isObj(choice) && isObj(choice.message) ? choice.message : {};
  const raw = typeof msg.content === "string" ? msg.content : "";
  // Reasoning models prefix their answer with <think>…</think>; that is not part of the answer.
  const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const citations: { url: string; title?: string }[] = [];
  const seen = new Set<string>();
  const add = (url: unknown, title?: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    citations.push({ url, title: typeof title === "string" && title.trim() ? title.trim() : undefined });
  };
  for (const r of arr(root.search_results)) if (isObj(r)) add(r.url, r.title);
  for (const c of arr(root.citations)) add(c);

  const usage = isObj(root.usage) ? root.usage : {};
  const cost = isObj(usage.cost) ? usage.cost : null;
  return {
    text,
    citations,
    inputTokens: num(usage.prompt_tokens),
    outputTokens: num(usage.completion_tokens),
    reportedCostUsd: cost && typeof cost.total_cost === "number" ? cost.total_cost : undefined,
    model: typeof root.model === "string" ? root.model : undefined,
  };
}

export const perplexityVisibilityProvider: VisibilityProvider = {
  id: "perplexity",
  label: "Perplexity (Sonar API)",
  simulated: false,
  isConfigured: () => Boolean(process.env.PERPLEXITY_API_KEY?.trim()),
  async run(query: VisibilityQuery): Promise<ProviderAnswer> {
    const key = process.env.PERPLEXITY_API_KEY?.trim();
    if (!key) throw new JobError("Perplexity is not configured", "permanent");
    const model = getPerplexityModel();
    const { country } = describeLocale(query.locale);
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: query.text }],
      max_tokens: 1500,
    };
    if (country) body.web_search_options = { user_location: { country } };

    await assertAiBudget();
    let res: Response;
    try {
      res = await withTimeout(
        fetch(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
        TIMEOUT_MS + 1000,
        "perplexity",
      );
    } catch (err) {
      if (err instanceof JobError) throw err;
      throw providerError("perplexity", undefined, (err as Error)?.name);
    }
    if (!res.ok) throw providerError("perplexity", res.status);
    const payload = (await res.json().catch(() => null)) as unknown;
    const parsed = parsePerplexityResponse(payload);
    if (!parsed.text) throw new JobError("perplexity returned no answer text", "transient");
    const costMicros =
      parsed.reportedCostUsd !== undefined
        ? Math.round(parsed.reportedCostUsd * 1_000_000)
        : estimatePerplexityCostMicros(model, parsed.inputTokens, parsed.outputTokens);
    noteAiSpend(costMicros);
    return {
      provider: "perplexity",
      platformLabel: "Perplexity (Sonar API)",
      model: parsed.model ?? model,
      answerText: parsed.text,
      citations: parsed.citations,
      rawPayloadRef: isObj(payload) && typeof payload.id === "string" ? payload.id : undefined,
      costMicros,
      simulated: false,
      limitations: PERPLEXITY_LIMITATIONS,
    };
  },
};
