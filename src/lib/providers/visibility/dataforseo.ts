// DataForSEO AI Optimization — LLM Responses (ChatGPT) live endpoint. Response shapes vary by
// model/version, so parsing is defensive: collect any text + url-bearing annotations we can find.
import { JobError, type ProviderAnswer, type VisibilityProvider, type VisibilityQuery } from "@/lib/types";
import { assertAiBudget, noteAiSpend } from "@/lib/billing/ai-budget";
import { providerError, withTimeout } from "./errors";

const ENDPOINT = "https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live";
const TIMEOUT_MS = 90_000;
export const DATAFORSEO_LIMITATIONS =
  "Collected via DataForSEO's LLM Responses API; answers come from the model API and can differ from the consumer ChatGPT UI.";

function model(): string {
  return process.env.DATAFORSEO_MODEL?.trim() || "gpt-4o-mini";
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Exported for tests: extract answer text + citations from a DataForSEO payload. */
export function parseDataForSeoPayload(payload: unknown): { text: string; citations: { url: string; title?: string }[]; costUsd: number; modelName?: string } {
  const texts: string[] = [];
  const citations: { url: string; title?: string }[] = [];
  const seen = new Set<string>();
  const addCitation = (c: unknown) => {
    if (!isObj(c) || typeof c.url !== "string" || !/^https?:\/\//i.test(c.url) || seen.has(c.url)) return;
    seen.add(c.url);
    citations.push({ url: c.url, title: typeof c.title === "string" ? c.title : undefined });
  };
  const root = isObj(payload) ? payload : {};
  const costUsd = typeof root.cost === "number" ? root.cost : 0;
  let modelName: string | undefined;
  for (const task of arr(root.tasks)) {
    if (!isObj(task)) continue;
    for (const result of arr(task.result)) {
      if (!isObj(result)) continue;
      if (typeof result.model_name === "string") modelName = result.model_name;
      for (const item of arr(result.items)) {
        if (!isObj(item)) continue;
        if (typeof item.text === "string") texts.push(item.text);
        arr(item.annotations).forEach(addCitation);
        for (const section of arr(item.sections)) {
          if (!isObj(section)) continue;
          if (typeof section.text === "string") texts.push(section.text);
          arr(section.annotations).forEach(addCitation);
        }
      }
      arr(result.sources).forEach(addCitation);
    }
  }
  return { text: texts.join("\n\n").trim(), citations, costUsd, modelName };
}

export const dataForSeoVisibilityProvider: VisibilityProvider = {
  id: "dataforseo",
  label: "DataForSEO LLM Responses (ChatGPT)",
  simulated: false,
  isConfigured: () => Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
  async run(query: VisibilityQuery): Promise<ProviderAnswer> {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new JobError("DataForSEO is not configured", "permanent");
    // Owner cost protection: refuse once today's global AI spend reaches the budget (throws JobError "quota").
    await assertAiBudget();
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    let res: Response;
    try {
      res = await withTimeout(
        fetch(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify([{ user_prompt: query.text, model_name: model(), web_search: true }]),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
        TIMEOUT_MS + 1000,
        "dataforseo",
      );
    } catch (err) {
      if (err instanceof JobError) throw err;
      throw providerError("dataforseo", undefined, (err as Error)?.name);
    }
    if (!res.ok) throw providerError("dataforseo", res.status);
    const payload = (await res.json().catch(() => null)) as unknown;
    const root = isObj(payload) ? payload : {};
    const taskStatus = isObj(arr(root.tasks)[0]) ? (arr(root.tasks)[0] as Json).status_code : undefined;
    if (typeof taskStatus === "number" && taskStatus !== 20000) {
      // 40xxx = client error, 50xxx = provider error.
      throw new JobError(`dataforseo task status ${taskStatus}`, taskStatus >= 50000 ? "transient" : "permanent");
    }
    const parsed = parseDataForSeoPayload(payload);
    const costMicros = Math.round(parsed.costUsd * 1_000_000);
    // Record the provider-reported cost even when the answer turns out empty (the request was still billed).
    noteAiSpend(costMicros);
    if (!parsed.text) throw new JobError("dataforseo returned no answer text", "transient");
    const m = parsed.modelName ?? model();
    return {
      provider: "dataforseo",
      platformLabel: `ChatGPT-style answer (DataForSEO, ${m})`,
      model: m,
      answerText: parsed.text,
      citations: parsed.citations,
      costMicros,
      simulated: false,
      limitations: DATAFORSEO_LIMITATIONS,
    };
  },
};
