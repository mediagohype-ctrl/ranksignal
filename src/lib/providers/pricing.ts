// APPROXIMATE public list prices, used only to estimate costMicros (micro-USD) for usage reporting.
// Not a billing source of truth — provider invoices are. Versioned so stored costs can be reinterpreted.
// Prices change often: update the table and bump the version together.

export const PROVIDER_PRICE_TABLE_VERSION = "provider-prices-2026-10-approx";

/** micro-USD per 1M tokens (USD/1M tokens × 1e6). Matched by longest model-name prefix. */
export const GEMINI_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash-lite": { input: 100_000, output: 400_000 },
  "gemini-2.5-flash": { input: 300_000, output: 2_500_000 },
  "gemini-2.5-pro": { input: 1_250_000, output: 10_000_000 },
  "gemini-2.0-flash": { input: 100_000, output: 400_000 },
};
/** Grounding with Google Search: ~USD 35 per 1,000 grounded prompts once beyond any free allowance. */
export const GEMINI_GROUNDING_CALL_MICROS = 35_000;

export const PERPLEXITY_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "sonar-reasoning-pro": { input: 2_000_000, output: 8_000_000 },
  "sonar-reasoning": { input: 1_000_000, output: 5_000_000 },
  "sonar-pro": { input: 3_000_000, output: 15_000_000 },
  sonar: { input: 1_000_000, output: 1_000_000 },
};
/** Per-request search fee (low search context), micro-USD. */
export const PERPLEXITY_REQUEST_MICROS: Record<string, number> = {
  "sonar-pro": 6_000,
  sonar: 5_000,
};

function byPrefix<T>(table: Record<string, T>, model: string, fallback: string): T {
  const key = Object.keys(table)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.startsWith(k));
  return table[key ?? fallback];
}

export function estimateGeminiCostMicros(model: string, inputTokens = 0, outputTokens = 0, grounded = false): number {
  const p = byPrefix(GEMINI_PRICES_PER_MTOK, model, "gemini-2.5-flash");
  return Math.round((inputTokens * p.input + outputTokens * p.output) / 1_000_000) + (grounded ? GEMINI_GROUNDING_CALL_MICROS : 0);
}

export function estimatePerplexityCostMicros(model: string, inputTokens = 0, outputTokens = 0): number {
  const p = byPrefix(PERPLEXITY_PRICES_PER_MTOK, model, "sonar");
  const fee = byPrefix(PERPLEXITY_REQUEST_MICROS, model, "sonar") ?? 5_000;
  return Math.round((inputTokens * p.input + outputTokens * p.output) / 1_000_000) + fee;
}

// ---------- Pre-call estimates (daily AI budget reservations, src/lib/billing/ai-budget.ts) ----------
// Deliberately on the HIGH side: a call is only made when its estimate fits in what's left of today's budget,
// so an estimate below the real cost could let spend creep past the cap.

/** Rough token count for text we send (≈3 characters per token; overestimates English slightly). */
export function roughTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Extra input tokens a web-searching call pulls in (search results are fed to the model). */
export const SEARCH_CONTEXT_TOKENS = 10_000;

/** OpenRouter models vary; estimate with a high per-token price unless OPENROUTER_CALL_ESTIMATE_USD sets a flat figure. */
export const OPENROUTER_ESTIMATE_PRICES_PER_MTOK = { input: 5_000_000, output: 25_000_000 };
export const OPENROUTER_WEB_SEARCH_MICROS = 20_000;

export function estimateOpenRouterCallMicros(body: Record<string, unknown>): number {
  const flat = Number(process.env.OPENROUTER_CALL_ESTIMATE_USD);
  if (Number.isFinite(flat) && flat > 0) return Math.round(flat * 1_000_000);
  const web = Array.isArray(body.plugins) && body.plugins.length > 0;
  const input = roughTokens(JSON.stringify(body.messages ?? "")) + (web ? SEARCH_CONTEXT_TOKENS : 0);
  const output = typeof body.max_tokens === "number" ? body.max_tokens : 4_000;
  const p = OPENROUTER_ESTIMATE_PRICES_PER_MTOK;
  return Math.round((input * p.input + output * p.output) / 1_000_000) + (web ? OPENROUTER_WEB_SEARCH_MICROS : 0);
}

export function estimateGeminiCallMicros(model: string, body: Record<string, unknown>): number {
  const grounded = JSON.stringify(body.tools ?? "").includes("google_search");
  const cfg = (body.generationConfig ?? {}) as { maxOutputTokens?: unknown };
  const output = typeof cfg.maxOutputTokens === "number" ? cfg.maxOutputTokens : 8_192;
  const input = roughTokens(JSON.stringify(body.contents ?? "") + JSON.stringify(body.systemInstruction ?? "")) + (grounded ? SEARCH_CONTEXT_TOKENS : 0);
  return estimateGeminiCostMicros(model, input, output, grounded);
}

export function estimatePerplexityCallMicros(model: string, inputText: string, maxTokens: number): number {
  return estimatePerplexityCostMicros(model, roughTokens(inputText) + SEARCH_CONTEXT_TOKENS, maxTokens);
}

/** DataForSEO LLM Responses bills per task (plus the model's tokens); flat high estimate. */
export const DATAFORSEO_CALL_ESTIMATE_MICROS = 50_000;

/** DataForSEO SERP (Google organic live/advanced + async AI Overview ≈ USD 0.004; AI Mode live ≈ USD 0.004). High estimates. */
export const DATAFORSEO_SERP_AIO_ESTIMATE_MICROS = 20_000;
export const DATAFORSEO_SERP_AI_MODE_ESTIMATE_MICROS = 20_000;
