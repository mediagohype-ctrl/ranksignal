import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionContext } from "@/lib/types";

// db is fully mocked: nothing here can reach a real database.
const h = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    db: {
      task: { findMany: fn(), findFirst: fn(), create: fn(), updateMany: fn(), deleteMany: fn() },
      taskComment: { findMany: fn(), create: fn() },
      actionExecution: { findMany: fn() },
      action: { findFirst: fn() },
      auditFinding: { findFirst: fn() },
      project: { findFirst: fn() },
      membership: { findFirst: fn(), findMany: fn() },
      user: { findMany: fn(), findUnique: fn() },
      auditLog: { findMany: fn() },
    },
    audit: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: h.audit }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));

import {
  addComment,
  createTask,
  getTask,
  groupByWeek,
  listComments,
  listShippedWork,
  listTasks,
  mergeShipped,
  nextCompletedAt,
  updateTask,
} from "@/lib/tasks";

const ORG = "org_1";
const viewer: SessionContext = { userId: "u_v", email: "v@x.test", organizationId: ORG, role: "viewer" };
const member: SessionContext = { ...viewer, userId: "u_m", role: "member" };
const admin: SessionContext = { ...viewer, userId: "u_a", role: "admin" };
const staff: SessionContext = { ...viewer, userId: "u_s", role: "admin", staffMode: true };

function taskRow(over: Record<string, unknown> = {}) {
  const now = new Date("2026-10-10T10:00:00Z");
  return {
    id: "t1", organizationId: ORG, projectId: "p1", actionId: null, findingId: null, title: "Fix titles", description: null,
    category: "onsite", performedBy: "agency", assigneeId: null, createdById: "u_m", status: "backlog", priority: "medium",
    dueAt: null, completedAt: null, clientVisible: true, shippedUrl: null, evidence: null, createdAt: now, updatedAt: now,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.db.user.findMany.mockResolvedValue([]);
  h.db.project.findFirst.mockResolvedValue({ id: "p1" });
});

describe("listShippedWork", () => {
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-11-01T00:00:00Z");

  it("merges done tasks with succeeded executions in range, newest first, without double counting", async () => {
    h.db.task.findMany.mockResolvedValue([
      { id: "t1", title: "Rewrote service page", category: "content", performedBy: "agency", completedAt: new Date("2026-10-05T00:00:00Z"), shippedUrl: "https://acme.test/services", actionId: null },
      { id: "t2", title: "Approved homepage title", category: "onsite", performedBy: "client", completedAt: new Date("2026-10-20T00:00:00Z"), shippedUrl: null, actionId: "a_linked" },
    ]);
    h.db.actionExecution.findMany.mockResolvedValue([
      { id: "e1", finishedAt: new Date("2026-10-12T00:00:00Z"), rollbackStatus: "not_needed", action: { id: "a1", type: "update_meta_description", target: { url: "https://acme.test/about" } } },
      { id: "e2", finishedAt: new Date("2026-10-13T00:00:00Z"), rollbackStatus: "rolled_back", action: { id: "a2", type: "update_title", target: null } },
      { id: "e3", finishedAt: new Date("2026-10-14T00:00:00Z"), rollbackStatus: "not_needed", action: { id: "a_linked", type: "update_title", target: null } },
      { id: "e4", finishedAt: new Date("2026-11-02T00:00:00Z"), rollbackStatus: "not_needed", action: { id: "a3", type: "add_faq_schema", target: null } },
    ]);

    const items = await listShippedWork("p1", ORG, from, to);

    expect(items.map((i) => [i.kind, i.taskId ?? i.actionId])).toEqual([
      ["task", "t2"],
      ["change", "a1"],
      ["task", "t1"],
    ]);
    const change = items[1];
    expect(change).toMatchObject({ title: "Updated meta description", performedBy: "system", category: "onsite", url: "https://acme.test/about" });

    const taskWhere = h.db.task.findMany.mock.calls[0][0].where;
    expect(taskWhere).toMatchObject({ organizationId: ORG, projectId: "p1", status: "done", completedAt: { gte: from, lt: to } });
    expect(taskWhere.clientVisible).toBeUndefined();
    const exWhere = h.db.actionExecution.findMany.mock.calls[0][0].where;
    expect(exWhere).toMatchObject({ organizationId: ORG, result: "success", finishedAt: { gte: from, lt: to }, action: { organizationId: ORG, projectId: "p1" } });
  });

  it("filters to client-visible tasks when asked", async () => {
    h.db.task.findMany.mockResolvedValue([]);
    h.db.actionExecution.findMany.mockResolvedValue([]);
    await listShippedWork("p1", ORG, from, to, { clientVisibleOnly: true });
    expect(h.db.task.findMany.mock.calls[0][0].where.clientVisible).toBe(true);
  });

  it("mergeShipped drops items outside [from, to)", () => {
    const out = mergeShipped(
      [{ id: "t", title: "x", category: "other", performedBy: "agency", completedAt: to, shippedUrl: null, actionId: null }],
      [{ id: "e", finishedAt: from, rollbackStatus: null, action: { id: "a", type: "content_brief", target: null } }],
      from,
      to,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "change", category: "content", completedAt: from });
  });

  it("groups by week, newest week first", () => {
    const g = groupByWeek([
      { completedAt: "2026-10-05T09:00:00Z" }, // Monday
      { completedAt: "2026-10-11T09:00:00Z" }, // Sunday, same week
      { completedAt: "2026-10-12T09:00:00Z" }, // next Monday
    ]);
    expect(g.map((w) => [w.weekOf.slice(0, 10), w.items.length])).toEqual([
      ["2026-10-12", 1],
      ["2026-10-05", 2],
    ]);
  });
});

describe("visibility rules", () => {
  it("viewers and members only list client-visible tasks; admins and staff see internal ones", async () => {
    h.db.task.findMany.mockResolvedValue([]);
    for (const s of [viewer, member]) {
      await listTasks(s, "p1");
      expect(h.db.task.findMany.mock.lastCall![0].where).toMatchObject({ organizationId: ORG, projectId: "p1", clientVisible: true });
    }
    for (const s of [admin, staff]) {
      await listTasks(s, "p1");
      const where = h.db.task.findMany.mock.lastCall![0].where;
      expect(where.organizationId).toBe(ORG);
      expect(where.clientVisible).toBeUndefined();
    }
  });

  it("an internal task looks missing to a viewer", async () => {
    h.db.task.findFirst.mockResolvedValue(null);
    await expect(getTask(viewer, "t_internal")).rejects.toMatchObject({ status: 404 });
    expect(h.db.task.findFirst.mock.calls[0][0].where).toEqual({ id: "t_internal", organizationId: ORG, clientVisible: true });
  });

  it("viewers never receive internal comments; staff do", async () => {
    h.db.task.findFirst.mockResolvedValue(taskRow());
    h.db.taskComment.findMany.mockResolvedValue([]);
    await listComments(viewer, "t1");
    expect(h.db.taskComment.findMany.mock.lastCall![0].where).toMatchObject({ taskId: "t1", organizationId: ORG, internal: false });
    await listComments(staff, "t1");
    expect(h.db.taskComment.findMany.mock.lastCall![0].where.internal).toBeUndefined();
  });

  it("viewers can't write; members can't add internal notes or internal tasks", async () => {
    await expect(createTask(viewer, "p1", { title: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(addComment(member, "t1", { body: "secret", internal: true })).rejects.toMatchObject({ status: 403 });
    await expect(createTask(member, "p1", { title: "x", clientVisible: false })).rejects.toMatchObject({ status: 403 });
    expect(h.db.task.create).not.toHaveBeenCalled();
    expect(h.db.taskComment.create).not.toHaveBeenCalled();
  });

  it("rejects an assignee who isn't an active member, but allows the staff user in support mode", async () => {
    h.db.membership.findFirst.mockResolvedValue(null);
    await expect(createTask(admin, "p1", { title: "x", assigneeId: "stranger" })).rejects.toMatchObject({ status: 400 });
    h.db.task.create.mockResolvedValue(taskRow({ id: "t9", assigneeId: "u_s" }));
    h.db.task.findFirst.mockResolvedValue(taskRow({ id: "t9", assigneeId: "u_s" }));
    await expect(createTask(staff, "p1", { title: "x", assigneeId: "u_s" })).resolves.toMatchObject({ id: "t9" });
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "task.created", actorType: "staff", organizationId: ORG }));
  });
});

describe("completedAt", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const earlier = new Date("2026-10-01T00:00:00Z");

  it("is set on → done, kept while done, cleared otherwise", () => {
    expect(nextCompletedAt(null, "done", now)).toEqual(now);
    expect(nextCompletedAt({ status: "in_progress", completedAt: null }, "done", now)).toEqual(now);
    expect(nextCompletedAt({ status: "done", completedAt: earlier }, "done", now)).toEqual(earlier);
    expect(nextCompletedAt({ status: "done", completedAt: earlier }, "in_progress", now)).toBeNull();
    expect(nextCompletedAt(null, "backlog", now)).toBeNull();
  });

  it("updateTask sets completedAt when moved to done and writes a status audit entry", async () => {
    h.db.task.findFirst.mockResolvedValue(taskRow({ status: "in_progress" }));
    h.db.task.updateMany.mockResolvedValue({ count: 1 });
    await updateTask(member, "t1", { status: "done" });
    const call = h.db.task.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "t1", organizationId: ORG });
    expect(call.data.status).toBe("done");
    expect(call.data.completedAt).toBeInstanceOf(Date);
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "task.status_changed", before: { status: "in_progress" }, after: { status: "done" } }),
    );
  });

  it("updateTask clears completedAt when a done task is reopened", async () => {
    h.db.task.findFirst.mockResolvedValue(taskRow({ status: "done", completedAt: earlier }));
    h.db.task.updateMany.mockResolvedValue({ count: 1 });
    await updateTask(member, "t1", { status: "in_progress" });
    expect(h.db.task.updateMany.mock.calls[0][0].data).toMatchObject({ status: "in_progress", completedAt: null });
  });

  it("editing other fields leaves status and completedAt alone (no audit entry)", async () => {
    h.db.task.findFirst.mockResolvedValue(taskRow({ status: "done", completedAt: earlier }));
    h.db.task.updateMany.mockResolvedValue({ count: 1 });
    await updateTask(member, "t1", { title: "Better title", status: "done" });
    const data = h.db.task.updateMany.mock.calls[0][0].data;
    expect(data.title).toBe("Better title");
    expect("completedAt" in data).toBe(false);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("createTask with status done records completedAt", async () => {
    h.db.task.create.mockResolvedValue(taskRow({ status: "done" }));
    h.db.task.findFirst.mockResolvedValue(taskRow({ status: "done" }));
    await createTask(member, "p1", { title: "Already shipped", status: "done" });
    expect(h.db.task.create.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    await createTask(member, "p1", { title: "Planned" });
    expect(h.db.task.create.mock.calls[1][0].data.completedAt).toBeNull();
  });
});
