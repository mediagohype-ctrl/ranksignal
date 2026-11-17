// The visitor's own last free-check score, kept in this browser tab (sessionStorage) so the sign-up page can say
// "Your score: 61. Let's get it to 75." Results are not stored on the server, so this is the only honest source:
// the sign-up page shows a score only when it came from a check of the same website in this tab, recently.
// Pure helpers (no React) so they can be unit-tested; storage access is wrapped because it can throw.

export const LAST_CHECK_KEY = "mwr:last-free-check";
/** A score older than this is not shown (the website may have changed). */
export const LAST_CHECK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface LastCheck {
  /** Host of the checked website, without "www." (e.g. "acme.example"). */
  host: string;
  /** Overall score 0–100, as shown on the result. */
  score: number;
  /** The score the free check said fixing its top fixes could reach (> score), or null when it gave none. */
  target: number | null;
  /** When the check finished (ms since epoch). */
  at: number;
}

/** "https://www.Acme.example/x" or "acme.example" → "acme.example"; null when it isn't a website address. */
export function hostOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!u.hostname.includes(".")) return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The record to save after a free check finishes, or null when there is no real score to save. */
export function lastCheckFrom(url: string, score: number | null, gain: number, now = Date.now()): LastCheck | null {
  const host = hostOf(url);
  if (!host || score === null || !Number.isFinite(score)) return null;
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const t = Math.min(100, s + Math.max(0, Math.round(Number.isFinite(gain) ? gain : 0)));
  return { host, score: s, target: t > s ? t : null, at: now };
}

/** Parses a stored record; anything malformed, too old or for another website gives null. */
export function readLastCheck(raw: string | null, website: string | null | undefined, now = Date.now()): LastCheck | null {
  const want = hostOf(website);
  if (!raw || !want) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const r = v as Partial<LastCheck>;
  if (typeof r.host !== "string" || r.host !== want) return null;
  if (typeof r.score !== "number" || !Number.isInteger(r.score) || r.score < 0 || r.score > 100) return null;
  if (typeof r.at !== "number" || now - r.at > LAST_CHECK_MAX_AGE_MS || r.at - now > 60_000) return null;
  const target = typeof r.target === "number" && Number.isInteger(r.target) && r.target > r.score && r.target <= 100 ? r.target : null;
  return { host: r.host, score: r.score, target, at: r.at };
}

/** "Your score: 61. Let's get it to 75." — or "Let's raise it." when the check gave no target. */
export function scoreHeadline(c: LastCheck): { score: string; goal: string } {
  return { score: `Your score: ${c.score}.`, goal: c.target !== null ? `Let's get it to ${c.target}.` : "Let's raise it." };
}

/** Browser-only: remember the result (best effort; private windows may block storage). */
export function rememberLastCheck(url: string, score: number | null, gain: number): void {
  const rec = lastCheckFrom(url, score, gain);
  if (!rec) return;
  try {
    window.sessionStorage.setItem(LAST_CHECK_KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked: the sign-up page just won't show a score */
  }
}

/** Browser-only: the remembered result for this website, or null. */
export function recallLastCheck(website: string | null | undefined): LastCheck | null {
  try {
    return readLastCheck(window.sessionStorage.getItem(LAST_CHECK_KEY), website);
  } catch {
    return null;
  }
}
