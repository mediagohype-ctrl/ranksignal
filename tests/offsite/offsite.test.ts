import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionContext } from "@/lib/types";

// db fully mocked: nothing here can reach a real database.
const h = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    db: {
      project: { findFirst: fn() },
      offsiteItem: { findMany: fn(), findFirst: fn(), create: fn(), updateMany: fn(), deleteMany: fn(), count: fn() },
      visibilityRun: { findMany: fn() },
    },
    audit: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: h.audit, auditActorFromSession: (s: SessionContext) => ({ actorId: s.userId, actorType: "user" }) }));

import {
  createOffsite,
  deleteOffsite,
  getOffsiteSuggestions,
  listOffsite,
  listOffsiteForPeriod,
  nextLiveAt,
  offsiteCreateSchema,
  starterSuggestions,
  suggestFromCitations,
  updateOffsite,
  STARTER_LISTINGS,
} from "@/lib/offsite";

const ORG = "org_1";
const member: SessionContext = { userId: "u1", email: "m@x.test", organizationId: ORG, role: "member" };

function row(over: Record<string, unknown> = {}) {
  const now = new Date("2026-10-10T10:00:00Z");
  return {
    id: "o1", organizationId: ORG, projectId: "p1", type: "directory", name: "Justdial", url: "https://www.justdial.com/x",
    status: "todo", napConsistent: null, source: "manual", taskId: null, notes: null, liveAt: null, createdAt: now, updatedAt: now,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.audit.mockResolvedValue(undefined);
  h.db.project.findFirst.mockResolvedValue({ id: "p1", websiteUrl: "https://www.acme.in/", competitors: [{ name: "Rival", domain: "rival.com" }] });
  h.db.offsiteItem.count.mockResolvedValue(0);
});

describe("suggestFromCitations", () => {
  const ctx = {
    ownedDomains: ["acme.in"],
    competitorDomains: ["rival.com"],
    tracked: [{ url: "https://www.g2.com/products/acme", name: "G2" }],
  };
  const sources = [
    { domain: "acme.in", count: 9, owned: true },
    { domain: "blog.acme.in", count: 2, owned: false },
    { domain: "www.justdial.com", count: 7, owned: false },
    { domain: "g2.com", count: 6, owned: false },
    { domain: "rival.com", count: 5, owned: false },
    { domain: "reddit.com", count: 4, owned: false },
    { domain: "google.com", count: 3, owned: false },
    { domain: "bestbakeries-in-bangalore.example.com", count: 2, owned: false },
  ];

  it("lists only third-party domains the client is absent from", () => {
    const out = suggestFromCitations(sources, ctx);
    expect(out.map((s) => s.domain)).toEqual(["justdial.com", "reddit.com", "bestbakeries-in-bangalore.example.com"]);
    expect(out[0]).toMatchObject({ name: "Justdial", type: "directory", count: 7, url: "https://justdial.com/" });
    expect(out[1]).toMatchObject({ type: "forum_thread" });
    expect(out[2]).toMatchObject({ type: "other" });
  });

  it("matches tracked items by name too and tolerates junk input", () => {
    expect(suggestFromCitations([{ domain: "justdial.com", count: 1, owned: false }], { ...ctx, tracked: [{ url: null, name: "Justdial" }] })).toEqual([]);
    expect(suggestFromCitations(null, ctx)).toEqual([]);
    expect(suggestFromCitations([{ domain: "not a domain", count: 1, owned: false }], ctx)).toEqual([]);
  });

  it("starter list marks tracked entries and has the India basics", () => {
    const names = STARTER_LISTINGS.map((s) => s.name);
    for (const n of ["Google Business Profile", "Justdial", "IndiaMART", "Sulekha", "Bing Places", "Apple Business Connect", "Crunchbase", "G2", "Capterra", "Trustpilot"]) {
      expect(names).toContain(n);
    }
    const st = starterSuggestions([{ url: "https://www.g2.com/products/acme", name: "x" }]);
    expect(st.find((s) => s.key === "g2")?.tracked).toBe(true);
    expect(st.find((s) => s.key === "justdial")?.tracked).toBe(false);
  });
});

describe("getOffsiteSuggestions", () => {
  it("uses the latest REAL run (skips simulated) and is tenant-scoped", async () => {
    h.db.offsiteItem.findMany.mockResolvedValue([]);
    h.db.visibilityRun.findMany.mockResolvedValue([
      { metrics: { simulated: true, citationSources: [{ domain: "fake.com", count: 9, owned: false }] }, finishedAt: new Date("2026-10-20"), createdAt: new Date("2026-10-20") },
      { metrics: { simulated: false, citationSources: [{ domain: "justdial.com", count: 3, owned: false }] }, finishedAt: new Date("2026-10-10"), createdAt: new Date("2026-10-10") },
    ]);
    const out = await getOffsiteSuggestions(member, "p1");
    expect(out.aiCitations.map((s) => s.domain)).toEqual(["justdial.com"]);
    expect(out.measuredAt).toBe(new Date("2026-10-10").toISOString());
    expect(h.db.project.findFirst.mock.calls[0]![0].where).toEqual({ id: "p1", organizationId: ORG });
    expect(h.db.visibilityRun.findMany.mock.calls[0]![0].where).toMatchObject({ organizationId: ORG, projectId: "p1" });
  });

  it("returns no AI suggestions when there's no real run yet", async () => {
    h.db.offsiteItem.findMany.mockResolvedValue([]);
    h.db.visibilityRun.findMany.mockResolvedValue([]);
    const out = await getOffsiteSuggestions(member, "p1");
    expect(out).toMatchObject({ aiCitations: [], measuredAt: null });
    expect(out.starter.length).toBe(STARTER_LISTINGS.length);
  });
});

describe("CRUD tenant scoping", () => {
  it("list filters by the session's organization", async () => {
    h.db.offsiteItem.findMany.mockResolvedValue([row()]);
    const items = await listOffsite(member, "p1", { status: "todo" });
    expect(items[0]).toMatchObject({ id: "o1", status: "todo", type: "directory" });
    expect(h.db.offsiteItem.findMany.mock.calls[0]![0].where).toMatchObject({ organizationId: ORG, projectId: "p1", status: "todo" });
  });

  it("refuses a project from another org", async () => {
    h.db.project.findFirst.mockResolvedValue(null);
    await expect(listOffsite(member, "p_other")).rejects.toMatchObject({ status: 404 });
    await expect(createOffsite(member, "p_other", { type: "directory", name: "X" })).rejects.toMatchObject({ status: 404 });
    expect(h.db.offsiteItem.create).not.toHaveBeenCalled();
  });

  it("create stamps organizationId from the session and sets liveAt for live items", async () => {
    h.db.offsiteItem.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data));
    const item = await createOffsite(member, "p1", offsiteCreateSchema.parse({ type: "review_platform", name: "G2", status: "live", source: "ai_citation" }));
    const data = h.db.offsiteItem.create.mock.calls[0]![0].data;
    expect(data.organizationId).toBe(ORG);
    expect(data.liveAt).toBeInstanceOf(Date);
    expect(item.source).toBe("ai_citation");
  });

  it("update/delete can't touch another tenant's item", async () => {
    h.db.offsiteItem.findFirst.mockResolvedValue(null);
    await expect(updateOffsite(member, "o_foreign", { status: "live" }, "p1")).rejects.toMatchObject({ status: 404 });
    await expect(deleteOffsite(member, "o_foreign", "p1")).rejects.toMatchObject({ status: 404 });
    expect(h.db.offsiteItem.findFirst.mock.calls[0]![0].where).toEqual({ id: "o_foreign", organizationId: ORG, projectId: "p1" });
    expect(h.db.offsiteItem.updateMany).not.toHaveBeenCalled();
    expect(h.db.offsiteItem.deleteMany).not.toHaveBeenCalled();
  });

  it("update writes with an org-scoped where and moves through the pipeline", async () => {
    h.db.offsiteItem.findFirst.mockResolvedValueOnce(row({ status: "submitted" })).mockResolvedValueOnce(row({ status: "live", liveAt: new Date() }));
    h.db.offsiteItem.updateMany.mockResolvedValue({ count: 1 });
    const out = await updateOffsite(member, "o1", { status: "live" }, "p1");
    const call = h.db.offsiteItem.updateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "o1", organizationId: ORG });
    expect(call.data.status).toBe("live");
    expect(call.data.liveAt).toBeInstanceOf(Date);
    expect(out.status).toBe("live");
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "offsite.status" }));
  });

  it("delete is org-scoped", async () => {
    h.db.offsiteItem.findFirst.mockResolvedValue(row());
    h.db.offsiteItem.deleteMany.mockResolvedValue({ count: 1 });
    await deleteOffsite(member, "o1", "p1");
    expect(h.db.offsiteItem.deleteMany.mock.calls[0]![0].where).toEqual({ id: "o1", organizationId: ORG });
  });

  it("listOffsiteForPeriod returns items that went live in the window", async () => {
    h.db.offsiteItem.findMany.mockResolvedValue([row({ status: "live", liveAt: new Date("2026-10-05") })]);
    const from = new Date("2026-10-01");
    const to = new Date("2026-11-01");
    const out = await listOffsiteForPeriod("p1", ORG, from, to);
    expect(out).toHaveLength(1);
    expect(h.db.offsiteItem.findMany.mock.calls[0]![0].where).toEqual({ organizationId: ORG, projectId: "p1", status: "live", liveAt: { gte: from, lt: to } });
  });
});

describe("nextLiveAt", () => {
  const now = new Date("2026-10-29T00:00:00Z");
  it("sets, keeps and clears the live date", () => {
    expect(nextLiveAt("submitted", "live", null, null, now)).toEqual(now);
    const earlier = new Date("2026-10-01");
    expect(nextLiveAt("live", "live", earlier, null, now)).toEqual(earlier);
    expect(nextLiveAt("live", "rejected", earlier, null, now)).toBeNull();
    expect(nextLiveAt("todo", "live", null, earlier, now)).toEqual(earlier);
  });
});

describe("validation", () => {
  it("rejects non-http links and unknown types", () => {
    expect(offsiteCreateSchema.safeParse({ type: "directory", name: "X", url: "javascript:alert(1)" }).success).toBe(false);
    expect(offsiteCreateSchema.safeParse({ type: "nope", name: "X" }).success).toBe(false);
    expect(offsiteCreateSchema.parse({ type: "directory", name: "X", url: "" }).url).toBeNull();
  });
});
