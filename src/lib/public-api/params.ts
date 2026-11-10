// Query-parameter parsing for the public API (pure). Bad input is a 400 invalid_request, never a silent default.
import { HttpError } from "@/lib/api";

/** Opaque pagination cursor: base64url JSON. Callers must treat it as a string and pass it back unchanged. */
export function encodeCursor(v: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(v), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === "") return null;
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new HttpError(400, "invalid_cursor", "cursor is not valid; pass back the nextCursor value unchanged");
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new HttpError(400, "invalid_cursor", "cursor is not valid; pass back the nextCursor value unchanged");
}

/** Keyset cursor {t: ISO time, i: id}. */
export function decodeKeysetCursor(raw: string | null): { t: Date; i: string } | null {
  const c = decodeCursor(raw);
  if (!c) return null;
  const t = typeof c.t === "string" ? new Date(c.t) : null;
  if (!t || Number.isNaN(t.getTime()) || typeof c.i !== "string" || !c.i || c.i.length > 64) {
    throw new HttpError(400, "invalid_cursor", "cursor is not valid; pass back the nextCursor value unchanged");
  }
  return { t, i: c.i };
}

/** Offset cursor {o: n}. */
export function decodeOffsetCursor(raw: string | null): number {
  const c = decodeCursor(raw);
  if (!c) return 0;
  if (typeof c.o !== "number" || !Number.isInteger(c.o) || c.o < 0 || c.o > 100_000) {
    throw new HttpError(400, "invalid_cursor", "cursor is not valid; pass back the nextCursor value unchanged");
  }
  return c.o;
}

export function parseLimit(raw: string | null, def: number, max: number): number {
  if (raw === null || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new HttpError(400, "invalid_request", `limit must be a whole number from 1 to ${max}`);
  return n;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => ymd(new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS));

function validDate(d: string): boolean {
  return DATE_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && ymd(new Date(`${d}T00:00:00Z`)) === d;
}

/**
 * Inclusive UTC date range from ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults: `to` = yesterday (UTC),
 * `from` = `to` minus (defaultDays - 1). At most maxDays days.
 */
export function parseDateRange(q: URLSearchParams, defaultDays: number, maxDays = 366, now = new Date()): { from: string; to: string } {
  const toRaw = q.get("to");
  const fromRaw = q.get("from");
  if (toRaw !== null && !validDate(toRaw)) throw new HttpError(400, "invalid_request", "to must be a date like 2026-10-01");
  if (fromRaw !== null && !validDate(fromRaw)) throw new HttpError(400, "invalid_request", "from must be a date like 2026-10-01");
  const to = toRaw ?? ymd(new Date(now.getTime() - DAY_MS));
  const from = fromRaw ?? addDays(to, -(defaultDays - 1));
  if (from > to) throw new HttpError(400, "invalid_request", "from must be on or before to");
  const days = (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;
  if (days > maxDays) throw new HttpError(400, "invalid_request", `Choose at most ${maxDays} days`);
  return { from, to };
}

/** One of `allowed`, or undefined when absent. */
export function parseEnum<T extends string>(raw: string | null, allowed: readonly T[], name: string): T | undefined {
  if (raw === null || raw === "") return undefined;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  throw new HttpError(400, "invalid_request", `${name} must be one of: ${allowed.join(", ")}`);
}
