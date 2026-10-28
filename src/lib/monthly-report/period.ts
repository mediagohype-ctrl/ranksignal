// Period helpers. Reports use UTC calendar months: [1st 00:00 UTC, next 1st 00:00 UTC).
// For clients in India (IST = UTC+5:30) a month therefore starts at 05:30 IST on the 1st; the report says so.

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const PERIOD_TIMEZONE_NOTE =
  "Months run on UTC calendar boundaries (in India, from 05:30 IST on the 1st to 05:30 IST on the 1st of the next month).";

export function isValidPeriod(p: unknown): p is string {
  return typeof p === "string" && PERIOD_RE.test(p);
}

export function periodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** UTC range for "YYYY-MM"; `end` is exclusive. Throws on a malformed period. */
export function periodRange(period: string): { start: Date; end: Date } {
  const m = PERIOD_RE.exec(period);
  if (!m) throw new Error(`Invalid period "${period}" (expected YYYY-MM)`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { start: new Date(Date.UTC(y, mo, 1)), end: new Date(Date.UTC(y, mo + 1, 1)) };
}

export function previousPeriod(now: Date = new Date()): string {
  return periodOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

export function periodLabel(period: string): string {
  const m = PERIOD_RE.exec(period);
  if (!m) return period;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** True when `period` has fully ended at `now` (reports are only generated for finished months). */
export function isPeriodClosed(period: string, now: Date = new Date()): boolean {
  return periodRange(period).end.getTime() <= now.getTime();
}
