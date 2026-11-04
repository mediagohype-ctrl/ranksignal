// Formatting + JSON-column helpers shared by app pages (safe for server and client).
export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/**
 * Times are stored in UTC and shown in the user's time zone (User.timeZone). Server pages pass
 * getUserTimeZone(session) (src/lib/dashboard/tz.ts); client components use useTimeZone()
 * (src/components/app/time-zone.tsx). Without a zone we use India time, never the machine's zone — so the server
 * render and the browser show the same time for the same check.
 */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const zoneOf = (tz: string | null | undefined) => (isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE);

export interface FmtDateOptions {
  withTime?: boolean;
  timeZone?: string | null;
}

const toDate = (d: Date | string | number | null | undefined): Date | null => {
  if (d === null || d === undefined || d === "") return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "4 Nov 2026" (or "4 Nov 2026, 02:30 pm" with time) in the given zone. Second arg: withTime flag or options. */
export function fmtDate(d: Date | string | number | null | undefined, opts: boolean | FmtDateOptions = false, timeZone?: string | null): string {
  const date = toDate(d);
  if (!date) return "—";
  const o = typeof opts === "boolean" ? { withTime: opts, timeZone } : { ...opts, timeZone: opts.timeZone ?? timeZone };
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: zoneOf(o.timeZone),
    ...(o.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function fmtDateTime(d: Date | string | number | null | undefined, timeZone?: string | null): string {
  return fmtDate(d, { withTime: true, timeZone });
}

/** Just the time of day, e.g. "02:30 pm", in the given zone. */
export function fmtTime(d: Date | string | number | null | undefined, timeZone?: string | null): string {
  const date = toDate(d);
  if (!date) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: zoneOf(timeZone) });
}

/**
 * "just now", "5m ago", "3h ago"; older than a week falls back to the date in the user's zone. `now` is injectable
 * for tests.
 */
export function fmtRelative(d: Date | string | number | null | undefined, timeZone?: string | null, now: number = Date.now()): string {
  const date = toDate(d);
  if (!date) return "—";
  const s = Math.round((now - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(date, false, timeZone);
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/[_.-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function asArray<T = string>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function asRecord<T = unknown>(v: unknown): Record<string, T> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, T>) : {};
}

export const ACTIVE_RUN_STATUSES = ["queued", "preflight", "running", "retry_scheduled", "validating"];
export function isActiveStatus(s: string): boolean {
  return ACTIVE_RUN_STATUSES.includes(s);
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
