// Shared helpers for admin pages: search-param parsing, pagination, date ranges and formatting.

export type SearchParams = Record<string, string | string[] | undefined>;
export const MAX_PAGE_SIZE = 100;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function str(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function oneOf<T extends string>(sp: SearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = str(sp, key);
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function pageParams(sp: SearchParams, defaultSize = 50) {
  const page = Math.max(1, Math.floor(Number(str(sp, "page")) || 1));
  const size = Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(Number(str(sp, "size")) || defaultSize)));
  return { page, size, skip: (page - 1) * size, take: size };
}

/** Parses YYYY-MM-DD (UTC). `endOfDay` returns the exclusive end (next midnight). */
export function dateParam(sp: SearchParams, key: string, endOfDay = false): Date | undefined {
  const v = str(sp, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return endOfDay ? new Date(d.getTime() + DAY_MS) : d;
}

export function dateRangeWhere(sp: SearchParams, fromKey = "from", toKey = "to") {
  const gte = dateParam(sp, fromKey);
  const lt = dateParam(sp, toKey, true);
  return gte || lt ? { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } : undefined;
}

export const RANGES = ["7", "30", "90"] as const;
export type RangeKey = (typeof RANGES)[number];

export function rangeParam(sp: SearchParams, fallback: RangeKey = "30") {
  const key = oneOf(sp, "range", RANGES, fallback);
  const days = Number(key);
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);
  const prevSince = new Date(now.getTime() - 2 * days * DAY_MS);
  return { key, days, now, since, prevSince };
}

export function utcDayStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Build a query string from the current params with overrides (empty/undefined values dropped). */
export function qs(sp: SearchParams, overrides: Record<string, string | number | undefined | null> = {}): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) out.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === null || v === "") out.delete(k);
    else out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** Percent change (null when there is no baseline). */
export function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function fmtAgo(d: Date | null | undefined, now = Date.now()): string {
  if (!d) return "—";
  const s = Math.round((now - d.getTime()) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const v =
    a < 60 ? `${a}s` : a < 3600 ? `${Math.round(a / 60)}m` : a < 86400 ? `${Math.round(a / 3600)}h` : `${Math.round(a / 86400)}d`;
  return future ? `in ${v}` : `${v} ago`;
}

export function fmtNum(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-IN");
}

/** Fill missing days with zeros so charts have a continuous x-axis (keys are YYYY-MM-DD, UTC). */
export function dayKeys(since: Date, until = new Date()): string[] {
  const keys: string[] = [];
  for (let t = utcDayStart(since).getTime(); t <= until.getTime(); t += DAY_MS) keys.push(new Date(t).toISOString().slice(0, 10));
  return keys;
}
