// Google PageSpeed Insights API v5 client (free; optional PAGESPEED_API_KEY raises the quota).
// Google fetches the customer's page from its own servers, so the only host we contact is www.googleapis.com
// (allow-listed through the SSRF-safe client). The key is sent as a query parameter and never logged or stored.
import { safeRequestJson } from "@/lib/net/safe-request";
import { SafeFetchError } from "@/lib/crawler/safe-fetch";
import type { FieldScope, PsiStrategy } from "@/lib/pagespeed/types";

export const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_HOSTS = ["www.googleapis.com"];
/** A Lighthouse run commonly takes 10–40 s; allow for slow sites. */
const PSI_TIMEOUT_MS = 100_000;
/** Performance-only responses are a few hundred KB; full reports can reach several MB. */
const PSI_MAX_BYTES = 12 * 1024 * 1024;

export interface PsiMetrics {
  performanceScore: number | null;
  labLcpMs: number | null;
  labCls: number | null;
  labTbtMs: number | null;
  labFcpMs: number | null;
  fieldLcpMs: number | null;
  fieldInpMs: number | null;
  fieldCls: number | null;
  fieldFcpMs: number | null;
  fieldScope: FieldScope | null;
}

export type PsiOutcome =
  | { ok: true; metrics: PsiMetrics }
  /** transient = worth retrying (rate limit, Google-side 5xx, timeout); otherwise the page can't be tested. */
  | { ok: false; error: string; transient: boolean };

export function psiConfigured(): boolean {
  return !!process.env.PAGESPEED_API_KEY?.trim();
}

/** Request URL for one test. Exported for tests; never log its return value (it can carry the key). */
export function psiRequestUrl(pageUrl: string, strategy: PsiStrategy, apiKey?: string | null): string {
  const u = new URL(PSI_ENDPOINT);
  u.searchParams.set("url", pageUrl);
  u.searchParams.set("strategy", strategy);
  u.searchParams.set("category", "performance");
  if (apiKey) u.searchParams.set("key", apiKey);
  return u.toString();
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

function fieldMetrics(exp: Record<string, unknown> | null) {
  const m = obj(exp?.metrics);
  if (!m) return null;
  const p = (k: string) => num(obj(m[k])?.percentile);
  const lcp = p("LARGEST_CONTENTFUL_PAINT_MS");
  const inp = p("INTERACTION_TO_NEXT_PAINT");
  const clsRaw = p("CUMULATIVE_LAYOUT_SHIFT_SCORE"); // CrUX reports CLS × 100
  const fcp = p("FIRST_CONTENTFUL_PAINT_MS");
  if (lcp === null && inp === null && clsRaw === null && fcp === null) return null;
  return {
    lcp: lcp === null ? null : Math.round(lcp),
    inp: inp === null ? null : Math.round(inp),
    cls: clsRaw === null ? null : Math.round(clsRaw) / 100,
    fcp: fcp === null ? null : Math.round(fcp),
  };
}

/** Pure: PSI v5 JSON → the numbers we store. Returns an error string when Lighthouse couldn't test the page. */
export function parsePsiResponse(json: unknown): { metrics: PsiMetrics } | { error: string } {
  const root = obj(json);
  if (!root) return { error: "Empty response from PageSpeed Insights" };
  const lh = obj(root.lighthouseResult);
  const runtimeError = obj(lh?.runtimeError);
  const audits = obj(lh?.audits) ?? {};
  const audit = (k: string) => num(obj(audits[k])?.numericValue);
  const perf = num(obj(obj(lh?.categories)?.performance)?.score);

  const page = obj(root.loadingExperience);
  const pageField = page && page.origin_fallback !== true ? fieldMetrics(page) : null;
  const originField = fieldMetrics(obj(root.originLoadingExperience)) ?? (page?.origin_fallback === true ? fieldMetrics(page) : null);
  const field = pageField ?? originField;

  const metrics: PsiMetrics = {
    performanceScore: perf === null ? null : Math.round(perf * 100),
    labLcpMs: int(audit("largest-contentful-paint")),
    labCls: audit("cumulative-layout-shift") === null ? null : Math.round(audit("cumulative-layout-shift")! * 1000) / 1000,
    labTbtMs: int(audit("total-blocking-time")),
    labFcpMs: int(audit("first-contentful-paint")),
    fieldLcpMs: field?.lcp ?? null,
    fieldInpMs: field?.inp ?? null,
    fieldCls: field?.cls ?? null,
    fieldFcpMs: field?.fcp ?? null,
    fieldScope: pageField ? "url" : originField ? "origin" : null,
  };
  const hasLab = metrics.performanceScore !== null || metrics.labLcpMs !== null;
  if (!hasLab && !field) {
    const code = typeof runtimeError?.code === "string" ? runtimeError.code : null;
    const msg = typeof runtimeError?.message === "string" ? runtimeError.message : null;
    return { error: (msg ?? code ?? "PageSpeed Insights returned no measurements").slice(0, 300) };
  }
  return { metrics };
}

/** Google API error body → short message (never includes the request URL or key). */
function apiError(data: unknown, status: number): string {
  const e = obj(obj(data)?.error);
  const msg = typeof e?.message === "string" ? e.message.replace(/key=[^&\s]+/gi, "key=[redacted]") : null;
  return `PageSpeed Insights error ${status}${msg ? `: ${msg.slice(0, 240)}` : ""}`;
}

/** Run one PSI test. Never throws. */
export async function runPsi(pageUrl: string, strategy: PsiStrategy): Promise<PsiOutcome> {
  const key = process.env.PAGESPEED_API_KEY?.trim() || null;
  try {
    const res = await safeRequestJson(psiRequestUrl(pageUrl, strategy, key), {
      method: "GET",
      allowedHosts: PSI_HOSTS,
      timeoutMs: PSI_TIMEOUT_MS,
      maxBytes: PSI_MAX_BYTES,
    });
    if (!res.ok) {
      // 429 = quota, 5xx = Google side. 400/500 with a Lighthouse error usually means the page itself failed to load.
      const transient = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
      return { ok: false, error: apiError(res.data, res.status), transient };
    }
    const parsed = parsePsiResponse(res.data);
    if ("error" in parsed) return { ok: false, error: parsed.error, transient: false };
    return { ok: true, metrics: parsed.metrics };
  } catch (err) {
    const e = err instanceof SafeFetchError ? err : null;
    return { ok: false, error: e ? `PageSpeed Insights request failed (${e.code})` : "PageSpeed Insights request failed", transient: !e || !e.permanent };
  }
}
