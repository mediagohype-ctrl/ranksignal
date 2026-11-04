// Work board + work log: shared constants, view types and pure helpers.
// Client-safe (no db / server imports) so components can use the same labels and grouping logic.

export const TASK_CATEGORIES = ["onsite", "content", "technical", "offsite", "reporting", "other"] as const;
export const TASK_PERFORMERS = ["agency", "client", "system"] as const;
/** skipped / dismissed ("Not for me") take a To-do item off the list without calling it done. */
export const TASK_STATUSES = ["backlog", "in_progress", "client_review", "done", "blocked", "cancelled", "skipped", "dismissed"] as const;
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;
/** Statuses that still need work (used for the "next month" plan). */
export const OPEN_STATUSES = ["backlog", "in_progress", "client_review", "blocked"] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export type TaskPerformer = (typeof TASK_PERFORMERS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  onsite: "On-page",
  content: "Content",
  technical: "Technical",
  offsite: "Off-site",
  reporting: "Reporting",
  other: "Other",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "To do",
  in_progress: "In progress",
  client_review: "Waiting on you",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
  skipped: "Skipped",
  dismissed: "Not for me",
};

export const STATUS_HINT: Record<TaskStatus, string> = {
  backlog: "Planned, not started yet",
  in_progress: "Someone is working on it",
  client_review: "Needs your review or input",
  done: "Shipped",
  blocked: "Stuck until something changes",
  cancelled: "No longer needed",
  skipped: "Put aside for now",
  dismissed: "You said this isn't for you",
};

/** Who did the work, in client-facing words. */
export const PERFORMER_LABEL: Record<TaskPerformer, string> = {
  agency: "Our team",
  client: "You",
  system: "Automated",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: "High", medium: "Medium", low: "Low" };

/** Result of looking at one page again after a fix ("Fixed — we can see it"). fixed=null: we can't tell from one page. */
export interface TaskRecheck {
  url: string;
  at: string;
  fixed: boolean | null;
}

export interface TaskEvidence {
  links: string[];
  /** The To-do item this task records (a report problem id, or "offsite-<id>"). */
  todoKey?: string;
  recheck?: TaskRecheck;
}

/** Serializable task row as returned by the API and rendered by the board. */
export interface TaskView {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  performedBy: TaskPerformer;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  clientVisible: boolean;
  shippedUrl: string | null;
  evidence: TaskEvidence;
  actionId: string | null;
  findingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentView {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  label: string;
  actorName: string;
  createdAt: string;
}

export interface AssigneeOption {
  id: string;
  name: string;
  staff?: boolean;
}

/** One line of the client-facing work log (contract: ROUND 4 brief). */
export interface ShippedItem {
  kind: "task" | "change";
  title: string;
  category: string;
  performedBy: TaskPerformer;
  completedAt: Date;
  url?: string;
  taskId?: string;
  actionId?: string;
}

export interface OpenWorkItem {
  title: string;
  status: string;
  category: string;
  dueAt?: Date | null;
}

export interface TaskDraft {
  title: string;
  description?: string;
  category: TaskCategory;
  performedBy: TaskPerformer;
  priority: TaskPriority;
  findingId?: string;
  actionId?: string;
  shippedUrl?: string;
}

export function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}
export function asCategory(s: string | null | undefined): TaskCategory {
  return (TASK_CATEGORIES as readonly string[]).includes(s ?? "") ? (s as TaskCategory) : "other";
}
export function asPerformer(s: string | null | undefined): TaskPerformer {
  return (TASK_PERFORMERS as readonly string[]).includes(s ?? "") ? (s as TaskPerformer) : "agency";
}
export function asStatus(s: string | null | undefined): TaskStatus {
  return isTaskStatus(s ?? "") ? (s as TaskStatus) : "backlog";
}
export function asPriority(s: string | null | undefined): TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(s ?? "") ? (s as TaskPriority) : "medium";
}

/** Reads the Task.evidence JSON column defensively. */
export function readEvidence(v: unknown): TaskEvidence {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as { links?: unknown; todoKey?: unknown; recheck?: unknown }) : {};
  const out: TaskEvidence = { links: Array.isArray(o.links) ? o.links.filter((l): l is string => typeof l === "string").slice(0, 20) : [] };
  if (typeof o.todoKey === "string" && o.todoKey) out.todoKey = o.todoKey.slice(0, 200);
  const r = o.recheck && typeof o.recheck === "object" ? (o.recheck as Record<string, unknown>) : null;
  if (r && typeof r.url === "string" && typeof r.at === "string") {
    out.recheck = { url: r.url, at: r.at, fixed: typeof r.fixed === "boolean" ? r.fixed : null };
  }
  return out;
}

/**
 * completedAt rule: set when a task moves into "done" (kept if it was already done), cleared for any other status.
 */
export function nextCompletedAt(
  prev: { status: string; completedAt: Date | null } | null,
  nextStatus: string,
  now: Date = new Date(),
): Date | null {
  if (nextStatus !== "done") return null;
  if (prev && prev.status === "done" && prev.completedAt) return prev.completedAt;
  return now;
}

/** Monday 00:00 (UTC) of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

/** Groups items by week (newest week first, newest item first within a week). */
export function groupByWeek<T extends { completedAt: Date | string }>(items: T[]): { weekOf: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  for (const it of sorted) {
    const key = weekStart(new Date(it.completedAt)).toISOString();
    const list = map.get(key) ?? [];
    list.push(it);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([weekOf, list]) => ({ weekOf, items: list }));
}

/** [start, end) of the calendar month (UTC) `offset` months from `ref`. */
export function monthRange(ref: Date, offset = 0): { from: Date; to: Date } {
  const from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + offset + 1, 1));
  return { from, to };
}
