// Google Gemini API with Grounding with Google Search. Answers come from the developer API and can
// differ from the Gemini app and Google AI Overviews.
import { JobError, type ProviderAnswer, type VisibilityProvider, type VisibilityQuery } from "@/lib/types";
import { geminiGenerateContent, getGeminiModel, isGeminiConfigured, readGeminiCandidate } from "@/lib/providers/gemini-client";
import { estimateGeminiCostMicros } from "@/lib/providers/pricing";
import { describeLocale } from "./locale";

export const GEMINI_LIMITATIONS = "API answers can differ from the Gemini app and Google AI Overviews.";
const TIMEOUT_MS = 90_000;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Exported for tests: answer text, grounding citations and usage from a generateContent payload.
 * Grounding chunk URIs are often vertexaisearch redirect URLs; the title then usually holds the source
 * domain, which `toCitations` (visibility/parse.ts) uses to attribute the citation.
 */
export function parseGeminiResponse(payload: unknown): {
  text: string;
  citations: { url: string; title?: string }[];
  grounded: boolean;
  inputTokens: number;
  outputTokens: number;
  modelVersion?: string;
  finishReason?: string;
} {
  const { text, usage, candidate, finishReason } = readGeminiCandidate(payload);
  const gm = candidate && isObj(candidate.groundingMetadata) ? candidate.groundingMetadata : null;
  const citations: { url: string; title?: string }[] = [];
  const seen = new Set<string>();
  for (const chunk of arr(gm?.groundingChunks)) {
    const web = isObj(chunk) && isObj(chunk.web) ? chunk.web : null;
    if (!web || typeof web.uri !== "string" || !/^https?:\/\//i.test(web.uri) || seen.has(web.uri)) continue;
    seen.add(web.uri);
    citations.push({ url: web.uri, title: typeof web.title === "string" && web.title.trim() ? web.title.trim() : undefined });
  }
  const queries = arr(gm?.webSearchQueries);
  const root = isObj(payload) ? payload : {};
  return {
    text,
    citations,
    grounded: Boolean(gm) && (citations.length > 0 || queries.length > 0),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    modelVersion: typeof root.modelVersion === "string" ? root.modelVersion : undefined,
    finishReason,
  };
}

export const geminiVisibilityProvider: VisibilityProvider = {
  id: "gemini",
  label: "Gemini (Google Search grounding)",
  simulated: false,
  isConfigured: () => isGeminiConfigured(),
  async run(query: VisibilityQuery): Promise<ProviderAnswer> {
    const model = getGeminiModel();
    const loc = describeLocale(query.locale);
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: query.text }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 4096 },
    };
    // The API has no user-location parameter for Search grounding; a neutral locale hint is the closest equivalent.
    if (loc.countryName) {
      body.systemInstruction = {
        parts: [{ text: `The user is located in ${loc.countryName}${loc.languageName ? ` and reads ${loc.languageName}` : ""}.` }],
      };
    }
    const payload = await geminiGenerateContent(model, body, TIMEOUT_MS);
    const parsed = parseGeminiResponse(payload);
    if (!parsed.text) {
      throw new JobError(
        `gemini returned no answer text${parsed.finishReason ? ` (${parsed.finishReason})` : ""}`,
        parsed.finishReason === "SAFETY" || parsed.finishReason === "PROHIBITED_CONTENT" ? "permanent" : "transient",
      );
    }
    return {
      provider: "gemini",
      platformLabel: `Gemini (API, ${model}, Google Search grounding)`,
      model: parsed.modelVersion ?? model,
      answerText: parsed.text,
      citations: parsed.citations,
      costMicros: estimateGeminiCostMicros(model, parsed.inputTokens, parsed.outputTokens, parsed.grounded),
      simulated: false,
      limitations: loc.countryName
        ? `${GEMINI_LIMITATIONS} Location is passed as a text hint (${loc.countryName}), not a precise user location.`
        : GEMINI_LIMITATIONS,
    };
  },
};
