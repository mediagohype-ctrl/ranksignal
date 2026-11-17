// Owner decision 2 (15 Nov 2026): deleting or replacing a website must not give the month's AI answers back.
// In-memory DB with the same cascade as the real one: deleting a project removes its runs and observations, but
// the usage ledger (per organization) stays.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Obs {
  runId: string;
  simulated: boolean;
  createdAt: Date;
}
interface Run {
  id: string;
  projectId: string;
  status: string;
  sampleSize: number;
  collected: number;
  failed: number;
  createdAt: Date;
}
interface Ledger {
  taskType: string;
  kind: string;
  credits: number;
  runId: string | null;
  provider: string;
  createdAt: Date;
}

const state = vi.hoisted(() => ({
  org: { planId: "starter", createdAt: new Date("2026-08-01T00:00:00Z") },
  observations: [] as Obs[],
  runs: [] as Run[],
  ledger: [] as Ledger[],
  now: new Date("2026-11-15T10:00:00Z"),
}));

vi.mock("@/lib/db", () => {
  type Range = { gte?: Date; lt?: Date };
  const inRange = (d: Date, w?: Range) => !w || ((!w.gte || d >= w.gte) && (!w.lt || d < w.lt));
  const db = {
    organization: { findUnique: vi.fn(async () => state.org) },
    topUpPack: { findMany: vi.fn(async () => []) },
    observation: {
      count: vi.fn(async ({ where }: { where: { simulated?: boolean; createdAt?: Range; visibilityRunId?: { in: string[] } } }) =>
        state.observations.filter(
          (o) =>
            (where.simulated === undefined || o.simulated === where.simulated) &&
            inRange(o.createdAt, where.createdAt) &&
            (!where.visibilityRunId || where.visibilityRunId.in.includes(o.runId)),
        ).length,
      ),
    },
    visibilityRun: {
      findMany: vi.fn(async ({ where }: { where: { projectId?: string; status?: { in?: string[]; not?: string }; createdAt?: Range } }) =>
        state.runs.filter(
          (r) =>
            (!where.projectId || r.projectId === where.projectId) &&
            (!where.status?.in || where.status.in.includes(r.status)) &&
            (!where.status?.not || r.status !== where.status.not) &&
            inRange(r.createdAt, where.createdAt),
        ),
      ),
    },
    usageLedger: {
      aggregate: vi.fn(async ({ where }: { where: { taskType: string; kind: string; createdAt?: Range; runId?: { in: string[] } } }) => ({
        _sum: {
          credits: state.ledger
            .filter(
              (l) =>
                l.taskType === where.taskType &&
                l.kind === where.kind &&
                inRange(l.createdAt, where.createdAt) &&
                (!where.runId || (l.runId !== null && where.runId.in.includes(l.runId))),
            )
            .reduce((a, l) => a + l.credits, 0),
        },
      })),
      create: vi.fn(async ({ data }: { data: Omit<Ledger, "createdAt" | "runId"> & { runId?: string | null } }) => {
        const row = { ...data, runId: data.runId ?? null, createdAt: state.now };
        state.ledger.push(row);
        return row;
      }),
    },
  };
  return { db };
});

import { AI_ANSWER_TASK_TYPE, DELETED_WEBSITE_PROVIDER, getAiAllowance, keepAnswersOfDeletedProject } from "@/lib/billing/allowance";

const at = (iso: string) => new Date(iso);

/** One finished AI check on a website: `answers` observations + the ledger rows the job writes (1 credit per real answer). */
function runCheck(o: { runId: string; projectId: string; answers: number; when: Date; simulated?: boolean; ledger?: number; status?: string; sampleSize?: number }) {
  state.runs.push({ id: o.runId, projectId: o.projectId, status: o.status ?? "succeeded", sampleSize: o.sampleSize ?? o.answers, collected: o.answers, failed: 0, createdAt: o.when });
  for (let i = 0; i < o.answers; i++) state.observations.push({ runId: o.runId, simulated: !!o.simulated, createdAt: o.when });
  const credits = o.simulated ? 0 : (o.ledger ?? o.answers);
  if (credits > 0) state.ledger.push({ taskType: AI_ANSWER_TASK_TYPE, kind: "actual", credits, runId: o.runId, provider: "openai", createdAt: o.when });
}

/** What the database does on project delete: runs and their observations go, the ledger stays. */
function deleteProject(projectId: string) {
  const ids = state.runs.filter((r) => r.projectId === projectId).map((r) => r.id);
  state.runs = state.runs.filter((r) => r.projectId !== projectId);
  state.observations = state.observations.filter((o) => !ids.includes(o.runId));
}

const left = async (now = state.now) => (await getAiAllowance("org_1", { now })).monthlyLeft;

beforeEach(() => {
  state.org = { planId: "starter", createdAt: new Date("2026-08-01T00:00:00Z") };
  state.observations = [];
  state.runs = [];
  state.ledger = [];
  state.now = new Date("2026-11-15T10:00:00Z");
});

describe("AI answers are counted per account per month, not per website", () => {
  it("use 75 → delete the website → still 225 left (not back to 300)", async () => {
    runCheck({ runId: "r1", projectId: "p1", answers: 75, when: at("2026-11-10T09:00:00Z") });
    expect(await left()).toBe(225);
    expect(await keepAnswersOfDeletedProject("org_1", "p1", state.now)).toBe(0); // the ledger already has all 75
    deleteProject("p1");
    expect(state.observations).toHaveLength(0);
    expect(await left()).toBe(225);
  });

  it("replace the website (delete + add a new one) → still 225, and the new website's check counts on top", async () => {
    runCheck({ runId: "r1", projectId: "old", answers: 75, when: at("2026-11-10T09:00:00Z") });
    await keepAnswersOfDeletedProject("org_1", "old", state.now);
    deleteProject("old");
    expect(await left()).toBe(225);
    runCheck({ runId: "r2", projectId: "new", answers: 75, when: at("2026-11-14T09:00:00Z") });
    expect(await left()).toBe(150);
  });

  it("next month the plan's answers reset", async () => {
    runCheck({ runId: "r1", projectId: "p1", answers: 75, when: at("2026-11-10T09:00:00Z") });
    deleteProject("p1");
    const a = await getAiAllowance("org_1", { now: at("2026-12-01T00:00:01Z") });
    expect(a).toMatchObject({ used: 0, monthlyLeft: 300 });
    expect(a.resetsAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("simulated (free) answers are still not counted — before or after a delete", async () => {
    runCheck({ runId: "sim", projectId: "p1", answers: 75, when: at("2026-11-10T09:00:00Z"), simulated: true });
    expect(await left()).toBe(300);
    expect(await keepAnswersOfDeletedProject("org_1", "p1", state.now)).toBe(0);
    deleteProject("p1");
    expect(await left()).toBe(300);
    expect(state.ledger).toHaveLength(0);
  });

  it("answers a crashed check never wrote to the ledger are carried over when the website is deleted", async () => {
    // 75 answers stored, but the job died after recording only 70 of them.
    runCheck({ runId: "r1", projectId: "p1", answers: 75, when: at("2026-11-10T09:00:00Z"), ledger: 70, status: "failed" });
    expect(await left()).toBe(225); // max(75 stored, 70 in the ledger)
    expect(await keepAnswersOfDeletedProject("org_1", "p1", state.now)).toBe(5);
    expect(state.ledger.at(-1)).toMatchObject({ provider: DELETED_WEBSITE_PROVIDER, taskType: AI_ANSWER_TASK_TYPE, kind: "actual", credits: 5, costMicros: 0, billingPeriod: "2026-11" });
    deleteProject("p1");
    expect(await left()).toBe(225);
    // Calling it again (nothing left to carry) adds nothing.
    expect(await keepAnswersOfDeletedProject("org_1", "p1", state.now)).toBe(0);
  });

  it("a check in progress on the deleted website: answers it was holding are released, collected ones stay used", async () => {
    // Queued for tomorrow: 30 of 75 collected (and recorded), 45 still held.
    runCheck({ runId: "r1", projectId: "p1", answers: 30, sampleSize: 75, when: at("2026-11-14T09:00:00Z"), status: "queued" });
    expect(await left()).toBe(225); // 30 collected + 45 held
    await keepAnswersOfDeletedProject("org_1", "p1", state.now);
    deleteProject("p1");
    expect(await left()).toBe(270); // only the 30 really collected
  });

  it("a check that is running right now is left to record its own usage (no double count)", async () => {
    runCheck({ runId: "r1", projectId: "p1", answers: 20, sampleSize: 75, when: at("2026-11-15T09:59:00Z"), status: "running", ledger: 10 });
    expect(await keepAnswersOfDeletedProject("org_1", "p1", state.now)).toBe(0);
  });

  it("free trial: answers count since signup and deleting the website doesn't refill the trial", async () => {
    state.org = { planId: "trial", createdAt: at("2026-10-28T00:00:00Z") };
    runCheck({ runId: "r1", projectId: "p1", answers: 30, when: at("2026-10-29T09:00:00Z") });
    deleteProject("p1");
    const a = await getAiAllowance("org_1", { now: state.now });
    expect(a).toMatchObject({ used: 30, cap: 30, left: 0, resetsAt: null });
  });
});
