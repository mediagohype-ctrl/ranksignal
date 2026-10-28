// Typed browser fetch helper for our JSON API envelope ({item} | {items} | {error:{code,message}}).
export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError(0, "network_error", "Network error — check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiClientError(
      res.status,
      e?.code ?? `http_${res.status}`,
      e?.message ?? (res.status === 401 ? "Your session has expired. Please sign in again." : `Request failed (${res.status})`),
      e?.details,
    );
  }
  return data as T;
}

/** Human-readable message for any thrown value (for toasts / inline errors). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
    const fields = details?.fieldErrors ? Object.entries(details.fieldErrors).filter(([, v]) => v?.length) : [];
    if (fields.length) return `${err.message}: ${fields.map(([k, v]) => `${k} — ${v[0]}`).join("; ")}`;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
