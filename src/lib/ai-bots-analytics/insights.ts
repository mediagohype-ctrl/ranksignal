// Dashboard shaping + plain-English takeaways from daily rows (pure, tested). "Last week" means the 7 days ending on
// the newest day we have data for, because uploaded logs are often a few days old.
import { botByToken, isAiBot } from "./bots";
import { isBlockedStatus, mergePaths, mergeStatusCounts, type PathStat } from "./aggregate";
import type { DailyRow } from "./store";

export interface BotSummary {
  bot: string;
  owner: string;
  label: string;
  ai: boolean;
  /** Operator publishes IP ranges we can check. */
  verifiable: boolean;
  hits: number;
  verifiedHits: number;
  unverifiedHits: number;
  errors: number;
  blocked: number;
  statusCounts: Record<string, number>;
  topPaths: PathStat[];
  lastSeen: string;
}

export interface BotDashboard {
  from: string | null;
  to: string | null;
  days: string[];
  /** One point per day: { date, [bot]: hits }. */
  series: Record<string, string | number>[];
  bots: BotSummary[];
  totals: { aiHits: number; searchHits: number; aiErrors: number; aiBlocked: number };
  takeaways: string[];
}

const n = (x: number) => x.toLocaleString("en-IN");
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

function countWhere(counts: Record<string, number>, pred: (s: number) => boolean): number {
  let t = 0;
  for (const [k, v] of Object.entries(counts)) if (pred(Number(k))) t += v;
  return t;
}

export function summarizeBots(rows: DailyRow[]): BotSummary[] {
  const by = new Map<string, BotSummary>();
  for (const r of rows) {
    const meta = botByToken(r.bot);
    const cur =
      by.get(r.bot) ??
      ({
        bot: r.bot, owner: meta?.owner ?? "Unknown", label: meta?.label ?? r.bot, ai: isAiBot(r.bot), verifiable: !!meta?.ranges,
        hits: 0, verifiedHits: 0, unverifiedHits: 0, errors: 0, blocked: 0, statusCounts: {}, topPaths: [], lastSeen: r.date,
      } satisfies BotSummary);
    cur.hits += r.hits;
    cur.verifiedHits += r.verifiedHits;
    cur.unverifiedHits += r.unverifiedHits;
    cur.statusCounts = mergeStatusCounts(cur.statusCounts, r.statusCounts);
    cur.topPaths = mergePaths(cur.topPaths, r.topPaths, 50);
    if (r.date > cur.lastSeen) cur.lastSeen = r.date;
    by.set(r.bot, cur);
  }
  for (const b of by.values()) {
    b.errors = countWhere(b.statusCounts, (s) => s >= 400);
    b.blocked = countWhere(b.statusCounts, isBlockedStatus);
  }
  return [...by.values()].sort((a, b) => Number(b.ai) - Number(a.ai) || b.hits - a.hits || a.bot.localeCompare(b.bot));
}

/** Plain-English sentences, most useful first. */
export function buildTakeaways(rows: DailyRow[]): string[] {
  if (rows.length === 0) return [];
  const to = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
  const weekFrom = addDays(to, -6);
  const week = summarizeBots(rows.filter((r) => r.date >= weekFrom));
  const all = summarizeBots(rows);
  const out: string[] = [];
  const ai = week.filter((b) => b.ai && b.hits > 0);

  if (ai.length === 0) {
    out.push(
      all.some((b) => b.ai)
        ? `No AI crawlers visited in the week ending ${to}. Earlier visits are shown below.`
        : "No AI crawlers (ChatGPT, Claude, Perplexity and others) show up in these logs yet. If you block bots at a firewall or CDN, they may never reach your server.",
    );
  }
  for (const b of ai.slice(0, 5)) {
    const errPart = b.errors > 0 ? `; ${plural(b.errors, "request")} got errors` : ", all without errors";
    out.push(`${b.bot} (${b.label}) read ${plural(b.hits, "page")} in the week ending ${to}${errPart}.`);
  }
  for (const b of week.filter((x) => x.ai && x.blocked > 0).slice(0, 3)) {
    out.push(
      `${b.bot} was turned away ${plural(b.blocked, "time")} (blocked or rate-limited). If you want ${b.owner} to read your site, check your firewall, CDN bot protection or robots rules.`,
    );
  }
  const brokenPage = ai
    .flatMap((b) => b.topPaths.filter((p) => p.errors > 0).map((p) => ({ ...p, bot: b.bot })))
    .sort((a, b) => b.errors - a.errors)[0];
  if (brokenPage) out.push(`The page AI crawlers hit the most errors on is ${brokenPage.path} (${plural(brokenPage.errors, "error")}). Fix or redirect it.`);
  for (const b of all.filter((x) => x.ai && x.unverifiedHits > 0 && x.unverifiedHits >= x.hits * 0.2).slice(0, 2)) {
    out.push(
      `${plural(b.unverifiedHits, "visit")} claiming to be ${b.bot} came from IP addresses outside ${b.owner}'s published list. They may be fake bots, or your logs record your CDN's address instead of the visitor's.`,
    );
  }
  const google = week.find((b) => b.bot === "Googlebot");
  const aiTotal = ai.reduce((t, b) => t + b.hits, 0);
  if (google && google.hits > 0 && aiTotal > 0) {
    out.push(`For comparison, Googlebot read ${plural(google.hits, "page")} that week; AI crawlers together read ${plural(aiTotal, "page")}.`);
  }
  return out;
}

export function buildDashboard(rows: DailyRow[]): BotDashboard {
  const bots = summarizeBots(rows);
  if (rows.length === 0) {
    return { from: null, to: null, days: [], series: [], bots, totals: { aiHits: 0, searchHits: 0, aiErrors: 0, aiBlocked: 0 }, takeaways: buildTakeaways(rows) };
  }
  const from = rows.reduce((m, r) => (r.date < m ? r.date : m), rows[0].date);
  const to = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
  const days = dayRange(from, to);
  const byDay = new Map<string, Record<string, string | number>>(days.map((d) => [d, { date: d }]));
  for (const r of rows) {
    const p = byDay.get(r.date);
    if (p) p[r.bot] = ((p[r.bot] as number | undefined) ?? 0) + r.hits;
  }
  const series = days.map((d) => {
    const p = byDay.get(d)!;
    for (const b of bots) if (p[b.bot] === undefined) p[b.bot] = 0;
    return p;
  });
  const aiBots = bots.filter((b) => b.ai);
  return {
    from, to, days, series, bots,
    totals: {
      aiHits: aiBots.reduce((t, b) => t + b.hits, 0),
      searchHits: bots.filter((b) => !b.ai).reduce((t, b) => t + b.hits, 0),
      aiErrors: aiBots.reduce((t, b) => t + b.errors, 0),
      aiBlocked: aiBots.reduce((t, b) => t + b.blocked, 0),
    },
    takeaways: buildTakeaways(rows),
  };
}

export const OTHER_AI_SERIES = "Other AI crawlers";

/** Chart data: the top `max` AI crawlers by visits, the rest summed as "Other AI crawlers" (search engines excluded). */
export function chartSeries(d: BotDashboard, max = 5): { bots: string[]; data: Record<string, string | number>[] } {
  const ai = d.bots.filter((b) => b.ai && b.hits > 0);
  const top = ai.slice(0, max).map((b) => b.bot);
  const others = ai.slice(max).map((b) => b.bot);
  const bots = others.length ? [...top, OTHER_AI_SERIES] : top;
  const data = d.series.map((p) => {
    const row: Record<string, string | number> = { date: p.date };
    for (const b of top) row[b] = Number(p[b] ?? 0);
    if (others.length) row[OTHER_AI_SERIES] = others.reduce((t, b) => t + Number(p[b] ?? 0), 0);
    return row;
  });
  return { bots, data };
}
