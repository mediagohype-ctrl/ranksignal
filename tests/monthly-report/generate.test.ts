// Status rules end to end with a mocked DB: service clients get a draft, self-serve reports are sent
// (notification + email to owners/admins, respecting project email preferences).
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string };
const h = vi.hoisted(() => ({
  serviceTier: null as string | null,
  emailPref: true,
  reports: [] as Row[],
  notifications: [] as Row[],
  emails: [] as { to: string; subject: string }[],
}));

vi.mock("@/lib/db", () => {
  const match = (r: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "projectId_period") {
        const pp = v as { projectId: string; period: string };
        return r.projectId === pp.projectId && r.period === pp.period;
      }
      if (v && typeof v === "object" && "not" in (v as object)) return r[k] !== (v as { not: unknown }).not;
      return r[k] === v;
    });
  const db = {
    project: {
      findFirst: async ({ select }: { select: Record<string, unknown> }) =>
        select.settings
          ? { settings: { notifications: { email: h.emailPref } } }
          : { id: "p1", name: "Acme", websiteUrl: "https://www.acme.test", brandNames: ["Acme"], organization: { serviceTier: h.serviceTier } },
    },
    monthlyReport: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => h.reports.find((r) => match(r, where)) ?? null,
      upsert: async ({ where, create, update }: { where: Record<string, unknown>; create: Row; update: Row }) => {
        const cur = h.reports.find((r) => match(r, where));
        if (cur) return Object.assign(cur, update);
        const row = { ...create, id: `r${h.reports.length + 1}`, sentAt: null, createdAt: new Date() } as Row;
        h.reports.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(h.reports.find((r) => r.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
        const rows = h.reports.filter((r) => match(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    visibilityRun: { findMany: async () => [], findFirst: async () => null },
    observation: { findMany: async () => [] },
    auditFinding: { findMany: async () => [] },
    notification: {
      findFirst: async () => null,
      create: async ({ data }: { data: Row }) => {
        h.notifications.push(data);
        return data;
      },
    },
    membership: {
      findMany: async () => [{ user: { email: "owner@acme.test" } }, { user: { email: "admin@acme.test" } }],
    },
  };
  return { db };
});
vi.mock("@/lib/snapshots", () => ({
  getSnapshotAt: async () => null,
  listSnapshots: async () => [],
  compareSnapshots: async () => ({ notes: [] }),
}));
vi.mock("@/lib/tasks", () => ({
  listShippedWork: async () => [
    { kind: "task", title: "Rewrote home page title", category: "onsite", performedBy: "agency", completedAt: new Date("2026-10-10T00:00:00Z") },
  ],
  listOpenWork: async () => [],
}));
vi.mock("@/lib/report/build", () => ({ buildSiteReport: async () => ({ issues: [] }) }));
vi.mock("@/lib/providers/llm", () => ({ isLlmConfigured: () => false, generateStructured: async () => null }));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: async () => undefined }));
vi.mock("@/lib/email/send", () => ({
  isEmailConfigured: () => true,
  sendEmail: async (o: { to: string; subject: string }) => {
    h.emails.push({ to: o.to, subject: o.subject });
    return { ok: true };
  },
}));

import { generateMonthlyReport } from "@/lib/monthly-report/generate";
import type { MonthlyReportPayload } from "@/lib/monthly-report/types";

const NOW = new Date("2026-11-02T00:00:00Z");

beforeEach(() => {
  h.serviceTier = null;
  h.emailPref = true;
  h.reports = [];
  h.notifications = [];
  h.emails = [];
});

describe("generateMonthlyReport status rules", () => {
  it("service clients get a draft and nothing is sent", async () => {
    h.serviceTier = "grow";
    const r = await generateMonthlyReport("p1", "o1", "2026-10", { now: NOW });
    expect(r.status).toBe("draft");
    expect(h.notifications).toHaveLength(0);
    expect(h.emails).toHaveLength(0);
    const p = r.payload as unknown as MonthlyReportPayload;
    expect(p.work.shipped).toHaveLength(1);
    expect(p.attribution).toMatch(/correlation/);
    expect(p.notes.join(" ")).toMatch(/UTC/);
    expect(typeof r.summary).toBe("string");
  });

  it("self-serve reports are sent immediately with a notification and emails", async () => {
    const r = await generateMonthlyReport("p1", "o1", "2026-10", { now: NOW });
    expect(r.status).toBe("sent");
    expect(r.sentAt).toBeInstanceOf(Date);
    expect(h.notifications).toHaveLength(1);
    expect(h.notifications[0]!.link).toBe("/app/projects/p1/monthly/2026-10");
    expect(h.emails.map((e) => e.to).sort()).toEqual(["admin@acme.test", "owner@acme.test"]);
  });

  it("respects the project's email preference", async () => {
    h.emailPref = false;
    const r = await generateMonthlyReport("p1", "o1", "2026-10", { now: NOW });
    expect(r.status).toBe("sent");
    expect(h.notifications).toHaveLength(1);
    expect(h.emails).toHaveLength(0);
  });

  it("is idempotent: a sent report is not regenerated or re-sent", async () => {
    await generateMonthlyReport("p1", "o1", "2026-10", { now: NOW });
    const again = await generateMonthlyReport("p1", "o1", "2026-10", { now: NOW });
    expect(again.status).toBe("sent");
    expect(h.reports).toHaveLength(1);
    expect(h.emails).toHaveLength(2);
  });

  it("holdForReview keeps a self-serve report as a draft", async () => {
    const r = await generateMonthlyReport("p1", "o1", "2026-10", { now: NOW, holdForReview: true });
    expect(r.status).toBe("draft");
    expect(h.emails).toHaveLength(0);
  });
});
