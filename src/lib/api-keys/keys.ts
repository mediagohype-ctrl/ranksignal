// API key format and hashing (pure; no I/O). Keys look like "mwr_<43 base64url chars>" (256 random bits).
// Only the SHA-256 hash and a short display prefix are stored; the full key is shown once when it is created.
import { createHash, randomBytes } from "node:crypto";

export const API_KEY_PREFIX = "mwr_";
/** Characters of the key kept for display ("mwr_" + 8), enough to tell keys apart, far too few to guess the rest. */
export const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8;
const KEY_RE = /^mwr_[A-Za-z0-9_-]{43}$/;

/** Scopes a key can carry. Only "read" exists for now (there are no write endpoints yet). */
export const API_SCOPES = ["read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export interface GeneratedApiKey {
  /** The full secret. Show once, never store or log. */
  key: string;
  prefix: string;
  hash: string;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function displayPrefix(key: string): string {
  return key.slice(0, DISPLAY_PREFIX_LENGTH);
}

export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: displayPrefix(key), hash: hashApiKey(key) };
}

/** Cheap syntactic check before touching the database. */
export function looksLikeApiKey(v: string): boolean {
  return KEY_RE.test(v);
}

/**
 * The API key from an `Authorization: Bearer mwr_…` header (case-insensitive scheme), or null.
 * `X-API-Key: mwr_…` is accepted too, for tools that cannot set Authorization (e.g. some no-code clients).
 */
export function apiKeyFromHeaders(headers: Pick<Headers, "get">): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(auth.trim());
    return m ? m[1] : null;
  }
  const x = headers.get("x-api-key")?.trim();
  return x || null;
}

/** Key name typed by an admin: trimmed, 1–60 printable characters. */
export function normalizeKeyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= 60 ? name : null;
}
