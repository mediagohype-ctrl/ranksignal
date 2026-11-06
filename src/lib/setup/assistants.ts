// Names of the AI assistants a plan's checks ask, for plain-English copy ("We'll ask ChatGPT, Gemini and Claude").
import { getEngineLimit } from "@/lib/billing/plans";
import { getOpenRouterVisibilityModels } from "@/lib/providers/openrouter-client";

const VENDOR_NAMES: Record<string, string> = {
  openai: "ChatGPT",
  google: "Gemini",
  anthropic: "Claude",
  perplexity: "Perplexity",
  "x-ai": "Grok",
};
const DEFAULT_ORDER = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"];

export function assistantNamesForPlan(planId: string, serviceTier?: string | null): string[] {
  const configured = process.env.OPENROUTER_API_KEY
    ? [...new Set(getOpenRouterVisibilityModels().map((m) => VENDOR_NAMES[m.split("/")[0] ?? ""]).filter((n): n is string => !!n))]
    : [];
  const names = configured.length ? configured : DEFAULT_ORDER;
  return names.slice(0, Math.max(1, getEngineLimit(planId, serviceTier)));
}

export { joinNames } from "./names";
