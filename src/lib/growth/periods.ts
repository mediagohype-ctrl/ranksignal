// Calendar helpers for growth messages (all UTC; India is UTC+5:30).

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO-8601 week key, e.g. "2026-W45" (weeks start Monday; week 1 contains the year's first Thursday). */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7; // Mon=1 … Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - dow); // Thursday of this week decides the year
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Minutes after midnight in India (IST, UTC+5:30, no daylight saving). */
export function istMinutes(d: Date): number {
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
}

/** Day of week in India: 0 = Sunday … 6 = Saturday. */
export function istDay(d: Date): number {
  return new Date(d.getTime() + 330 * 60_000).getUTCDay();
}

/** Customer messages go out 9:00–20:59 India time only (no WhatsApp pings at midnight). */
export function isSendingHour(d: Date): boolean {
  const m = istMinutes(d);
  return m >= 9 * 60 && m < 21 * 60;
}

/** Monday morning (India) or later on Monday — the weekly emails' send day. */
export function isWeeklySendDay(d: Date): boolean {
  return istDay(d) === 1 && isSendingHour(d);
}
