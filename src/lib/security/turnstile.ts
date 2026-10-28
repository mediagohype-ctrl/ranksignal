// Cloudflare Turnstile server-side verification. Optional: disabled (always passes) when TURNSTILE_SECRET_KEY is unset.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || typeof token !== "string" || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      console.warn(`[turnstile] verify failed: HTTP ${res.status}`);
      return false;
    }
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return data?.success === true;
  } catch (err) {
    // Fail closed: when Turnstile is configured but unreachable we don't let the request through.
    console.warn(`[turnstile] verify error: ${err instanceof Error ? err.name : "error"}`);
    return false;
  }
}
