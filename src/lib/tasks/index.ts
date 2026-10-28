// Service delivery work board: tasks, comments, history and the client-facing work log.
// Every query is scoped by organizationId from the session (never from the request body).
import { Prisma, type Task } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { BRAND } from "@/lib/brand";
import type { SessionContext } from "@/lib/types";
import {
  OPEN_STATUSES,
  STATUS_LABEL,
  TASK_CATEGORIES,
  TASK_PERFORMERS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  asCategory,
  asPerformer,
  asPriority,
  asStatus,
  nextCompletedAt,
  readEvidence,
  type AssigneeOption,
  type OpenWorkItem,
  type ShippedItem,
  type TaskCategory,
  type TaskCommentView,
  type TaskDraft,
  type TaskHistoryEntry,
  type TaskView,
} from "./types";

export * from "./types";

// ---------------------------------------------------------------------------------------------
// Access rules

type Access = Pick<SessionContext, "role" | "staffMode">;

/** Admins/owners and staff in support mode see internal tasks and internal comments. */
export function canSeeInternal(s: Access): boolean {
  return !!s.staffMode || s.role === "admin" || s.role === "owner";
}
export function canEditTasks(s: Access): boolean {
  return s.role !== "viewer";
}
export function canDeleteTasks(s: Access): boolean {
  return canSeeInternal(s);
}
/** Extra where-clause hiding internal tasks from viewers and members. */
export function taskVisibilityWhere(s: Access): Prisma.TaskWhereInput {
  return canSeeInternal(s) ? {} : { clientVisible: true };
}
export function commentVisibilityWhere(s: Access): Prisma.TaskCommentWhereInput {
  return canSeeInternal(s) ? {} : { internal: false };
}

function actorType(s: SessionContext): "user" | "staff" {
  return s.staffMode ? "staff" : "user";
}

// ---------------------------------------------------------------------------------------------
// Validation

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Must start with http:// or https://");

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());

const optionalUrl = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), httpUrl.nullable().optional());

const optionalId = z.preprocess((v) => (v === "" ? null : v), z.string().min(1).max(64).nullable().optional());

const optionalDate = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return typeof v === "string" || typeof v === "number" ? new Date(v) : v;
}, z.date().nullable().optional());

const taskFields = {
  title: z.string().trim().min(1, "Add a title").max(200),
  description: optionalText(5000),
  category: z.enum(TASK_CATEGORIES),
  performedBy: z.enum(TASK_PERFORMERS),
  assigneeId: optionalId,
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueAt: optionalDate,
  clientVisible: z.boolean(),
  shippedUrl: optionalUrl,
  evidence: z.object({ links: z.array(httpUrl).max(20) }).nullable().optional(),
  actionId: optionalId,
  findingId: optionalId,
};

export const taskCreateSchema = z.object({
  ...taskFields,
  category: taskFields.category.default("onsite"),
  performedBy: taskFields.performedBy.default("agency"),
  status: taskFields.status.default("backlog"),
  priority: taskFields.priority.default("medium"),
  clientVisible: taskFields.clientVisible.default(true),
});
export const taskPatchSchema = z.object(taskFields).partial();
export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(5000),
  internal: z.boolean().optional().default(false),
});
export const taskFilterSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  performedBy: z.enum(TASK_PERFORMERS).optional(),
  /** A user id, "me" or "none". */
  assignee: z.string().max(64).optional(),
  q: z.string().trim().max(200).optional(),
});
export const fromSourceSchema = z
  .object({
    findingId: z.string().min(1).max(64).optional(),
    actionId: z.string().min(1).max(64).optional(),
    overrides: taskPatchSchema.omit({ actionId: true, findingId: true }).optional(),
  })
  .refine((v) => !!v.findingId !== !!v.actionId, "Pass exactly one of findingId or actionId");

export type TaskCreateInput = z.input<typeof taskCreateSchema>;
export type TaskPatchInput = z.input<typeof taskPatchSchema>;
export type TaskFilters = z.infer<typeof taskFilterSchema>;

// ---------------------------------------------------------------------------------------------
// Helpers

async function userNames(ids: (string | null | undefined)[]): Promise<Map<string, { name: string; staff: boolean }>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (!unique.length) return new Map();
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true, isStaff: true } });
  return new Map(users.map((u) => [u.id, { name: u.name?.trim() || u.email.split("@")[0], staff: u.isStaff }]));
}

export function toTaskView(t: Task, assigneeName: string | null = null): TaskView {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    category: asCategory(t.category),
    performedBy: asPerformer(t.performedBy),
    assigneeId: t.assigneeId,
    assigneeName,
    createdById: t.createdById,
    status: asStatus(t.status),
    priority: asPriority(t.priority),
    dueAt: t.dueAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    clientVisible: t.clientVisible,
    shippedUrl: t.shippedUrl,
    evidence: readEvidence(t.evidence),
    actionId: t.actionId,
    findingId: t.findingId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function withAssigneeNames(tasks: Task[]): Promise<TaskView[]> {
  const names = await userNames(tasks.map((t) => t.assigneeId));
  return tasks.map((t) => toTaskView(t, t.assigneeId ? (names.get(t.assigneeId)?.name ?? null) : null));
}

async function assertProject(s: SessionContext, projectId: string) {
  const p = await db.project.findFirst({ where: { id: projectId, organizationId: s.organizationId }, select: { id: true } });
  if (!p) throw new HttpError(404, "not_found", "Project not found");
}

/** Loads a task the session may see, or throws 404 (internal tasks look missing to clients). */
async function loadTask(s: SessionContext, taskId: string): Promise<Task> {
  const t = await db.task.findFirst({ where: { id: taskId, organizationId: s.organizationId, ...taskVisibilityWhere(s) } });
  if (!t) throw new HttpError(404, "not_found", "Task not found");
  return t;
}

/** Assignee must be an active member of the org, or the staff user themself while in support mode. */
async function assertAssignee(s: SessionContext, assigneeId: string) {
  if (s.staffMode && assigneeId === s.userId) return;
  const m = await db.membership.findFirst({
    where: { organizationId: s.organizationId, userId: assigneeId, status: "active" },
    select: { id: true },
  });
  if (!m) throw new HttpError(400, "invalid_assignee", "That person isn't an active member of this workspace");
}

async function assertLinks(s: SessionContext, projectId: string, o: { actionId?: string | null; findingId?: string | null }) {
  if (o.actionId) {
    const a = await db.action.findFirst({ where: { id: o.actionId, organizationId: s.organizationId, projectId }, select: { id: true } });
    if (!a) throw new HttpError(400, "invalid_action", "Linked action not found in this project");
  }
  if (o.findingId) {
    const f = await db.auditFinding.findFirst({ where: { id: o.findingId, organizationId: s.organizationId, projectId }, select: { id: true } });
    if (!f) throw new HttpError(400, "invalid_finding", "Linked finding not found in this project");
  }
}

function evidenceJson(e: { links: string[] } | null | undefined) {
  if (e === undefined) return undefined;
  if (e === null || !e.links.length) return Prisma.JsonNull;
  return { links: Array.from(new Set(e.links)) } as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------------------------
// Task CRUD

export async function listTasks(s: SessionContext, projectId: string, filters: TaskFilters = {}): Promise<TaskView[]> {
  const where: Prisma.TaskWhereInput = {
    organizationId: s.organizationId,
    projectId,
    ...taskVisibilityWhere(s),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.performedBy ? { performedBy: filters.performedBy } : {}),
  };
  if (filters.assignee === "me") where.assigneeId = s.userId;
  else if (filters.assignee === "none") where.assigneeId = null;
  else if (filters.assignee) where.assigneeId = filters.assignee;
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  const rows = await db.task.findMany({ where, orderBy: [{ updatedAt: "desc" }], take: 500 });
  return withAssigneeNames(rows);
}

export async function getTask(s: SessionContext, taskId: string): Promise<TaskView> {
  const [view] = await withAssigneeNames([await loadTask(s, taskId)]);
  return view;
}

export async function createTask(s: SessionContext, projectId: string, raw: TaskCreateInput): Promise<TaskView> {
  if (!canEditTasks(s)) throw new HttpError(403, "forbidden", "You can view tasks but not create them");
  const input = taskCreateSchema.parse(raw);
  await assertProject(s, projectId);
  if (!input.clientVisible && !canSeeInternal(s)) {
    throw new HttpError(403, "forbidden", "Only admins can create internal tasks");
  }
  if (input.assigneeId) await assertAssignee(s, input.assigneeId);
  await assertLinks(s, projectId, input);

  const task = await db.task.create({
    data: {
      organizationId: s.organizationId,
      projectId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      performedBy: input.performedBy,
      assigneeId: input.assigneeId ?? null,
      createdById: s.userId,
      status: input.status,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      completedAt: nextCompletedAt(null, input.status),
      clientVisible: input.clientVisible,
      shippedUrl: input.shippedUrl ?? null,
      evidence: evidenceJson(input.evidence) ?? Prisma.JsonNull,
      actionId: input.actionId ?? null,
      findingId: input.findingId ?? null,
    },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    actorType: actorType(s),
    action: "task.created",
    resourceType: "task",
    resourceId: task.id,
    after: { title: task.title, status: task.status, projectId, clientVisible: task.clientVisible },
  });
  return getTask(s, task.id);
}

export async function updateTask(s: SessionContext, taskId: string, raw: TaskPatchInput): Promise<TaskView> {
  if (!canEditTasks(s)) throw new HttpError(403, "forbidden", "You can view tasks but not edit them");
  const patch = taskPatchSchema.parse(raw);
  const prev = await loadTask(s, taskId);
  if (patch.clientVisible === false && !canSeeInternal(s)) {
    throw new HttpError(403, "forbidden", "Only admins can hide tasks from the client");
  }
  if (patch.assigneeId && patch.assigneeId !== prev.assigneeId) await assertAssignee(s, patch.assigneeId);
  await assertLinks(s, prev.projectId, {
    actionId: patch.actionId !== prev.actionId ? patch.actionId : undefined,
    findingId: patch.findingId !== prev.findingId ? patch.findingId : undefined,
  });

  const data: Prisma.TaskUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.category !== undefined) data.category = patch.category;
  if (patch.performedBy !== undefined) data.performedBy = patch.performedBy;
  if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId;
  if (patch.priority !== undefined) data.priority = patch.priority;
  if (patch.dueAt !== undefined) data.dueAt = patch.dueAt;
  if (patch.clientVisible !== undefined) data.clientVisible = patch.clientVisible;
  if (patch.shippedUrl !== undefined) data.shippedUrl = patch.shippedUrl;
  if (patch.actionId !== undefined) data.actionId = patch.actionId;
  if (patch.findingId !== undefined) data.findingId = patch.findingId;
  const ev = evidenceJson(patch.evidence);
  if (ev !== undefined) data.evidence = ev;
  const statusChanged = patch.status !== undefined && patch.status !== prev.status;
  if (statusChanged) {
    data.status = patch.status;
    data.completedAt = nextCompletedAt(prev, patch.status!);
  }

  // updateMany keeps the organization filter on the write itself.
  const res = await db.task.updateMany({ where: { id: prev.id, organizationId: s.organizationId }, data: data as Prisma.TaskUpdateManyMutationInput });
  if (res.count === 0) throw new HttpError(404, "not_found", "Task not found");
  if (statusChanged) {
    await writeAuditLog({
      organizationId: s.organizationId,
      actorId: s.userId,
      actorType: actorType(s),
      action: "task.status_changed",
      resourceType: "task",
      resourceId: prev.id,
      before: { status: prev.status },
      after: { status: patch.status },
    });
  }
  return getTask(s, prev.id);
}

export async function deleteTask(s: SessionContext, taskId: string): Promise<void> {
  if (!canDeleteTasks(s)) throw new HttpError(403, "forbidden", "Only admins can delete tasks");
  const prev = await loadTask(s, taskId);
  await db.task.deleteMany({ where: { id: prev.id, organizationId: s.organizationId } });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    actorType: actorType(s),
    action: "task.deleted",
    resourceType: "task",
    resourceId: prev.id,
    before: { title: prev.title, status: prev.status, projectId: prev.projectId },
  });
}

// ---------------------------------------------------------------------------------------------
// Comments + history

export async function listComments(s: SessionContext, taskId: string): Promise<TaskCommentView[]> {
  const task = await loadTask(s, taskId);
  const rows = await db.taskComment.findMany({
    where: { taskId: task.id, organizationId: s.organizationId, ...commentVisibilityWhere(s) },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  const names = await userNames(rows.map((r) => r.authorId));
  return rows.map((r) => {
    const who = r.authorId ? names.get(r.authorId) : undefined;
    return {
      id: r.id,
      taskId: r.taskId,
      authorId: r.authorId,
      authorName: who ? (who.staff ? `${who.name} (${BRAND.name} team)` : who.name) : "Someone",
      body: r.body,
      internal: r.internal,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function addComment(
  s: SessionContext,
  taskId: string,
  raw: z.input<typeof commentCreateSchema>,
): Promise<TaskCommentView> {
  if (!canEditTasks(s)) throw new HttpError(403, "forbidden", "You can read comments but not add them");
  const input = commentCreateSchema.parse(raw);
  if (input.internal && !canSeeInternal(s)) throw new HttpError(403, "forbidden", "Only our team can add internal notes");
  const task = await loadTask(s, taskId);
  const c = await db.taskComment.create({
    data: { organizationId: s.organizationId, taskId: task.id, authorId: s.userId, body: input.body, internal: input.internal },
  });
  const who = (await userNames([s.userId])).get(s.userId);
  return {
    id: c.id,
    taskId: c.taskId,
    authorId: c.authorId,
    authorName: who ? (s.staffMode ? `${who.name} (${BRAND.name} team)` : who.name) : "You",
    body: c.body,
    internal: c.internal,
    createdAt: c.createdAt.toISOString(),
  };
}

function statusText(v: unknown): string {
  const st = v && typeof v === "object" ? (v as { status?: unknown }).status : undefined;
  return typeof st === "string" ? (STATUS_LABEL[asStatus(st)] ?? st) : "—";
}

/** Status history for a task, read from the audit log. */
export async function getTaskHistory(s: SessionContext, taskId: string): Promise<TaskHistoryEntry[]> {
  const task = await loadTask(s, taskId);
  const rows = await db.auditLog.findMany({
    where: { organizationId: s.organizationId, resourceType: "task", resourceId: task.id, action: { in: ["task.created", "task.status_changed"] } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const names = await userNames(rows.map((r) => r.actorId));
  return rows.map((r) => {
    const who = r.actorId ? names.get(r.actorId) : undefined;
    const actorName =
      r.actorType === "system" ? "Automated" : who ? (who.staff || r.actorType === "staff" ? `${who.name} (${BRAND.name} team)` : who.name) : "Someone";
    const label =
      r.action === "task.created" ? `Created in ${statusText(r.after)}` : `Moved from ${statusText(r.before)} to ${statusText(r.after)}`;
    return { id: r.id, action: r.action, label, actorName, createdAt: r.createdAt.toISOString() };
  });
}

/** People a task can be assigned to: active members, plus the staff user while in support mode. */
export async function listAssignees(s: SessionContext): Promise<AssigneeOption[]> {
  const members = await db.membership.findMany({
    where: { organizationId: s.organizationId, status: "active" },
    select: { user: { select: { id: true, name: true, email: true } } },
    take: 200,
  });
  const out: AssigneeOption[] = members.map((m) => ({ id: m.user.id, name: m.user.name?.trim() || m.user.email }));
  if (s.staffMode && !out.some((o) => o.id === s.userId)) {
    const me = await db.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } });
    if (me) out.push({ id: s.userId, name: `${me.name?.trim() || me.email} (${BRAND.name} team)`, staff: true });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// Create from a finding / action

const ACTION_TITLE: Record<string, string> = {
  update_meta_description: "Update meta description",
  update_title: "Update page title",
  add_faq_schema: "Add FAQ structured data",
  update_schema: "Update structured data",
  update_content: "Update page content",
  update_excerpt: "Update page excerpt",
  content_brief: "Write content from brief",
};
const ACTION_DONE_TITLE: Record<string, string> = {
  update_meta_description: "Updated meta description",
  update_title: "Updated page title",
  add_faq_schema: "Added FAQ structured data",
  update_schema: "Updated structured data",
  update_content: "Updated page content",
  update_excerpt: "Updated page excerpt",
  content_brief: "Published content from brief",
};

function humanizeType(t: string): string {
  const s = t.replace(/[_.-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function categoryForAction(type: string): TaskCategory {
  if (type === "content_brief" || type === "update_content") return "content";
  if (type.includes("schema")) return "technical";
  return "onsite";
}

export function categoryForFinding(category: string): TaskCategory {
  if (category === "content") return "content";
  if (["technical", "indexability", "links"].includes(category)) return "technical";
  return "onsite";
}

function pathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname.replace(/^www\./, "") : u.pathname;
  } catch {
    return null;
  }
}

function targetUrl(target: unknown): string | null {
  const url = target && typeof target === "object" ? (target as { url?: unknown }).url : undefined;
  return typeof url === "string" ? url : null;
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function prefillFromSource(
  s: SessionContext,
  projectId: string,
  src: { findingId?: string; actionId?: string },
): Promise<TaskDraft> {
  if (src.findingId) {
    const f = await db.auditFinding.findFirst({ where: { id: src.findingId, organizationId: s.organizationId, projectId } });
    if (!f) throw new HttpError(404, "not_found", "Finding not found");
    const where = pathOf(f.pageUrl);
    const priority = f.severity === "critical" || f.severity === "high" ? "high" : f.severity === "medium" ? "medium" : "low";
    return {
      title: clip(`Fix: ${f.message}${where ? ` (${where})` : ""}`, 200),
      description: [f.message, f.pageUrl ? `Page: ${f.pageUrl}` : null, `Rule: ${f.code}`].filter(Boolean).join("\n"),
      category: categoryForFinding(f.category),
      performedBy: "agency",
      priority,
      findingId: f.id,
      shippedUrl: f.pageUrl ?? undefined,
    };
  }
  if (src.actionId) {
    const a = await db.action.findFirst({ where: { id: src.actionId, organizationId: s.organizationId, projectId } });
    if (!a) throw new HttpError(404, "not_found", "Action not found");
    const url = targetUrl(a.target);
    const where = pathOf(url);
    const base = ACTION_TITLE[a.type] ?? humanizeType(a.type);
    return {
      title: clip(`${base}${where ? ` (${where})` : ""}`, 200),
      description: clip(a.rationale, 5000),
      category: categoryForAction(a.type),
      performedBy: "agency",
      priority: asPriority(a.priority === "critical" ? "high" : a.priority),
      actionId: a.id,
      shippedUrl: url ?? undefined,
    };
  }
  throw new HttpError(400, "invalid_source", "Pass a findingId or actionId");
}

export async function createTaskFromSource(
  s: SessionContext,
  projectId: string,
  src: { findingId?: string; actionId?: string; overrides?: TaskPatchInput },
): Promise<TaskView> {
  const draft = await prefillFromSource(s, projectId, src);
  const o = src.overrides ?? {};
  return createTask(s, projectId, { ...draft, ...o, actionId: draft.actionId, findingId: draft.findingId } as TaskCreateInput);
}

// ---------------------------------------------------------------------------------------------
// Contracts (ROUND 4 brief): work log + open work

/** Pure merge used by listShippedWork: tasks first-class, executions de-duplicated against linked tasks. */
export function mergeShipped(
  tasks: Pick<Task, "id" | "title" | "category" | "performedBy" | "completedAt" | "shippedUrl" | "actionId">[],
  executions: { id: string; finishedAt: Date | null; rollbackStatus: string | null; action: { id: string; type: string; target: unknown } }[],
  from: Date,
  to: Date,
): ShippedItem[] {
  const inRange = (d: Date | null): d is Date => !!d && d >= from && d < to;
  const out: ShippedItem[] = [];
  const linkedActions = new Set<string>();
  for (const t of tasks) {
    if (!inRange(t.completedAt)) continue;
    if (t.actionId) linkedActions.add(t.actionId);
    out.push({
      kind: "task",
      title: t.title,
      category: asCategory(t.category),
      performedBy: asPerformer(t.performedBy),
      completedAt: t.completedAt,
      ...(t.shippedUrl ? { url: t.shippedUrl } : {}),
      taskId: t.id,
      ...(t.actionId ? { actionId: t.actionId } : {}),
    });
  }
  const seen = new Set<string>();
  for (const e of executions) {
    if (!inRange(e.finishedAt) || e.rollbackStatus === "rolled_back") continue;
    if (linkedActions.has(e.action.id) || seen.has(e.action.id)) continue;
    seen.add(e.action.id);
    const url = targetUrl(e.action.target);
    out.push({
      kind: "change",
      title: ACTION_DONE_TITLE[e.action.type] ?? humanizeType(e.action.type),
      category: categoryForAction(e.action.type),
      performedBy: "system",
      completedAt: e.finishedAt,
      ...(url ? { url } : {}),
      actionId: e.action.id,
    });
  }
  return out.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

/**
 * Work shipped in [from, to): done tasks (completedAt in range) plus succeeded ActionExecutions
 * (not rolled back). Newest first. Pass clientVisibleOnly for anything a client will read.
 */
export async function listShippedWork(
  projectId: string,
  organizationId: string,
  from: Date,
  to: Date,
  o: { clientVisibleOnly?: boolean } = {},
): Promise<ShippedItem[]> {
  const [tasks, executions] = await Promise.all([
    db.task.findMany({
      where: {
        organizationId,
        projectId,
        status: "done",
        completedAt: { gte: from, lt: to },
        ...(o.clientVisibleOnly ? { clientVisible: true } : {}),
      },
      select: { id: true, title: true, category: true, performedBy: true, completedAt: true, shippedUrl: true, actionId: true },
      orderBy: { completedAt: "desc" },
      take: 500,
    }),
    db.actionExecution.findMany({
      where: {
        organizationId,
        result: "success",
        finishedAt: { gte: from, lt: to },
        action: { organizationId, projectId },
      },
      select: { id: true, finishedAt: true, rollbackStatus: true, action: { select: { id: true, type: true, target: true } } },
      orderBy: { finishedAt: "desc" },
      take: 500,
    }),
  ]);
  return mergeShipped(tasks, executions, from, to);
}

/**
 * Work still open (backlog / in progress / waiting on client / blocked), for the "next month" plan.
 * Defaults to client-visible tasks only, because its consumer (the monthly report) is client-facing.
 */
export async function listOpenWork(
  projectId: string,
  organizationId: string,
  o: { clientVisibleOnly?: boolean } = {},
): Promise<OpenWorkItem[]> {
  const rows = await db.task.findMany({
    where: {
      organizationId,
      projectId,
      status: { in: [...OPEN_STATUSES] },
      ...(o.clientVisibleOnly === false ? {} : { clientVisible: true }),
    },
    select: { title: true, status: true, category: true, dueAt: true, priority: true },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 100,
  });
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (rank[a.r.priority] ?? 1) - (rank[b.r.priority] ?? 1) || a.i - b.i)
    .map(({ r }) => ({ title: r.title, status: r.status, category: r.category, dueAt: r.dueAt }));
}
