// Minimal fetch wrapper for FIXED Google API hosts only. Tokens are never sent anywhere else, never logged, and
// never included in error messages.
export const GOOGLE_HOSTS = new Set([
  "oauth2.googleapis.com",
  "www.googleapis.com",
  "searchconsole.googleapis.com",
  "analyticsadmin.googleapis.com",
  "analyticsdata.googleapis.com",
]);

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BODY_CHARS = 20_000_000;

export type GoogleErrorKind = "auth" | "quota" | "permission" | "bad_request" | "unavailable" | "error";

export class GoogleApiError extends Error {
  constructor(public status: number, public kind: GoogleErrorKind, message: string, public reason?: string) {
    super(message);
    this.name = "GoogleApiError";
  }
}

function classify(status: number, reason: string | undefined, message: string): GoogleErrorKind {
  const r = `${reason ?? ""} ${message}`.toLowerCase();
  if (status === 401 || r.includes("invalid_grant") || r.includes("invalid_token") || r.includes("unauthenticated")) return "auth";
  if (status === 429 || r.includes("quota") || r.includes("ratelimit") || r.includes("rate limit") || r.includes("resource_exhausted")) return "quota";
  if (status === 403) return "permission";
  if (status === 400) return "bad_request";
  if (status >= 500 || status === 0) return "unavailable";
  return "error";
}

/** Extracts a short, token-free message from a Google error body (OAuth or API shape). */
function errorFrom(status: number, data: unknown): GoogleApiError {
  let reason: string | undefined;
  let message = `Google returned HTTP ${status}`;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string") {
      reason = d.error; // OAuth endpoint shape: {error, error_description}
      if (typeof d.error_description === "string") message = d.error_description;
    } else if (d.error && typeof d.error === "object") {
      const e = d.error as Record<string, unknown>;
      if (typeof e.message === "string") message = e.message;
      if (typeof e.status === "string") reason = e.status;
      const first = Array.isArray(e.errors) ? (e.errors[0] as Record<string, unknown> | undefined) : undefined;
      if (first && typeof first.reason === "string") reason = first.reason;
    }
  }
  return new GoogleApiError(status, classify(status, reason, message), message.slice(0, 300), reason);
}

export interface GoogleRequest {
  method?: "GET" | "POST";
  accessToken?: string;
  json?: unknown;
  form?: Record<string, string>;
  timeoutMs?: number;
}

export async function googleFetch<T = unknown>(url: string, o: GoogleRequest = {}): Promise<T> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !GOOGLE_HOSTS.has(u.hostname)) throw new Error(`Refusing to call non-Google host ${u.hostname}`);
  const headers: Record<string, string> = { accept: "application/json" };
  let body: string | undefined;
  if (o.accessToken) headers.authorization = `Bearer ${o.accessToken}`;
  if (o.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(o.form).toString();
  } else if (o.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(o.json);
  }
  let res: Response;
  try {
    res = await fetch(u, {
      method: o.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(o.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new GoogleApiError(0, "unavailable", timeout ? "Google didn't respond in time" : "Couldn't reach Google");
  }
  const text = await res.text();
  if (text.length > MAX_BODY_CHARS) throw new GoogleApiError(res.status, "error", "Google response too large");
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) throw errorFrom(res.status, data);
  return data as T;
}
