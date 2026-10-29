// Tiny JSON fetch helper for the off-site tracker (surfaces the API's first field error as the message).
export async function offsiteApi<T>(url: string, init?: RequestInit & { body?: string }): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; details?: unknown } };
  if (!res.ok) {
    const fe = (data.error?.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
    const first = fe ? Object.entries(fe).find(([, v]) => v?.length) : undefined;
    throw new Error(first ? `${first[0]}: ${first[1][0]}` : (data.error?.message ?? "Something went wrong"));
  }
  return data as T;
}
