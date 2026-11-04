// Server side of the To-do tab: loads the one list (report problems + off-site items + tasks) and records what
// people do with an item (done / skip / not for me) as a Task, so it leaves the list and shows in the work log.
// Every query is scoped by the session's organizationId.
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { getStoredReport } from "@/lib/report/stored";
import { issuePoints } from "@/lib/report/points";
import { resolveFix } from "@/lib/fix-guides";
import { updateOffsite } from "@/lib/offsite";
import type { ReportIssue, SiteReport } from "@/lib/report/types";
import type { SessionContext } from "@/lib/types";
import { canEditTasks, createTask, taskVisibilityWhere, updateTask } from "./index";
import { readEvidence, type TaskPriority, type TaskRecheck, type TaskStatus } from "./types";
import { buildTodo, nextTodo, parseTodoId, splitTodo, type PlainTaskInput, type StateTaskInput, type TodoItem, type TodoLists } from "./todo";
import { recheckIssuePage } from "./recheck";

export interface TodoData {
  report: SiteReport | null;
  items: TodoItem[];
  lists: TodoLists;
}

const PRIORITY: Record<ReportIssue["impact"], TaskPriority> = { high: "high", medium: "medium", low: "low" };
const fixTitle = (issue: Pick<ReportIssue, "title">) => `Fix: ${issue.title}`.slice(0, 200);

export async function loadTodo(s: SessionContext, projectId: string, report?: SiteReport | null): Promise<TodoData> {
  const [rep, taskRows, offsiteRows] = await Promise.all([
    report !== undefined ? Promise.resolve(report) : getStoredReport(projectId, s.organizationId).catch(() => null),
    db.task.findMany({
      where: { organizationId: s.organizationId, projectId, ...taskVisibilityWhere(s) },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    db.offsiteItem.findMany({ where: { organizationId: s.organizationId, projectId }, orderBy: { createdAt: "asc" }, take: 300 }),
  ]);
  const issues = rep?.issues ?? [];
  // Tasks added with "Add to my task list" before To-do existed are matched to their problem by title.
  const byTitle = new Map(issues.map((i) => [fixTitle(i), i.id]));
  const offsiteTasks = new Set(offsiteRows.map((o) => o.taskId).filter((x): x is string => !!x));

  const stateTasks: StateTaskInput[] = [];
  const tasks: PlainTaskInput[] = [];
  for (const t of taskRows) {
    const ev = readEvidence(t.evidence);
    const key = ev.todoKey ?? byTitle.get(t.title);
    const base = { completedAt: t.completedAt?.toISOString() ?? null };
    if (key) {
      stateTasks.push({ id: t.id, todoKey: key, status: t.status, title: t.title, updatedAt: t.updatedAt.toISOString(), recheck: ev.recheck ?? null, ...base });
    } else if (!offsiteTasks.has(t.id)) {
      tasks.push({ id: t.id, title: t.title, status: t.status, category: t.category, priority: t.priority, ...base });
    }
  }
  const items = buildTodo({
    issues,
    points: rep ? issuePoints(rep) : {},
    stateTasks,
    offsite: offsiteRows.map((o) => ({ id: o.id, name: o.name, status: o.status, updatedAt: o.updatedAt.toISOString() })),
    tasks,
  });
  return { report: rep, items, lists: splitTodo(items) };
}

/** started = we're on it (e.g. a change is being put live); open = put back on the list. */
export type TodoAction = "done" | "started" | "skipped" | "dismissed" | "open";
const TASK_STATUS: Record<TodoAction, TaskStatus> = { done: "done", started: "in_progress", skipped: "skipped", dismissed: "dismissed", open: "backlog" };

async function findStateTask(s: SessionContext, projectId: string, key: string, title?: string) {
  const byKey = await db.task.findFirst({
    where: { organizationId: s.organizationId, projectId, ...taskVisibilityWhere(s), evidence: { path: ["todoKey"], equals: key } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (byKey || !title) return byKey;
  return db.task.findFirst({
    where: { organizationId: s.organizationId, projectId, ...taskVisibilityWhere(s), title },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
}

async function upsertStateTask(
  s: SessionContext,
  projectId: string,
  key: string,
  status: TaskStatus,
  draft: { title: string; description?: string; category: "onsite" | "content" | "technical" | "offsite"; priority: TaskPriority; links: string[] },
): Promise<string> {
  const existing = await findStateTask(s, projectId, key, draft.title);
  if (existing) {
    await updateTask(s, existing.id, { status, evidence: { links: draft.links.filter((u) => /^https?:\/\//i.test(u)).slice(0, 20), todoKey: key } });
    return existing.id;
  }
  const t = await createTask(s, projectId, {
    title: draft.title,
    description: draft.description,
    category: draft.category,
    priority: draft.priority,
    performedBy: "client",
    status,
    evidence: { links: draft.links.filter((u) => /^https?:\/\//i.test(u)).slice(0, 20), todoKey: key },
  });
  return t.id;
}

export interface TodoChangeResult {
  state: TodoAction;
  recheck: TaskRecheck | null;
  /** The fix to open next (null when the list is empty). */
  nextId: string | null;
}

/**
 * Records what someone did with a To-do item. "done" on a website problem also looks at the page again
 * (recheck) so the screen can say "Fixed — we can see it" or "We can't see this change yet".
 */
export async function changeTodo(
  s: SessionContext,
  project: { id: string; websiteUrl: string; name: string; brandNames: unknown; competitors: unknown },
  itemId: string,
  action: TodoAction,
  /** url: the page to look at again; recheck=false when the change is still being put live (it checks itself). */
  opts: { url?: string; recheck?: boolean } = {},
): Promise<TodoChangeResult> {
  if (!canEditTasks(s)) throw new HttpError(403, "forbidden", "Your role can see the to-do list but not change it");
  const parsed = parseTodoId(itemId);
  if (!parsed || parsed.kind === "action") throw new HttpError(400, "invalid_item", "That isn't a to-do item");
  let recheck: TaskRecheck | null = null;
  const report = await getStoredReport(project.id, s.organizationId).catch(() => null);

  if (parsed.kind === "task") {
    await updateTask(s, parsed.taskId, { status: TASK_STATUS[action] });
  } else if (parsed.kind === "offsite") {
    const row = await db.offsiteItem.findFirst({ where: { id: parsed.offsiteId, organizationId: s.organizationId, projectId: project.id } });
    if (!row) throw new HttpError(404, "not_found", "Item not found");
    if (action === "done" || action === "started") await updateOffsite(s, row.id, { status: "submitted" }, project.id);
    else {
      if (action === "open" && row.status === "rejected") await updateOffsite(s, row.id, { status: "todo" }, project.id);
      await upsertStateTask(s, project.id, itemId, TASK_STATUS[action], {
        title: `Get listed on ${row.name}`.slice(0, 200),
        category: "offsite",
        priority: "medium",
        links: row.url ? [row.url] : [],
      });
    }
  } else {
    const issue = report?.issues.find((i) => i.id === parsed.issueId) ?? null;
    const existing = issue ? null : await findStateTask(s, project.id, parsed.issueId);
    if (!issue && !existing) throw new HttpError(404, "not_found", "That problem isn't in your latest check");
    let taskId: string;
    if (issue) {
      const fix = resolveFix({ brand: project.name, websiteUrl: project.websiteUrl, platform: "custom", issue, pages: [] });
      taskId = await upsertStateTask(s, project.id, issue.id, TASK_STATUS[action], {
        title: fixTitle(issue),
        description: issue.whatsWrong.slice(0, 4900),
        category: fix.category === "offsite" || fix.category === "content" || fix.category === "technical" ? fix.category : "onsite",
        priority: PRIORITY[issue.impact],
        links: issue.affectedUrls,
      });
    } else {
      taskId = existing!.id;
      await updateTask(s, taskId, { status: TASK_STATUS[action] });
    }
    const url = opts.url ?? issue?.affectedUrls[0];
    if (action === "done" && opts.recheck !== false && issue && url) {
      recheck = await recheckIssuePage({
        organizationId: s.organizationId,
        projectId: project.id,
        crawlRunId: report?.crawl.crawlRunId ?? null,
        websiteUrl: project.websiteUrl,
        brandNames: strArr(project.brandNames),
        competitors: competitorsOf(project.competitors),
        issueId: issue.id,
        url,
      }).catch(() => null);
      if (recheck) await saveRecheck(s, taskId, recheck);
    }
  }

  const { items } = await loadTodo(s, project.id, report);
  return { state: action, recheck, nextId: nextTodo(items, itemId)?.id ?? null };
}

async function saveRecheck(s: SessionContext, taskId: string, recheck: TaskRecheck) {
  const t = await db.task.findFirst({ where: { id: taskId, organizationId: s.organizationId }, select: { evidence: true } });
  if (!t) return;
  const ev = readEvidence(t.evidence);
  await db.task.updateMany({
    where: { id: taskId, organizationId: s.organizationId },
    data: { evidence: { links: ev.links, ...(ev.todoKey ? { todoKey: ev.todoKey } : {}), recheck: { ...recheck } } },
  });
}

/** Looks at an issue's page again on request (the "Check again" link on a done fix). */
export async function recheckTodo(
  s: SessionContext,
  project: { id: string; websiteUrl: string; brandNames: unknown; competitors: unknown },
  issueId: string,
  url?: string,
): Promise<TaskRecheck | null> {
  if (!canEditTasks(s)) throw new HttpError(403, "forbidden", "Your role can't run checks");
  const report = await getStoredReport(project.id, s.organizationId).catch(() => null);
  const issue = report?.issues.find((i) => i.id === issueId);
  const target = url && issue?.affectedUrls.includes(url) ? url : issue?.affectedUrls[0];
  if (!issue || !target) return null;
  const recheck = await recheckIssuePage({
    organizationId: s.organizationId,
    projectId: project.id,
    crawlRunId: report?.crawl.crawlRunId ?? null,
    websiteUrl: project.websiteUrl,
    brandNames: strArr(project.brandNames),
    competitors: competitorsOf(project.competitors),
    issueId,
    url: target,
  });
  const st = await findStateTask(s, project.id, issueId, fixTitle(issue));
  if (st) await saveRecheck(s, st.id, recheck);
  return recheck;
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);
function competitorsOf(v: unknown): { name: string; domain?: string }[] {
  return (Array.isArray(v) ? v : []).filter(
    (c): c is { name: string; domain?: string } => !!c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string",
  );
}
