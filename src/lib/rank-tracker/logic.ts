// Pure rank tracker logic: input cleaning, due rules, the DataForSEO task, position changes and summary numbers.
import { languageCode, locationById, locationFields, normaliseKeyword } from "@/lib/dataforseo/locations";
import { SERP_DEPTH, frequencyMs, type RankDevice, type RankFrequency } from "./limits";

const HOUR_MS = 60 * 60 * 1000;
/** Keywords become due an hour early so a daily check doesn't drift later by one scheduler tick every day. */
export const DUE_SLACK_MS = HOUR_MS;

/** Split a textarea / array into clean, de-duplicated keywords. Invalid lines are counted, not kept. */
export function cleanKeywordList(input: string[] | string, max: number): { keywords: string[]; invalid: number; overflow: number } {
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/);
  const seen = new Set<string>();
  const keywords: string[] = [];
  let invalid = 0;
  let overflow = 0;
  for (const line of lines) {
    if (typeof line !== "string" || !line.trim()) continue;
    const k = normaliseKeyword(line);
    if (!k) {
      invalid++;
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    if (keywords.length >= max) {
      overflow++;
      continue;
    }
    keywords.push(k);
  }
  return { keywords, invalid, overflow };
}

export function cleanDevice(v: unknown): RankDevice {
  return v === "desktop" ? "desktop" : "mobile";
}

/** A location id we know, else "All of India". */
export function cleanLocationId(v: unknown): string {
  return locationById(typeof v === "string" ? v : null).id;
}

/** Is this keyword due for its scheduled check? */
export function isKeywordDue(o: { lastCheckedAt: Date | null; frequency: RankFrequency; now: Date }): boolean {
  if (!o.lastCheckedAt) return true;
  return o.now.getTime() - o.lastCheckedAt.getTime() >= frequencyMs(o.frequency) - DUE_SLACK_MS;
}

/** The newest lastCheckedAt that still counts as due (for a DB query: lastCheckedAt null OR < cutoff). */
export function dueCutoff(frequency: RankFrequency, now: Date): Date {
  return new Date(now.getTime() - frequencyMs(frequency) + DUE_SLACK_MS);
}

/** When "Check now" may be used again (null = now). */
export function manualCheckAvailableAt(lastManualCheckAt: Date | null, minHours: number, now: Date): Date | null {
  if (!lastManualCheckAt) return null;
  const at = new Date(lastManualCheckAt.getTime() + minHours * HOUR_MS);
  return at.getTime() > now.getTime() ? at : null;
}

/** One DataForSEO SERP task for a tracked keyword. */
export function buildSerpTask(k: { keyword: string; locationId: string; device: string; language?: string | null }): Record<string, unknown> {
  const device = cleanDevice(k.device);
  return {
    keyword: k.keyword,
    ...locationFields(k.locationId),
    language_code: languageCode(k.language),
    device,
    os: device === "mobile" ? "android" : "windows",
    depth: SERP_DEPTH,
  };
}

/**
 * Change between two checks, as "places moved up" (positive = better). Not ranking counts as position 101 so that
 * entering / leaving the top 100 shows as a move. Null when there is no earlier check.
 */
export function positionChange(current: number | null, previous: number | null | undefined, hasPrevious: boolean): number | null {
  if (!hasPrevious) return null;
  const cur = current ?? 101;
  const prev = previous ?? 101;
  return prev - cur;
}

export interface SummaryInput {
  position: number | null;
  /** Has at least one check. */
  checked: boolean;
  /** Position change vs about a week ago (positive = moved up), null when unknown. */
  weekChange: number | null;
}

export interface RankSummary {
  tracked: number;
  checked: number;
  averagePosition: number | null;
  top3: number;
  top10: number;
  notRanking: number;
  movedUp: number;
  movedDown: number;
}

export function summarise(rows: SummaryInput[]): RankSummary {
  const checked = rows.filter((r) => r.checked);
  const ranked = checked.map((r) => r.position).filter((p): p is number => p !== null);
  return {
    tracked: rows.length,
    checked: checked.length,
    averagePosition: ranked.length ? Math.round((ranked.reduce((s, p) => s + p, 0) / ranked.length) * 10) / 10 : null,
    top3: ranked.filter((p) => p <= 3).length,
    top10: ranked.filter((p) => p <= 10).length,
    notRanking: checked.filter((r) => r.position === null).length,
    movedUp: checked.filter((r) => (r.weekChange ?? 0) > 0).length,
    movedDown: checked.filter((r) => (r.weekChange ?? 0) < 0).length,
  };
}

/** The check closest to (and not after) `at` from a list sorted newest first. */
export function checkAtOrBefore<T extends { checkedAt: Date }>(checks: T[], at: Date): T | undefined {
  return checks.find((c) => c.checkedAt.getTime() <= at.getTime());
}

const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface CsvRow {
  keyword: string;
  location: string;
  device: string;
  position: number | null;
  change: number | null;
  best: number | null;
  url: string | null;
  features: string[];
  above: string[];
  checkedAt: string | null;
}

export function rankingsCsv(rows: CsvRow[]): string {
  const header = ["Keyword", "Location", "Device", "Position", "Change since last check", "Best position", "Ranking URL", "SERP features", "Ranking above you", "Last checked (UTC)"];
  const lines = rows.map((r) =>
    [
      r.keyword,
      r.location,
      r.device,
      r.checkedAt ? (r.position ?? "Not in top 100") : "Not checked yet",
      r.change === null ? "" : r.change > 0 ? `up ${r.change}` : r.change < 0 ? `down ${-r.change}` : "no change",
      r.best ?? "",
      r.url ?? "",
      r.features.join("; "),
      r.above.join("; "),
      r.checkedAt ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
