// In-memory aggregation of crawler hits into per-day, per-bot counters (pure). Only bot hits are kept; everything
// else in the log is counted and discarded. Paths are capped per bucket so a huge log can't exhaust memory.
import { matchBot } from "./bots";
import type { LogHit } from "./parse";
import type { RangeChecker } from "./ranges";

export const TOP_PATHS_STORED = 100;
const MAX_DISTINCT_PATHS = 5_000;
export const OTHER_PATHS = "(other pages)";

export interface PathStat {
  path: string;
  hits: number;
  errors: number;
}

export interface DayBotBucket {
  date: string;
  bot: string;
  hits: number;
  verifiedHits: number;
  unverifiedHits: number;
  statusCounts: Record<string, number>;
  paths: Map<string, { hits: number; errors: number }>;
}

export interface AggregateSummary {
  linesTotal: number;
  linesParsed: number;
  botHits: number;
  firstDate: string | null;
  lastDate: string | null;
}

export const isErrorStatus = (s: number) => s >= 400;
/** Responses that mean the bot was turned away (as opposed to a broken page). */
export const isBlockedStatus = (s: number) => s === 401 || s === 403 || s === 429;

export class BotAggregator {
  readonly buckets = new Map<string, DayBotBucket>();
  linesTotal = 0;
  linesParsed = 0;
  botHits = 0;
  private first: string | null = null;
  private last: string | null = null;

  constructor(private checker: RangeChecker | null = null) {}

  setChecker(c: RangeChecker) {
    this.checker = c;
  }

  /** Count a raw line (call for every line, parsed or not). */
  countLine() {
    this.linesTotal++;
  }

  add(hit: LogHit): boolean {
    this.linesParsed++;
    const bot = matchBot(hit.userAgent);
    if (!bot) return false;
    this.botHits++;
    if (!this.first || hit.date < this.first) this.first = hit.date;
    if (!this.last || hit.date > this.last) this.last = hit.date;
    const key = `${hit.date}|${bot.token}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { date: hit.date, bot: bot.token, hits: 0, verifiedHits: 0, unverifiedHits: 0, statusCounts: {}, paths: new Map() };
      this.buckets.set(key, b);
    }
    b.hits++;
    const v = this.checker ? this.checker.check(bot.ranges, hit.ip) : "claimed";
    if (v === "verified") b.verifiedHits++;
    else if (v === "unverified") b.unverifiedHits++;
    const sk = String(hit.status);
    b.statusCounts[sk] = (b.statusCounts[sk] ?? 0) + 1;
    const pathKey = b.paths.has(hit.path) || b.paths.size < MAX_DISTINCT_PATHS ? hit.path : OTHER_PATHS;
    const p = b.paths.get(pathKey) ?? { hits: 0, errors: 0 };
    p.hits++;
    if (isErrorStatus(hit.status)) p.errors++;
    b.paths.set(pathKey, p);
    return true;
  }

  summary(): AggregateSummary {
    return { linesTotal: this.linesTotal, linesParsed: this.linesParsed, botHits: this.botHits, firstDate: this.first, lastDate: this.last };
  }
}

/** Top N paths by hits (ties: more errors first, then alphabetical). */
export function topPaths(paths: Iterable<[string, { hits: number; errors: number }]> | PathStat[], n = TOP_PATHS_STORED): PathStat[] {
  const list: PathStat[] = Array.isArray(paths)
    ? (paths as PathStat[]).map((p) => ({ ...p }))
    : [...(paths as Iterable<[string, { hits: number; errors: number }]>)].map(([path, v]) => ({ path, hits: v.hits, errors: v.errors }));
  return list.sort((a, b) => b.hits - a.hits || b.errors - a.errors || a.path.localeCompare(b.path)).slice(0, n);
}

/** Merge stored top paths with new ones (sums per path, then keeps the top N). */
export function mergePaths(a: PathStat[], b: PathStat[], n = TOP_PATHS_STORED): PathStat[] {
  const m = new Map<string, { hits: number; errors: number }>();
  for (const p of [...a, ...b]) {
    const cur = m.get(p.path) ?? { hits: 0, errors: 0 };
    m.set(p.path, { hits: cur.hits + p.hits, errors: cur.errors + p.errors });
  }
  return topPaths(m.entries(), n);
}

export function mergeStatusCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}
