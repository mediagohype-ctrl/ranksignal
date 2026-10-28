// OpenAI Responses API with the hosted web_search tool. Approximates a ChatGPT-style answer;
// API answers can differ from the consumer ChatGPT UI (personalisation, model routing, UI search).
import { JobError, type ProviderAnswer, type VisibilityProvider, type VisibilityQuery } from "@/lib/types";
import { APPROX_WEB_SEARCH_CALL_MICROS, estimateCostMicros, getModel, getOpenAI, isOpenAIConfigured } from "@/lib/providers/llm";
import { providerError } from "./errors";

export const OPENAI_LIMITATIONS =
  "API answers can differ from the consumer ChatGPT UI (personalisation, model routing, location and search behaviour).";

function localeToCountry(locale: string): string | undefined {
  const m = /^[a-z]{2}[-_]([A-Za-z]{2})$/.exec(locale);
  return m ? m[1].toUpperCase() : undefined;
}

export const openaiVisibilityProvider: VisibilityProvider = {
  id: "openai",
  label: "OpenAI (web search)",
  simulated: false,
  isConfigured: () => isOpenAIConfigured(),
  async run(query: VisibilityQuery): Promise<ProviderAnswer> {
    const openai = getOpenAI();
    if (!openai) throw new JobError("OpenAI is not configured", "permanent");
    const model = getModel();
    const country = localeToCountry(query.locale);
    let res;
    try {
      res = await openai.responses.create({
        model,
        tools: [
          country
            ? { type: "web_search", user_location: { type: "approximate", country } }
            : { type: "web_search" },
        ],
        input: query.text,
        max_output_tokens: 1200,
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      throw providerError("openai", status, (err as Error)?.name);
    }

    const citations: { url: string; title?: string }[] = [];
    const seen = new Set<string>();
    for (const item of res.output ?? []) {
      if (item.type !== "message") continue;
      for (const part of item.content ?? []) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations ?? []) {
          if (a.type === "url_citation" && a.url && !seen.has(a.url)) {
            seen.add(a.url);
            citations.push({ url: a.url, title: a.title || undefined });
          }
        }
      }
    }
    const costMicros =
      estimateCostMicros(model, res.usage?.input_tokens, res.usage?.output_tokens) + APPROX_WEB_SEARCH_CALL_MICROS;
    return {
      provider: "openai",
      platformLabel: `ChatGPT-style answer (OpenAI API, ${model}, web search)`,
      model,
      answerText: res.output_text ?? "",
      citations,
      rawPayloadRef: res.id,
      costMicros,
      simulated: false,
      limitations: OPENAI_LIMITATIONS,
    };
  },
};
