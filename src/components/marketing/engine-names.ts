// Which AI tools each offer checks, in words — built from the plan limits so the website can never claim more than
// the app does. Pure (no db), safe for server pages, client components and tests.
import { MAX_ENGINES, PUBLIC_PLAN_IDS, getEngineLimit } from "@/lib/billing/plans";

/** AI tools in the order checks use them (same order as the provider registry): the first N = a plan's limit. */
export const ENGINE_ORDER = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Grok"] as const;

/** "A", "A and B", "A, B and C". */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Names of the AI tools a plan checks, e.g. ["ChatGPT", "Gemini", "Perplexity"] for Do it myself. */
export function engineNamesFor(planId: string, serviceTier?: string | null): string[] {
  return ENGINE_ORDER.slice(0, Math.max(1, getEngineLimit(planId, serviceTier)));
}

/** "ChatGPT, Gemini and Perplexity" — what Do it myself (the public self-serve plan) checks. */
export const SELF_ENGINE_LIST = listWords(engineNamesFor(PUBLIC_PLAN_IDS[0]));

/** How many AI tools Do it for me checks (all of them). */
export const DFY_ENGINE_COUNT = Math.min(MAX_ENGINES, ENGINE_ORDER.length);

/** Footer line: what we measure on each offer, truthfully. */
export const ENGINES_MEASURED_LINE = `Measures answers from ${SELF_ENGINE_LIST} on Do it myself, and up to ${DFY_ENGINE_COUNT} AI tools on Do it for me.`;
