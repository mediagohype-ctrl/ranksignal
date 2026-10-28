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
