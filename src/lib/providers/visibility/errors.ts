import { JobError } from "@/lib/types";

/** Classify an HTTP status / network error into a JobError (transient = retryable). */
export function providerError(provider: string, status: number | undefined, detail?: string): JobError {
  const transient = status === undefined || status === 408 || status === 429 || status >= 500;
  return new JobError(`${provider} request failed${status ? ` (${status})` : ""}${detail ? `: ${detail.slice(0, 200)}` : ""}`, transient ? "transient" : "permanent");
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new JobError(`${label} timed out after ${ms}ms`, "transient")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
