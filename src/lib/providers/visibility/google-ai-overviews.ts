// Google AI Overviews + Google AI Mode via the DataForSEO SERP API (behind DATAFORSEO_LOGIN/PASSWORD).
//  - AI Overviews: POST /v3/serp/google/organic/live/advanced with load_async_ai_overview=true; the SERP may or may not
//    contain an item of type "ai_overview".
//  - AI Mode:      POST /v3/serp/google/ai_mode/live/advanced; the answer is an "ai_overview" item.
// The ai_overview item carries markdown/text, nested elements (ai_overview_element …) and references
// ({ source, domain, url, title, text }). Parsing is defensive. When Google shows no AI Overview we still store an
// observation (brand not mentioned) with a clear note, because "no overview for this question" is a real result.
import { JobError, type ProviderAnswer, type VisibilityProvider, type VisibilityQuery } from "@/lib/types";
import { reserveAiSpend } from "@/lib/billing/ai-budget";
import { DATAFORSEO_SERP_AI_MODE_ESTIMATE_MICROS, DATAFORSEO_SERP_AIO_ESTIMATE_MICROS } from "@/lib/providers/pricing";
import { providerError, withTimeout } from "./errors";
import { describeLocale } from "./locale";

const BASE = "https://api.dataforseo.com/v3/serp/google";
const TIMEOUT_MS = 120_000;

export const GOOGLE_AIO_PROVIDER_ID = "google_aio";
export const GOOGLE_AI_MODE_PROVIDER_ID = "google_ai_mode";
export const GOOGLE_AIO_LABEL = "Google AI Overviews";
export const GOOGLE_AI_MODE_LABEL = "Google AI Mode";
/** Stored as the answer when Google showed no AI Overview for the search. */
export const NO_AI_OVERVIEW_TEXT = "Google showed no AI Overview for this search.";

export const GOOGLE_AIO_LIMITATIONS =
  "Collected from a live Google search (desktop, no personalisation) via DataForSEO's SERP API. AI Overviews appear only for some searches and change often.";
export const GOOGLE_AI_MODE_LIMITATIONS =
  "Collected from Google AI Mode via DataForSEO's SERP API (desktop, no personalisation). Answers change often.";

/** SERP-based engines: they answer search queries, not open conversation (e.g. skipped by the brand-knowledge probe). */
export function isSerpProviderId(id: string): boolean {
  return id === GOOGLE_AIO_PROVIDER_ID || id === GOOGLE_AI_MODE_PROVIDER_ID;
}

/** Google Ads / DataForSEO location codes for common countries; others fall back to location_name. */
const LOCATION_CODES: Record<string, number> = {
  IN: 2356, US: 2840, GB: 2826, AE: 2784, SG: 2702, AU: 2036, CA: 2124, DE: 2276, FR: 2250, NZ: 2554, IE: 2372, ZA: 2710,
};

/** Locale → DataForSEO location + language fields (defaults: India, English). Exported for tests. */
export function serpLocation(locale: string | undefined): Record<string, string | number> {
  const l = describeLocale(locale);
  const language_code = l.language ?? "en";
  const country = l.country ?? "IN";
  if (LOCATION_CODES[country]) return { location_code: LOCATION_CODES[country], language_code };
  if (l.countryName && l.countryName !== country) return { location_name: l.countryName.replace(/^the\s+/i, ""), language_code };
  return { location_code: LOCATION_CODES.IN, language_code };
}

/** DataForSEO decodes %## in keywords, so a literal % or + must be sent as %25 / %2B (max 700 characters). */
export function serpKeyword(text: string): string {
  return text.trim().slice(0, 600).replace(/%/g, "%25").replace(/\+/g, "%2B");
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

export interface ParsedAiOverview {
  /** An ai_overview item was present in the results. */
  shown: boolean;
  text: string;
  citations: { url: string; title?: string }[];
  /** Distinct cited domains, in order of first appearance. */
  domains: string[];
  costUsd: number;
  /** Google signalled an asynchronous overview that DataForSEO couldn't load. */
  asyncUnloaded: boolean;
}

/** Exported for tests: find the AI Overview in a DataForSEO SERP payload (organic or AI Mode). */
export function parseAiOverviewPayload(payload: unknown): ParsedAiOverview {
  const root = isObj(payload) ? payload : {};
  const costUsd = typeof root.cost === "number" ? root.cost : 0;
  const texts: string[] = [];
  const citations: { url: string; title?: string }[] = [];
  const seen = new Set<string>();
  let shown = false;
  let asyncUnloaded = false;

  const addRef = (r: unknown) => {
    if (!isObj(r)) return;
    const url = str(r.url);
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    citations.push({ url, title: str(r.title) ?? str(r.source) });
  };
  const walkElement = (el: unknown, depth: number) => {
    if (!isObj(el) || depth > 4) return;
    const t = str(el.markdown) ?? str(el.text);
    if (t && depth > 0) texts.push(t);
    arr(el.references).forEach(addRef);
    arr(el.links).forEach(addRef);
    for (const c of [...arr(el.items), ...arr(el.components)]) walkElement(c, depth + 1);
  };

  for (const task of arr(root.tasks)) {
    if (!isObj(task)) continue;
    for (const result of arr(task.result)) {
      if (!isObj(result)) continue;
      for (const item of arr(result.items)) {
        if (!isObj(item) || item.type !== "ai_overview") continue;
        shown = true;
        if (item.asynchronous_ai_overview === true && !arr(item.items).length && !str(item.markdown)) asyncUnloaded = true;
        const top = str(item.markdown) ?? str(item.text);
        if (top) texts.push(top);
        arr(item.references).forEach(addRef);
        // Nested elements carry the text when the top-level markdown is absent, and their own references.
        const before = texts.length;
        for (const el of arr(item.items)) walkElement(el, 1);
        if (top) texts.splice(before); // top-level markdown already contains the nested text
      }
    }
  }
  const domains: string[] = [];
  for (const c of citations) {
    try {
      const d = new URL(c.url).hostname.replace(/^www\./, "");
      if (!domains.includes(d)) domains.push(d);
    } catch {
      /* ignore */
    }
  }
  return { shown, text: texts.join("\n\n").trim(), citations, domains, costUsd, asyncUnloaded };
}

function credentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  return login && password ? { login, password } : null;
}

async function callSerp(endpoint: string, task: Record<string, unknown>, estimateMicros: number, id: string): Promise<{ payload: unknown; costMicros: number }> {
  const creds = credentials();
  if (!creds) throw new JobError("DataForSEO is not configured", "permanent");
  const hold = await reserveAiSpend(estimateMicros);
  const auth = Buffer.from(`${creds.login}:${creds.password}`).toString("base64");
  let res: Response;
  try {
    res = await withTimeout(
      fetch(`${BASE}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify([task]),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      TIMEOUT_MS + 1000,
      id,
    );
  } catch (err) {
    hold.release();
    if (err instanceof JobError) throw err;
    throw providerError(id, undefined, (err as Error)?.name);
  }
  if (!res.ok) {
    hold.release();
    throw providerError(id, res.status);
  }
  const payload = (await res.json().catch(() => null)) as unknown;
  const root = isObj(payload) ? payload : {};
  const first = arr(root.tasks)[0];
  const taskStatus = isObj(first) ? first.status_code : undefined;
  if (typeof taskStatus === "number" && taskStatus !== 20000) {
    hold.release();
    throw new JobError(`${id} task status ${taskStatus}`, taskStatus >= 50000 ? "transient" : "permanent");
  }
  const costMicros = Math.round((typeof root.cost === "number" ? root.cost : 0) * 1_000_000);
  // Billed even when Google showed no overview: record the provider-reported cost.
  hold.settle(costMicros);
  return { payload, costMicros };
}

function toAnswer(id: string, label: string, parsed: ParsedAiOverview, costMicros: number, baseLimitations: string): ProviderAnswer {
  const noOverview = !parsed.shown;
  const text = noOverview
    ? NO_AI_OVERVIEW_TEXT
    : parsed.text || (parsed.asyncUnloaded ? "Google showed an AI Overview, but its text could not be loaded." : "Google showed an AI Overview without readable text.");
  return {
    provider: id,
    platformLabel: label,
    model: id === GOOGLE_AIO_PROVIDER_ID ? "google-search" : "google-ai-mode",
    answerText: text,
    citations: noOverview ? [] : parsed.citations,
    costMicros,
    simulated: false,
    limitations: noOverview ? `${NO_AI_OVERVIEW_TEXT} ${baseLimitations}` : baseLimitations,
  };
}

const configured = () => credentials() !== null;

export const googleAiOverviewsProvider: VisibilityProvider = {
  id: GOOGLE_AIO_PROVIDER_ID,
  label: GOOGLE_AIO_LABEL,
  simulated: false,
  isConfigured: configured,
  async run(query: VisibilityQuery): Promise<ProviderAnswer> {
    const { payload, costMicros } = await callSerp(
      "organic/live/advanced",
      { keyword: serpKeyword(query.text), ...serpLocation(query.locale), device: "desktop", depth: 10, load_async_ai_overview: true },
      DATAFORSEO_SERP_AIO_ESTIMATE_MICROS,
      GOOGLE_AIO_PROVIDER_ID,
    );
    return toAnswer(GOOGLE_AIO_PROVIDER_ID, GOOGLE_AIO_LABEL, parseAiOverviewPayload(payload), costMicros, GOOGLE_AIO_LIMITATIONS);
  },
};

export const googleAiModeProvider: VisibilityProvider = {
  id: GOOGLE_AI_MODE_PROVIDER_ID,
  label: GOOGLE_AI_MODE_LABEL,
  simulated: false,
  isConfigured: configured,
  async run(query: VisibilityQuery): Promise<ProviderAnswer> {
    const { payload, costMicros } = await callSerp(
      "ai_mode/live/advanced",
      { keyword: serpKeyword(query.text), ...serpLocation(query.locale), device: "desktop" },
      DATAFORSEO_SERP_AI_MODE_ESTIMATE_MICROS,
      GOOGLE_AI_MODE_PROVIDER_ID,
    );
    const parsed = parseAiOverviewPayload(payload);
    if (!parsed.shown) throw new JobError("google_ai_mode returned no answer", "transient");
    return toAnswer(GOOGLE_AI_MODE_PROVIDER_ID, GOOGLE_AI_MODE_LABEL, parsed, costMicros, GOOGLE_AI_MODE_LIMITATIONS);
  },
};
