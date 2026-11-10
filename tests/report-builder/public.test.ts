// Public built-report share links reuse the website's report sharing: token + project share settings + template switch.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  project: null as Record<string, unknown> | null,
  templateWhere: null as unknown,
  template: null as Record<string, unknown> | null,
  loadArgs: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: vi.fn(async () => state.project) },
    reportTemplate: {
      findFirst: vi.fn(async (args: { where: unknown }) => {
        state.templateWhere = args.where;
        return state.template;
      }),
    },
  },
}));
vi.mock("@/lib/report-builder/data", () => ({
  loadBuilderReport: vi.fn(async (o: Record<string, unknown>) => {
    state.loadArgs = o;
    return { ok: true };
  }),
}));
vi.mock("@/lib/branding", () => ({
  getBranding: vi.fn(async () => ({ displayName: "Agency", custom: true, replyTo: "x@y.z" })),
  toPublicBranding: (b: Record<string, unknown>) => {
    const { replyTo: _r, ...rest } = b;
    void _r;
    return rest;
  },
}));

import { signShareToken } from "@/lib/share/token";
import { loadSharedBuiltReport } from "@/lib/report-builder/public";

const template = { id: "t1", name: "Monthly", sections: [], intro: null, notes: "Hello", range: null, isOrgDefault: false, shareEnabled: true, updatedAt: new Date() };

beforeEach(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
  state.project = { id: "p1", organizationId: "org1", name: "Shop", websiteUrl: "https://shop.in", settings: { share: { enabled: true, tokenId: "tok1" } } };
  state.template = template;
  state.templateWhere = null;
  state.loadArgs = null;
});

describe("shared built report", () => {
  it("shows the report for a valid token with sharing on, stripping internals and reply-to", async () => {
    const token = await signShareToken({ projectId: "p1", tokenId: "tok1" });
    const r = await loadSharedBuiltReport(token, "t1");
    expect(r.status).toBe("ok");
    expect(state.templateWhere).toEqual({ id: "t1", organizationId: "org1", projectId: "p1", shareEnabled: true });
    expect(state.loadArgs).toMatchObject({ organizationId: "org1", publicView: true });
    if (r.status === "ok") expect(r.branding).not.toHaveProperty("replyTo");
  });

  it("404s when website sharing is off or the link was rotated", async () => {
    const token = await signShareToken({ projectId: "p1", tokenId: "tok1" });
    state.project = { ...state.project!, settings: { share: { enabled: false, tokenId: "tok1" } } };
    expect((await loadSharedBuiltReport(token, "t1")).status).toBe("not_found");
    state.project = { ...state.project!, settings: { share: { enabled: true, tokenId: "rotated" } } };
    expect((await loadSharedBuiltReport(token, "t1")).status).toBe("not_found");
  });

  it("404s for templates not shared / not on this website, bad ids and bad tokens", async () => {
    const token = await signShareToken({ projectId: "p1", tokenId: "tok1" });
    state.template = null;
    expect((await loadSharedBuiltReport(token, "t1")).status).toBe("not_found");
    expect((await loadSharedBuiltReport(token, "../etc")).status).toBe("not_found");
    expect((await loadSharedBuiltReport("garbage", "t1")).status).toBe("not_found");
  });
});
