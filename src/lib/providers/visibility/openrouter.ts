// One visibility provider per OpenRouter model (default: a GPT model and Claude Opus), each answering the
// buyer question with OpenRouter's web search plugin so answers carry real cited sources.
import { JobError, type ProviderAnswer, type VisibilityProvider, type VisibilityQuery } from "@/lib/types";
import {
  getOpenRouterVisibilityModels,
  isOpenRouterConfigured,
  openRouterChat,
  parseOpenRouterResponse,
  platformFor,
} from "@/lib/providers/openrouter-client";
import { describeLocale } from "./locale";

const TIMEOUT_MS = 120_000;

/** "native" = the model vendor's own search (closest to the real apps); "exa" = cheaper OpenRouter search. */
export function getWebEngine(): "native" | "exa" {
  return process.env.OPENROUTER_WEB_ENGINE?.trim() === "exa" ? "exa" : "native";
}
export const OPENROUTER_LIMITATIONS =
  "Answered through the OpenRouter API with web search available; like the real apps, the model decides whether to search, so answers without sources come from its built-in knowledge. Consumer apps (ChatGPT, Claude.ai) can still answer differently because of personalisation.";

/** Stable provider id per model, e.g. "openrouter:anthropic/claude-opus-5.5". */
export const openRouterProviderId = (model: string) => `openrouter:${model}`;

export function createOpenRouterProvider(model: string): VisibilityProvider {
  const label = `${platformFor(model)} (OpenRouter · ${model}, web search)`;
  return {
    id: openRouterProviderId(model),
    label,
    simulated: false,
    isConfigured: isOpenRouterConfigured,
    async run(query: VisibilityQuery): Promise<ProviderAnswer> {
      const { country } = describeLocale(query.locale);
      const payload = await openRouterChat(
        {
          model,
          messages: [
            // A neutral location hint only; the question itself is sent verbatim like a real user would ask it.
            ...(country ? [{ role: "system", content: `The user is located in country code ${country}.` }] : []),
            { role: "user", content: query.text },
          ],
          // engine must be explicit: without it some models (e.g. Claude) may answer without searching.
          plugins: [{ id: "web", engine: getWebEngine(), max_results: 5 }],
          max_tokens: 3000,
          reasoning: { effort: "low", exclude: true },
        },
        TIMEOUT_MS,
      );
      const parsed = parseOpenRouterResponse(payload);
      if (!parsed.text) throw new JobError(`${model} returned no answer text`, "transient");
      return {
        provider: openRouterProviderId(model),
        platformLabel: label,
        model: parsed.model ?? model,
        answerText: parsed.text,
        citations: parsed.citations,
        rawPayloadRef: parsed.id,
        // OpenRouter reports the real charged cost (tokens + web search) in usage.cost.
        costMicros: parsed.costUsd !== undefined ? Math.round(parsed.costUsd * 1_000_000) : 0,
        simulated: false,
        limitations: OPENROUTER_LIMITATIONS,
      };
    },
  };
}

export function getOpenRouterProviders(): VisibilityProvider[] {
  return getOpenRouterVisibilityModels().map(createOpenRouterProvider);
}
