// Pure redirect-target helpers for the auth pages (no React), so they can be unit-tested.

/** True for paths a browser could treat as another host: "//x", "/\x" (after any amount of percent-decoding). */
function looksProtocolRelative(next: string): boolean {
  // Only the path matters here; the query may legitimately contain encoded URLs (e.g. ?website=https%3A%2F%2F…).
  let p = next.split(/[?#]/, 1)[0] ?? "";
  for (let i = 0; i < 4; i++) {
    if (!p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return true;
    let d: string;
    try {
      d = decodeURIComponent(p);
    } catch {
      return true; // malformed escapes in the path: refuse rather than guess
    }
    if (d === p) return false;
    p = d;
  }
  return true; // still changing after several decodes: suspicious nesting
}

/**
 * Only allow same-origin relative redirects. Blocks open redirects like //evil.com, /\evil.com, https://…,
 * their percent-encoded forms (/%2F%2Fevil.com, /%5Cevil.com) and control-character tricks ("/\t/evil.com").
 * Returns the normalised path+query+hash, or `fallback`.
 */
export function safeNext(next: string | null, fallback: string, origin?: string): string {
  if (!next || next.length > 2048) return fallback;
  // Browsers drop tabs/newlines inside URLs, which can turn "/\t/evil.com" into "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (looksProtocolRelative(next)) return fallback;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== new URL(base).origin) return fallback;
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The invitation token carried in a `next` of the form /accept-invite?token=… (used to claim an invited account). */
export function inviteTokenFromNext(next: string): string | undefined {
  try {
    const url = new URL(next, "http://localhost");
    if (url.pathname !== "/accept-invite") return undefined;
    const token = url.searchParams.get("token");
    return token && token.length >= 10 && token.length <= 4096 ? token : undefined;
  } catch {
    return undefined;
  }
}
