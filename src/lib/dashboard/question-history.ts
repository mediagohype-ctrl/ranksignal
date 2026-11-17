// "Over time" on a question's page: one row per AI check, and never two rows that read the same.
// Pure (no I/O), so it is unit-tested.

export interface HistoryRun {
  id: string;
  at: Date;
}

export interface HistoryObservation {
  visibilityRunId: string;
  provider: string;
  brandMentioned: boolean;
  simulated: boolean;
}

export interface HistoryRow {
  id: string;
  at: Date;
  /** AI tools that named the business in this check. */
  named: number;
  /** AI tools asked in this check. */
  total: number;
}

/**
 * One row per AI check that asked this question, oldest first.
 *   - Sample (simulated) answers are left out.
 *   - A check that was retried can hold two answers from the same AI tool; each tool is counted once (it "named
 *     you" if any of its answers did), so a check never shows "0 of 4" for 2 tools.
 *   - Two checks on the same day would print as two identical-looking rows ("29 Oct 2026 · 0 of 2" twice), so only
 *     the latest check of each day is kept. `dayKey` turns a date into the day shown to the owner (their time zone).
 */
export function questionHistory(runs: HistoryRun[], observations: HistoryObservation[], dayKey: (d: Date) => string): HistoryRow[] {
  const byRun = new Map<string, Map<string, boolean>>();
  for (const o of observations) {
    if (o.simulated) continue;
    const tools = byRun.get(o.visibilityRunId) ?? new Map<string, boolean>();
    tools.set(o.provider, (tools.get(o.provider) ?? false) || o.brandMentioned);
    byRun.set(o.visibilityRunId, tools);
  }
  const seenRun = new Set<string>();
  const latestOfDay = new Map<string, HistoryRow>();
  for (const r of runs) {
    const tools = byRun.get(r.id);
    if (!tools || tools.size === 0 || seenRun.has(r.id)) continue;
    seenRun.add(r.id);
    const row: HistoryRow = { id: r.id, at: r.at, named: [...tools.values()].filter(Boolean).length, total: tools.size };
    const key = dayKey(r.at);
    const cur = latestOfDay.get(key);
    if (!cur || cur.at.getTime() < r.at.getTime()) latestOfDay.set(key, row);
  }
  return [...latestOfDay.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}
