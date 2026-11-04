// The To-do tab (Developer Brief v1): ONE list that answers "What do I fix?". It merges the report's grouped
// problems (src/lib/report/issues.ts — the same list and count the report shows), things to do outside the
// website (listings, wrong facts in AI answers, off-site tasks) and hand-made tasks. Pure and client-safe.
import type { IssueEffort, IssueImpact, ReportIssue } from "@/lib/report/types";
import type { TaskRecheck } from "./types";

export type TodoSide = "website" | "outside";
export type TodoKind = "issue" | "offsite" | "task";
/** open = not started; started = someone is on it; skipped / dismissed leave the list without counting as done. */
export type TodoState = "open" | "started" | "done" | "skipped" | "dismissed";

export interface TodoItem {
  /** Route id: a report problem id ("seo-titles"), "offsite-<id>" or "task-<id>". */
  id: string;
  kind: TodoKind;
  side: TodoSide;
  title: string;
  impact: IssueImpact;
  /** Rough time for a non-technical owner. */
  minutes: number;
  /** Estimated score gain (src/lib/report/points.ts); 0 when it doesn't map to the score. */
  points: number;
  state: TodoState;
  /** When it was marked done (ISO), for the done list. */
  doneAt?: string | null;
  /** Last look at the page after a fix. */
  recheck?: TaskRecheck | null;
  /** The task that records this item's state, if any. */
  taskId?: string | null;
}

export const EFFORT_MINUTES: Record<IssueEffort, number> = { quick: 15, moderate: 60, involved: 240 };
const OFFSITE_MINUTES = 30;
const TASK_MINUTES = 60;
/** Keep done items that are no longer in the report on the list this long (so progress doesn't reset). */
export const DONE_KEEP_DAYS = 90;

/** "About 15 min" / "About 1 hour" / "Half a day or more". */
export function timeLabel(minutes: number): string {
  if (minutes <= 20) return "About 15 min";
  if (minutes <= 40) return "About 30 min";
  if (minutes <= 90) return "About 1 hour";
  if (minutes <= 180) return "About 2 hours";
  return "Half a day or more";
}

/** Problems that are about what AI tools say, fixed on other websites (profiles, directories), not on yours. */
export const OUTSIDE_ISSUE_IDS = new Set(["brand-ai_knowledge"]);

const IMPACT_RANK: Record<IssueImpact, number> = { high: 0, medium: 1, low: 2 };
/** Gain used for sorting when an item has no point estimate. */
const GAIN_FLOOR: Record<IssueImpact, number> = { high: 2, medium: 1, low: 0.5 };

export function gainOf(item: Pick<TodoItem, "points" | "impact">): number {
  return item.points > 0 ? item.points : GAIN_FLOOR[item.impact];
}

/** Most gain for the least work first (gain ÷ minutes), then priority, then title. */
export function sortTodo<T extends Pick<TodoItem, "points" | "impact" | "minutes" | "title">>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      gainOf(b) / Math.max(1, b.minutes) - gainOf(a) / Math.max(1, a.minutes) ||
      IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] ||
      a.title.localeCompare(b.title),
  );
}

// ---------------------------------------------------------------------------------------------
// Building the list

export interface StateTaskInput {
  id: string;
  todoKey: string;
  status: string;
  title: string;
  completedAt: string | null;
  updatedAt: string;
  recheck?: TaskRecheck | null;
}
export interface OffsiteInput {
  id: string;
  name: string;
  status: string; // todo | submitted | live | rejected
  updatedAt: string;
}
export interface PlainTaskInput {
  id: string;
  title: string;
  status: string;
  category: string;
  priority: string;
  completedAt: string | null;
}
export interface TodoInput {
  issues: Pick<ReportIssue, "id" | "title" | "impact" | "effort">[];
  points: Record<string, number>;
  /** Tasks that record a To-do item's state (evidence.todoKey). */
  stateTasks: StateTaskInput[];
  offsite: OffsiteInput[];
  /** Other client-visible tasks (no todoKey, not linked to an off-site item). */
  tasks: PlainTaskInput[];
  now?: Date;
}

export function stateOfTaskStatus(status: string): TodoState {
  if (status === "done") return "done";
  if (status === "skipped") return "skipped";
  if (status === "dismissed" || status === "cancelled") return "dismissed";
  if (status === "in_progress" || status === "client_review" || status === "blocked") return "started";
  return "open";
}

const PRIORITY_IMPACT: Record<string, IssueImpact> = { high: "high", medium: "medium", low: "low" };
const stripFix = (t: string) => t.replace(/^Fix:\s*/i, "");

/** Latest state task per key. */
function latestByKey(tasks: StateTaskInput[]): Map<string, StateTaskInput> {
  const m = new Map<string, StateTaskInput>();
  for (const t of tasks) {
    const cur = m.get(t.todoKey);
    if (!cur || cur.updatedAt < t.updatedAt) m.set(t.todoKey, t);
  }
  return m;
}

export function buildTodo(input: TodoInput): TodoItem[] {
  const now = input.now ?? new Date();
  const keepSince = new Date(now.getTime() - DONE_KEEP_DAYS * 86_400_000).toISOString();
  const states = latestByKey(input.stateTasks);
  const out: TodoItem[] = [];

  const seen = new Set<string>();
  for (const i of input.issues) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    const st = states.get(i.id);
    out.push({
      id: i.id,
      kind: "issue",
      side: OUTSIDE_ISSUE_IDS.has(i.id) ? "outside" : "website",
      title: i.title,
      impact: i.impact,
      minutes: EFFORT_MINUTES[i.effort],
      points: input.points[i.id] ?? 0,
      state: st ? stateOfTaskStatus(st.status) : "open",
      doneAt: st?.status === "done" ? st.completedAt : null,
      recheck: st?.recheck ?? null,
      taskId: st?.id ?? null,
    });
  }
  // Problems marked done that the latest check no longer shows: keep them as done for a while.
  for (const [key, st] of states) {
    if (seen.has(key) || key.startsWith("offsite-") || st.status !== "done") continue;
    if (!st.completedAt || st.completedAt < keepSince) continue;
    seen.add(key);
    out.push({
      id: key,
      kind: "issue",
      side: OUTSIDE_ISSUE_IDS.has(key) ? "outside" : "website",
      title: stripFix(st.title),
      impact: "medium",
      minutes: EFFORT_MINUTES.moderate,
      points: 0,
      state: "done",
      doneAt: st.completedAt,
      recheck: st.recheck ?? null,
      taskId: st.id,
    });
  }

  for (const o of input.offsite) {
    const id = `offsite-${o.id}`;
    const st = states.get(id);
    const own: TodoState = o.status === "live" || o.status === "submitted" ? "done" : o.status === "rejected" ? "dismissed" : "open";
    // A skip / "not for me" only hides an item that is still to do.
    const state = own === "open" && st ? stateOfTaskStatus(st.status) : own;
    if (state === "done" && o.updatedAt < keepSince) continue;
    out.push({
      id,
      kind: "offsite",
      side: "outside",
      title: `Get listed on ${o.name}`,
      impact: "medium",
      minutes: OFFSITE_MINUTES,
      points: 0,
      state,
      doneAt: state === "done" ? o.updatedAt : null,
      taskId: st?.id ?? null,
    });
  }

  for (const t of input.tasks) {
    const state = stateOfTaskStatus(t.status);
    if (state === "done" && (!t.completedAt || t.completedAt < keepSince)) continue;
    out.push({
      id: `task-${t.id}`,
      kind: "task",
      side: t.category === "offsite" ? "outside" : "website",
      title: t.title,
      impact: PRIORITY_IMPACT[t.priority] ?? "medium",
      minutes: TASK_MINUTES,
      points: 0,
      state,
      doneAt: state === "done" ? t.completedAt : null,
      taskId: t.id,
    });
  }
  return out;
}

export interface TodoProgress {
  done: number;
  total: number;
}

/** "4 of 23 done": skipped and "not for me" items don't count either way. */
export function todoProgress(items: Pick<TodoItem, "state">[]): TodoProgress {
  const counted = items.filter((i) => i.state === "open" || i.state === "started" || i.state === "done");
  return { done: counted.filter((i) => i.state === "done").length, total: counted.length };
}

export const isOpen = (i: Pick<TodoItem, "state">) => i.state === "open" || i.state === "started";

export interface TodoLists {
  website: TodoItem[];
  outside: TodoItem[];
  done: TodoItem[];
  hidden: TodoItem[];
  progress: TodoProgress;
}

export function splitTodo(items: TodoItem[]): TodoLists {
  const open = sortTodo(items.filter(isOpen));
  return {
    website: open.filter((i) => i.side === "website"),
    outside: open.filter((i) => i.side === "outside"),
    done: items.filter((i) => i.state === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")),
    hidden: items.filter((i) => i.state === "skipped" || i.state === "dismissed"),
    progress: todoProgress(items),
  };
}

/** The fix to open after this one: the next open item on the same side, then the other side, then from the top. */
export function nextTodo(items: TodoItem[], currentId: string): TodoItem | null {
  const open = sortTodo(items.filter(isOpen));
  const cur = items.find((i) => i.id === currentId);
  const side = cur?.side ?? "website";
  const sameSide = open.filter((i) => i.side === side);
  const idx = sameSide.findIndex((i) => i.id === currentId);
  const after = idx >= 0 ? sameSide.slice(idx + 1) : sameSide;
  return after.find((i) => i.id !== currentId) ?? open.find((i) => i.side !== side) ?? open.find((i) => i.id !== currentId) ?? null;
}

/** What we saw when we looked at the page again, in one line. */
export function recheckLine(r: TaskRecheck | null): { tone: "success" | "info"; text: string } | null {
  if (!r) return null;
  if (r.fixed === true) return { tone: "success", text: "Fixed — we can see it." };
  if (r.fixed === false) return { tone: "info", text: "We can't see this change yet. It can take a few minutes to show — check again soon." };
  return { tone: "info", text: "We'll confirm this on your next website check." };
}

// ---------------------------------------------------------------------------------------------
// Ids, links and old routes

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export type ParsedTodoId =
  | { kind: "issue"; issueId: string }
  | { kind: "offsite"; offsiteId: string }
  | { kind: "task"; taskId: string }
  | { kind: "action"; actionId: string };

export function parseTodoId(raw: string): ParsedTodoId | null {
  const id = raw.trim();
  if (!SAFE_ID.test(id)) return null;
  for (const k of ["offsite", "task", "action"] as const) {
    if (id.startsWith(`${k}-`)) {
      const ref = id.slice(k.length + 1);
      if (!ref) return null;
      return k === "offsite" ? { kind: k, offsiteId: ref } : k === "task" ? { kind: k, taskId: ref } : { kind: k, actionId: ref };
    }
  }
  return { kind: "issue", issueId: id };
}

export function todoHref(projectId: string, o: { item?: string | null; tab?: TodoSide | null } = {}): string {
  const base = `/app/projects/${projectId}/todo`;
  if (o.item) return `${base}/${encodeURIComponent(o.item)}`;
  return o.tab === "outside" ? `${base}?tab=outside` : base;
}

export type LegacySection = "audit" | "actions" | "work" | "offsite";

/**
 * Where an old To-do page sends people (deep links keep working):
 * actions?id|focus=X and work?fromAction=X → that change's fix screen; work?task=X → that task;
 * offsite → the "Outside your website" tab; everything else → the To-do list.
 */
export function legacyTodoTarget(section: LegacySection, sp: Record<string, string | string[] | undefined>): { item?: string; tab?: TodoSide } {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && SAFE_ID.test(s) ? s : undefined;
  };
  if (section === "actions") {
    const id = one("id") ?? one("focus");
    return id ? { item: `action-${id}` } : {};
  }
  if (section === "work") {
    const action = one("fromAction");
    if (action) return { item: `action-${action}` };
    const task = one("task") ?? one("taskId");
    return task ? { item: `task-${task}` } : {};
  }
  if (section === "offsite") return { tab: "outside" };
  return {};
}

/** Pick the report problem a drafted change belongs to: same kind of change, preferably on one of its pages. */
export function issueForAction<T extends Pick<ReportIssue, "id" | "relatedActionType" | "affectedUrls">>(
  action: { type: string; targetUrl: string | null },
  issues: T[],
): T | null {
  const same = issues.filter((i) => i.relatedActionType === action.type);
  if (!same.length) return null;
  const key = (u: string) => u.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();
  if (action.targetUrl) {
    const k = key(action.targetUrl);
    const onPage = same.find((i) => i.affectedUrls.some((u) => key(u) === k));
    if (onPage) return onPage;
  }
  return same[0];
}
