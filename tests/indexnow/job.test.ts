// IndexNow job: batches queued submissions, dedupes, respects the daily cap, retries on 429, disables on 403.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeRequestResult } from "@/lib/net/safe-request";

type Sub = { id: string; organizationId: string; projectId: string; host: string; urls: string[]; urlCount: number; status: string; attempts: number; sentAt?: Date | null; createdAt: Date; httpStatus?: number | null; message?: string };
const state = vi.hoisted(() => ({
  subs: [] as Sub[],
  site: null as Record<string, unknown> | null,
  sentToday: 0,
  enqueued: 0,
}));

vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn(async () => (state.enqueued++, {})) }));
vi.mock("@/lib/db", () => {
  const match = (s: Sub, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "id" && v && typeof v === "object" && "in" in v) return (v as { in: string[] }).in.includes(s.id);
      if (k === "createdAt" || k === "sentAt") return true;
      return (s as unknown as Record<string, unknown>)[k] === v;
    });
  const db = {
    project: { findFirst: vi.fn(async ({ where }: { where: { organizationId: string } }) => (where.organizationId === "org1" ? { websiteUrl: "https://acme.in" } : null)) },
    indexNowSite: {
      findFirst: vi.fn(async () => state.site),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.site!, data)),
    },
    indexNowSubmission: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => state.subs.filter((s) => match(s, where))),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Sub> }) => {
        state.subs.filter((s) => match(s, where)).forEach((s) => Object.assign(s, data));
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Sub> }) => Object.assign(state.subs.find((s) => s.id === where.id)!, data)),
      aggregate: vi.fn(async () => ({ _sum: { urlCount: state.sentToday } })),
      count: vi.fn(async () => 0),
    },
    workflowRun: { findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { db };
});

import { createIndexNowJob } from "@/lib/indexnow-customer/job";

const sub = (id: string, urls: string[], o: Partial<Sub> = {}): Sub => ({
  id, organizationId: "org1", projectId: "p1", host: "acme.in", urls, urlCount: urls.length, status: "queued", attempts: 0, createdAt: new Date(), ...o,
});
const ctx = () => ({
  run: { id: "r1", organizationId: "org1", projectId: "p1", input: { projectId: "p1" }, attempts: 1 },
  transition: vi.fn(),
  event: vi.fn(async () => undefined),
});
const fetcherWith = (status: number) => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const f = vi.fn(async (url: string, opts?: { body?: string | Uint8Array; allowedHosts?: string[] }) => {
    calls.push({ url, body: JSON.parse(String(opts?.body)) });
    expect(opts?.allowedHosts).toEqual(["api.indexnow.org"]);
    return { status, headers: new Headers(), body: "", url } as SafeRequestResult;
  });
  return { f, calls };
};

beforeEach(() => {
  state.site = { id: "s1", host: "acme.in", key: "k1234567", status: "verified", enabled: true };
  state.subs = [];
  state.sentToday = 0;
  state.enqueued = 0;
});

describe("indexnow job", () => {
  it("merges queued batches into one deduped POST and marks the log", async () => {
    state.subs = [
      sub("a", ["https://acme.in/x", "https://acme.in/y"]),
      sub("b", ["https://acme.in/y", "https://other.in/z"]),
      sub("old", ["https://acme.in/x"], { status: "sent", sentAt: new Date() }),
    ];
    const { f, calls } = fetcherWith(200);
    await createIndexNowJob(f)(ctx() as never);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.indexnow.org/indexnow");
    // /x was accepted in the last 24 h → not resent; other hosts dropped.
    expect(calls[0].body).toEqual({ host: "acme.in", key: "k1234567", keyLocation: "https://acme.in/k1234567.txt", urlList: ["https://acme.in/y"] });
    expect(state.subs[0]).toMatchObject({ status: "sent", urlCount: 1, httpStatus: 200 });
    expect(state.subs[1]).toMatchObject({ status: "merged" });
  });

  it("retries on 429 via the queue, then gives up after the last attempt without throwing", async () => {
    state.subs = [sub("a", ["https://acme.in/x"])];
    const { f } = fetcherWith(429);
    await expect(createIndexNowJob(f)(ctx() as never)).rejects.toMatchObject({ errorClass: "transient" });
    expect(state.subs[0]).toMatchObject({ status: "queued", attempts: 1, httpStatus: 429 });
    state.subs[0].attempts = 4;
    await expect(createIndexNowJob(f)(ctx() as never)).resolves.toMatchObject({ failed: 1 });
    expect(state.subs[0].status).toBe("failed");
  });

  it("switches IndexNow off when the key is rejected (403)", async () => {
    state.subs = [sub("a", ["https://acme.in/x"])];
    await createIndexNowJob(fetcherWith(403).f)(ctx() as never);
    expect(state.subs[0].status).toBe("failed");
    expect(state.site).toMatchObject({ status: "failed", enabled: false });
  });

  it("never sends when the site isn't verified, or the daily cap is used up", async () => {
    state.subs = [sub("a", ["https://acme.in/x"])];
    state.site = { ...state.site!, enabled: false, status: "pending" };
    const { f, calls } = fetcherWith(200);
    await createIndexNowJob(f)(ctx() as never);
    expect(calls).toHaveLength(0);
    expect(state.subs[0].status).toBe("skipped");

    state.site = { ...state.site, enabled: true, status: "verified" };
    state.subs = [sub("b", ["https://acme.in/x"])];
    state.sentToday = 10_000;
    await createIndexNowJob(f)(ctx() as never);
    expect(calls).toHaveLength(0);
    expect(state.subs[0].message).toMatch(/limit/);
  });
});
