// Pure alert rule logic: compare the latest measurement with the one before and describe what changed in plain
// English. No DB access — evaluate.ts loads the data, deliver.ts de-duplicates and sends.
import { createHash } from "node:crypto";
import type { AlertRuleId, AlertSeverity } from "./config";

export interface AlertCandidate {
  rule: AlertRuleId;
  /** With `rule`, identifies "the same alert" for de-duplication (e.g. which pages, which questions). */
  dedupeKey: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  link: string;
  data?: Record<string, unknown>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Short stable key for a set of things (order-independent). */
export function keyOf(parts: string[]): string {
  const sorted = [...new Set(parts)].sort();
  if (sorted.length === 0) return "none";
  const joined = sorted.join("|");
  return joined.length <= 120 ? joined : createHash("sha256").update(joined).digest("hex").slice(0, 32);
}

function listLines(items: string[], max = 5): string {
  const shown = items.slice(0, max).map((s) => `• ${s}`);
  if (items.length > max) shown.push(`…and ${items.length - max} more`);
  return shown.join("\n");
}

// ------------------------------------------------------------------------------------------------ score

export function scoreDrop(prev: number | null | undefined, curr: number | null | undefined, minPoints: number): number | null {
  if (typeof prev !== "number" || typeof curr !== "number") return null;
  const drop = Math.round(prev) - Math.round(curr);
  return drop >= minPoints ? drop : null;
}

export function scoreDropAlert(o: { projectId: string; projectName: string; prev: number; curr: number; drop: number; after: "crawl" | "visibility" }): AlertCandidate {
  return {
    rule: "score_drop",
    dedupeKey: "overall",
    severity: o.drop >= 10 ? "urgent" : "warning",
    title: `Score dropped ${plural(o.drop, "point")} — ${o.projectName}`,
    body: `Your overall score went from ${Math.round(o.prev)} to ${Math.round(o.curr)} after the latest ${o.after === "crawl" ? "website check" : "AI check"}. Open the report to see which parts changed.`,
    link: `/app/projects/${o.projectId}/report`,
    data: { prev: o.prev, curr: o.curr, drop: o.drop },
  };
}

// ------------------------------------------------------------------------------------------------ urgent problems

export interface IssueLite {
  id: string;
  title: string;
  impact: string;
}

/** Urgent (high-impact) issues in `curr` that were not urgent in `prev`. */
export function newUrgentIssues(prev: IssueLite[], curr: IssueLite[]): IssueLite[] {
  const before = new Set(prev.filter((i) => i.impact === "high").map((i) => i.id));
  return curr.filter((i) => i.impact === "high" && !before.has(i.id));
}

export function newUrgentAlert(o: { projectId: string; projectName: string; issues: IssueLite[] }): AlertCandidate {
  const n = o.issues.length;
  return {
    rule: "new_urgent_problem",
    dedupeKey: keyOf(o.issues.map((i) => i.id)),
    severity: "urgent",
    title: `${n === 1 ? "New urgent problem" : `${n} new urgent problems`} — ${o.projectName}`,
    body: `The latest website check found ${n === 1 ? "an urgent problem" : `${n} urgent problems`} that weren't there before:\n${listLines(o.issues.map((i) => i.title))}`,
    link: `/app/projects/${o.projectId}/report`,
    data: { issues: o.issues.slice(0, 20).map((i) => ({ id: i.id, title: i.title })) },
  };
}

// ------------------------------------------------------------------------------------------------ site down

export interface CrawlOutcome {
  /** true = we couldn't read the site in this check (check failed, or no page answered). */
  down: boolean;
  reason?: string | null;
}

/** True when the newest `n` finished checks (newest first) were all "down". */
export function consecutiveDown(outcomes: CrawlOutcome[], n: number): boolean {
  if (n < 1 || outcomes.length < n) return false;
  return outcomes.slice(0, n).every((o) => o.down);
}

/** Plan / quota stops are the customer's limits, not the site being down. */
export function isSiteFailure(error: string | null | undefined): boolean {
  const e = (error ?? "").toLowerCase();
  if (!e) return true;
  return !/(quota|credit|usage|trial has ended|payment|paused|suspended|interrupted|budget)/.test(e);
}

export function siteDownAlert(o: { projectId: string; projectName: string; checks: number; websiteUrl: string }): AlertCandidate {
  return {
    rule: "site_down",
    dedupeKey: "site",
    severity: "urgent",
    title: `We couldn't reach your website — ${o.projectName}`,
    body: `We couldn't read ${o.websiteUrl} in the last ${plural(o.checks, "website check")}. Check that the site is online and loads in a browser. If customers can't open it, Google and AI assistants can't either.`,
    link: `/app/projects/${o.projectId}/audit`,
    data: { checks: o.checks },
  };
}

// ------------------------------------------------------------------------------------------------ AI visibility

/** Drop in percentage points (rates are 0-1), or null below threshold / not comparable. */
export function mentionDropPoints(prev: number | null | undefined, curr: number | null | undefined, minPoints: number): number | null {
  if (typeof prev !== "number" || typeof curr !== "number" || !Number.isFinite(prev) || !Number.isFinite(curr)) return null;
  const drop = Math.round((prev - curr) * 100);
  return drop >= minPoints ? drop : null;
}

export function mentionDropAlert(o: { projectId: string; projectName: string; prev: number; curr: number; drop: number; questionsChanged: boolean }): AlertCandidate {
  return {
    rule: "ai_mention_drop",
    dedupeKey: "mention_rate",
    severity: "warning",
    title: `AI assistants named you less — ${o.projectName}`,
    body:
      `AI assistants named you in ${Math.round(o.curr * 100)}% of answers, down from ${Math.round(o.prev * 100)}% last time (${o.drop} points).` +
      (o.questionsChanged ? " Your list of questions changed between checks, so part of this may come from the new questions." : " AI answers vary between checks, so watch the trend over the next check too."),
    link: `/app/projects/${o.projectId}/visibility`,
    data: { prev: o.prev, curr: o.curr, drop: o.drop },
  };
}

export interface PromptNamed {
  promptId: string;
  text: string;
  named: boolean;
}

/** Questions asked in both checks whose "named" result flipped. */
export function questionChanges(prev: PromptNamed[], curr: PromptNamed[]): { gained: PromptNamed[]; lost: PromptNamed[] } {
  const before = new Map(prev.map((p) => [p.promptId, p.named]));
  const gained: PromptNamed[] = [];
  const lost: PromptNamed[] = [];
  for (const c of curr) {
    if (!before.has(c.promptId)) continue;
    const was = before.get(c.promptId)!;
    if (!was && c.named) gained.push(c);
    if (was && !c.named) lost.push(c);
  }
  return { gained, lost };
}

/** Collapse observations to one row per question: named if any engine named the brand. */
export function namedByPrompt(rows: { promptId: string; text: string; brandMentioned: boolean }[]): PromptNamed[] {
  const m = new Map<string, PromptNamed>();
  for (const r of rows) {
    const cur = m.get(r.promptId) ?? { promptId: r.promptId, text: r.text, named: false };
    cur.named = cur.named || r.brandMentioned;
    m.set(r.promptId, cur);
  }
  return [...m.values()];
}

export function questionChangeAlert(o: { projectId: string; projectName: string; gained: PromptNamed[]; lost: PromptNamed[] }): AlertCandidate {
  const parts: string[] = [];
  if (o.lost.length) parts.push(`No longer named for ${plural(o.lost.length, "question")}:\n${listLines(o.lost.map((p) => `“${p.text}”`))}`);
  if (o.gained.length) parts.push(`Newly named for ${plural(o.gained.length, "question")}:\n${listLines(o.gained.map((p) => `“${p.text}”`))}`);
  const title = o.lost.length && o.gained.length
    ? `AI answers changed for ${plural(o.lost.length + o.gained.length, "question")}`
    : o.lost.length
      ? `AI stopped naming you for ${plural(o.lost.length, "question")}`
      : `AI started naming you for ${plural(o.gained.length, "question")}`;
  return {
    rule: "ai_question_change",
    dedupeKey: keyOf([...o.lost.map((p) => `-${p.promptId}`), ...o.gained.map((p) => `+${p.promptId}`)]),
    severity: o.lost.length ? "warning" : "info",
    title: `${title} — ${o.projectName}`,
    body: parts.join("\n\n"),
    link: `/app/projects/${o.projectId}/visibility`,
    data: { lost: o.lost.slice(0, 20).map((p) => p.promptId), gained: o.gained.slice(0, 20).map((p) => p.promptId) },
  };
}

// ------------------------------------------------------------------------------------------------ indexing

export const isNoindex = (robotsMeta: string | null | undefined) => !!robotsMeta && /\bnoindex\b|\bnone\b/i.test(robotsMeta);

export interface PageIndexState {
  url: string;
  statusCode: number | null;
  robotsMeta: string | null;
}

const okStatus = (s: number | null) => typeof s === "number" && s >= 200 && s < 300;

/** Pages that were indexable (2xx, no noindex) last check and now carry noindex. */
export function newlyNoindex(prev: PageIndexState[], curr: PageIndexState[]): string[] {
  const before = new Map(prev.map((p) => [p.url, p]));
  return curr
    .filter((c) => isNoindex(c.robotsMeta))
    .filter((c) => {
      const p = before.get(c.url);
      return !!p && okStatus(p.statusCode) && !isNoindex(p.robotsMeta);
    })
    .map((c) => c.url);
}

/** Indexable pages from last check that are missing from this check (candidates for a robots.txt block). */
export function missingIndexablePages(prev: PageIndexState[], curr: PageIndexState[]): string[] {
  const now = new Set(curr.map((c) => c.url));
  return prev.filter((p) => okStatus(p.statusCode) && !isNoindex(p.robotsMeta) && !now.has(p.url)).map((p) => p.url);
}

export function indexingAlert(o: { projectId: string; projectName: string; noindex: string[]; robotsBlocked: string[]; blocksEveryone: boolean }): AlertCandidate {
  const parts: string[] = [];
  if (o.blocksEveryone) parts.push("Your robots.txt file now blocks every search engine from the whole site.");
  if (o.noindex.length) parts.push(`${plural(o.noindex.length, "page")} now ${o.noindex.length === 1 ? "tells" : "tell"} Google not to show ${o.noindex.length === 1 ? "it" : "them"} (noindex):\n${listLines(o.noindex)}`);
  if (o.robotsBlocked.length) parts.push(`${plural(o.robotsBlocked.length, "page")} ${o.robotsBlocked.length === 1 ? "is" : "are"} now blocked by your robots.txt file:\n${listLines(o.robotsBlocked)}`);
  parts.push("If this wasn't on purpose, undo the change so these pages can show up on Google again.");
  const n = o.noindex.length + o.robotsBlocked.length;
  return {
    rule: "indexing_blocked",
    dedupeKey: keyOf([...(o.blocksEveryone ? ["*all*"] : []), ...o.noindex.map((u) => `n:${u}`), ...o.robotsBlocked.map((u) => `r:${u}`)]),
    severity: o.blocksEveryone || n >= 5 ? "urgent" : "warning",
    title: o.blocksEveryone ? `Your whole site is blocked from Google — ${o.projectName}` : `${plural(n, "page")} hidden from Google — ${o.projectName}`,
    body: parts.join("\n\n"),
    link: `/app/projects/${o.projectId}/audit`,
    data: { noindex: o.noindex.slice(0, 50), robotsBlocked: o.robotsBlocked.slice(0, 50), blocksEveryone: o.blocksEveryone },
  };
}

// ------------------------------------------------------------------------------------------------ Search Console

export interface DailyClicks {
  date: string; // YYYY-MM-DD
  clicks: number;
}

const DAY = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * Last 7 days with data vs the 7 days before (anchored on the newest date). Null when either week has fewer than
 * 5 days of data or the earlier week had fewer than `minClicks` clicks (too small to mean anything).
 */
export function weekOverWeek(days: DailyClicks[], minClicks = 20): { endDate: string; current: number; previous: number; pct: number } | null {
  if (days.length === 0) return null;
  const endDate = days.map((d) => d.date).sort().at(-1)!;
  const curStart = addDays(endDate, -6);
  const prevStart = addDays(endDate, -13);
  const prevEnd = addDays(endDate, -7);
  const cur = days.filter((d) => d.date >= curStart && d.date <= endDate);
  const prev = days.filter((d) => d.date >= prevStart && d.date <= prevEnd);
  if (cur.length < 5 || prev.length < 5) return null;
  const current = cur.reduce((a, d) => a + d.clicks, 0);
  const previous = prev.reduce((a, d) => a + d.clicks, 0);
  if (previous < minClicks) return null;
  return { endDate, current, previous, pct: (current - previous) / previous };
}

export function clicksDropAlert(o: { projectId: string; projectName: string; current: number; previous: number; pct: number; endDate: string }): AlertCandidate {
  const drop = Math.round(-o.pct * 100);
  return {
    rule: "search_clicks_drop",
    dedupeKey: "clicks",
    severity: drop >= 50 ? "urgent" : "warning",
    title: `Google clicks down ${drop}% this week — ${o.projectName}`,
    body: `People clicked through to your site from Google ${o.current} times in the 7 days to ${o.endDate}, down from ${o.previous} the week before. Search Console data is 2–3 days behind, and holidays or seasons can move it too.`,
    link: `/app/projects/${o.projectId}/integrations`,
    data: { current: o.current, previous: o.previous, pct: o.pct, endDate: o.endDate },
  };
}
