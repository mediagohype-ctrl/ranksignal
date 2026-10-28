// Minimal Google Gemini API client (plain fetch). The key travels in the x-goog-api-key header — never in
// the URL — so it can't leak into logs of request URLs. Never log the key or request bodies.
import { JobError } from "@/lib/types";
import { providerError, withTimeout } from "./visibility/errors";

export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export interface GeminiUsage {
  inputTokens: number;
  /** Visible output + thinking tokens (both billed as output). */
  outputTokens: number;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Text of the first candidate (thought parts excluded), finish reason and token usage. */
export function readGeminiCandidate(payload: unknown): { text: string; finishReason?: string; usage: GeminiUsage; candidate: Json | null } {
  const root = isObj(payload) ? payload : {};
  const cand = arr(root.candidates)[0];
  const candidate = isObj(cand) ? cand : null;
  const parts = candidate && isObj(candidate.content) ? arr(candidate.content.parts) : [];
  const text = parts
    .filter((p): p is Json => isObj(p) && typeof p.text === "string" && p.thought !== true)
    .map((p) => p.text as string)
    .join("")
    .trim();
  const um = isObj(root.usageMetadata) ? root.usageMetadata : {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    text,
    finishReason: candidate && typeof candidate.finishReason === "string" ? candidate.finishReason : undefined,
    usage: { inputTokens: num(um.promptTokenCount), outputTokens: num(um.candidatesTokenCount) + num(um.thoughtsTokenCount) },
    candidate,
  };
}

/** POST models/{model}:generateContent. Throws classified JobErrors (transient = retryable). */
export async function geminiGenerateContent(model: string, body: Record<string, unknown>, timeoutMs = 90_000): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new JobError("Gemini is not configured", "permanent");
  let res: Response;
  try {
    res = await withTimeout(
      fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      }),
      timeoutMs + 1000,
      "gemini",
    );
  } catch (err) {
    if (err instanceof JobError) throw err;
    throw providerError("gemini", undefined, (err as Error)?.name);
  }
  if (!res.ok) {
    // Google error bodies contain a short status string (e.g. RESOURCE_EXHAUSTED) — safe to surface, no secrets.
    const errBody = (await res.json().catch(() => null)) as unknown;
    const status = isObj(errBody) && isObj(errBody.error) && typeof errBody.error.status === "string" ? errBody.error.status : undefined;
    throw providerError("gemini", res.status, status);
  }
  return (await res.json().catch(() => null)) as unknown;
}
