import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net/safe-request", () => ({ safeRequest: vi.fn() }));

import { safeRequest } from "@/lib/net/safe-request";
import { SanityConnector } from "@/lib/connectors/sanity";
import { descriptor } from "@/lib/connectors/catalog/sanity";

const TOKEN = "skSanityEditorTokenSuperSecret0123456789";
const mocked = vi.mocked(safeRequest);
type Doc = Record<string, unknown> & { _id: string; _type: string; _rev: string };

function getPath(o: Record<string, unknown>, p: string): unknown {
  return p.split(".").reduce<unknown>((c, k) => (c && typeof c === "object" ? (c as Record<string, unknown>)[k] : undefined), o);
}
function setPath(o: Record<string, unknown>, p: string, v: unknown) {
  const ks = p.split(".");
  let c = o;
  for (const k of ks.slice(0, -1)) c = (c[k] ??= {}) as Record<string, unknown>;
  if (v === undefined) delete c[ks[ks.length - 1]];
  else c[ks[ks.length - 1]] = v;
}

function fakeSanity() {
  const docs = new Map<string, Doc>();
  const history = new Map<string, Doc>(); // `${id}@${rev}` → snapshot
  const save = (d: Doc) => {
    docs.set(d._id, d);
    history.set(`${d._id}@${d._rev}`, structuredClone(d));
  };
  save({ _id: "p1", _type: "post", _rev: "rev1", slug: { _type: "slug", current: "hello" }, seo: { title: "Hello", description: "Old" }, body: [{ _type: "block" }] });
  let txn = 0;
  const mutations: unknown[][] = [];
  mocked.mockImplementation(async (url, opts = {}) => {
    expect(opts.headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(opts.allowedHosts).toEqual(["*.api.sanity.io"]);
    expect(opts.timeoutMs).toBeGreaterThan(0);
    const u = new URL(url);
    expect(u.hostname).toBe("abc123.api.sanity.io");
    const res = (status: number, data: unknown) => ({ status, headers: new Headers(), body: JSON.stringify(data), url });
    if (u.pathname === "/v2025-02-19/data/query/production") {
      const q = u.searchParams.get("query")!;
      expect(u.searchParams.get("perspective")).toBe("raw");
      const param = (k: string) => JSON.parse(u.searchParams.get(`$${k}`) ?? "null");
      if (q === "count(*)") return res(200, { result: docs.size });
      if (q.startsWith("*[_id in")) return res(200, { result: [...docs.values()].filter((d) => d._id === param("id") || d._id === param("draftId")) });
      if (q.includes("_type == $type")) {
        return res(200, { result: [...docs.values()].filter((d) => d._type === param("type") && getPath(d, "slug.current") === param("slug")).map((d) => d._id) });
      }
      return res(200, { result: [...docs.values()].filter((d) => !d._id.startsWith("drafts.")) });
    }
    if (u.pathname === "/v2025-02-19/data/mutate/production" && opts.method === "POST") {
      const body = JSON.parse(String(opts.body)) as { mutations: Record<string, Record<string, unknown>>[] };
      mutations.push(body.mutations);
      const transactionId = `txn${++txn}`;
      const staged = new Map(docs);
      for (const m of body.mutations) {
        if (m.create) {
          if (staged.has(m.create._id as string)) return res(409, { error: { description: "Document already exists" } });
          staged.set(m.create._id as string, { ...(m.create as Doc), _rev: transactionId });
        } else if (m.patch) {
          const d = staged.get(m.patch.id as string);
          if (!d) return res(404, { error: { description: "not found" } });
          if (m.patch.ifRevisionID && m.patch.ifRevisionID !== d._rev) return res(409, { error: { description: "unexpected revision ID" } });
          const next = structuredClone(d);
          for (const [k, v] of Object.entries((m.patch.set ?? {}) as Record<string, unknown>)) setPath(next, k, v);
          for (const k of (m.patch.unset ?? []) as string[]) setPath(next, k, undefined);
          next._rev = transactionId;
          staged.set(next._id, next);
        }
      }
      for (const d of staged.values()) if (docs.get(d._id) !== d) save(d);
      return res(200, { transactionId, results: [] });
    }
    const hist = u.pathname.match(/^\/v2025-02-19\/data\/history\/production\/documents\/(.+)$/);
    if (hist) {
      const d = history.get(`${decodeURIComponent(hist[1])}@${u.searchParams.get("revision")}`);
      return d ? res(200, { documents: [d] }) : res(404, {});
    }
    return res(404, {});
  });
  const c = new SanityConnector(
    {
      projectId: "abc123", dataset: "production", apiVersion: "2025-02-19", siteUrl: "https://acme.test",
      urlMap: [{ urlPrefix: "/blog", type: "post", slugField: "slug" }],
      fieldMap: { title: "seo.title", description: "seo.description", body: "body" },
    },
    { token: TOKEN },
  );
  return { c, docs, mutations };
}

describe("sanity connector", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it("tests the connection with a GROQ count", async () => {
    const { c } = fakeSanity();
    expect(await c.testConnection()).toEqual({ ok: true, identity: "abc123/production (1 documents)" });
    mocked.mockResolvedValueOnce({ status: 401, headers: new Headers(), body: "{}", url: "" });
    expect((await c.testConnection()).error).toMatch(/Editor/);
    mocked.mockResolvedValueOnce({ status: 429, headers: new Headers({ "retry-after": "2" }), body: "{}", url: "" });
    expect((await c.testConnection()).error).toMatch(/rate limit.*2s/);
  });

  it("maps a URL to the published document id with _rev as version", async () => {
    const { c } = fakeSanity();
    expect(await c.resolveResourceId("https://acme.test/blog/hello")).toBe("p1");
    expect(await c.resolveResourceId("https://acme.test/blog/missing")).toBeNull();
    expect(await c.resolveResourceId("https://acme.test/")).toBeNull();
    const r = await c.getResource("p1");
    expect(r).toMatchObject({ id: "p1", version: "rev1", url: "https://acme.test/blog/hello" });
    expect(r?.fields).toMatchObject({ title: "Hello", meta_description: "Old", status: "published", content_writable: "false" });
  });

  it("writes to drafts.<id> only, leaving the published document untouched", async () => {
    const { c, docs, mutations } = fakeSanity();
    const before = (await c.getResource("p1"))!;
    const r = await c.applyPatch("p1", { field: "title", before: "Hello", after: "Hello from Acme" }, before.version, "k");
    expect(r).toMatchObject({ ok: true, newVersion: "txn1", detail: { draftId: "drafts.p1", published: false } });
    expect(getPath(docs.get("p1")!, "seo.title")).toBe("Hello");
    expect(getPath(docs.get("drafts.p1")!, "seo.title")).toBe("Hello from Acme");
    expect(JSON.stringify(mutations)).not.toMatch(/publish/i);
    expect(c.getCapabilities().publish).toBe(false);
    const live = await c.getResource("p1");
    expect(live).toMatchObject({ version: "txn1", fields: { status: "published_with_draft" } });
    // Second patch uses ifRevisionID against the existing draft.
    await c.applyPatch("p1", { field: "meta_description", before: "Old", after: "New" }, live!.version, "k2");
    expect((mutations[1][0] as { patch: { ifRevisionID: string } }).patch.ifRevisionID).toBe("txn1");
    expect((await c.validateResource("p1", { field: "meta_description", before: "Old", after: "New" })).status).toBe("warning");
  });

  it("detects conflicts locally and via ifRevisionID", async () => {
    const { c, docs } = fakeSanity();
    expect(await c.applyPatch("p1", { field: "title", before: "Hello", after: "X" }, "stale", "k")).toMatchObject({ ok: false, error: "conflict" });
    await c.applyPatch("p1", { field: "title", before: "Hello", after: "Y" }, "rev1", "k");
    // Someone edits the draft in Studio between our read and our write.
    const realImpl = mocked.getMockImplementation()!;
    let first = true;
    mocked.mockImplementation(async (url, opts) => {
      const out = await realImpl(url, opts);
      if (first && url.includes("/data/query/")) {
        first = false;
        docs.set("drafts.p1", { ...docs.get("drafts.p1")!, _rev: "studioEdit" });
      }
      return out;
    });
    expect(await c.applyPatch("p1", { field: "title", before: "Y", after: "Z" }, undefined, "k")).toMatchObject({ ok: false, error: "conflict" });
  });

  it("refuses Portable Text fields with manual instructions", async () => {
    const { c } = fakeSanity();
    expect((await c.applyPatch("p1", { field: "content", before: null, after: "Text" }, undefined, "k")).error).toBe("manual_required");
    expect((await c.applyPatch("p1", { field: "slug", before: null, after: "x" }, undefined, "k")).error).toBe("unsupported_field");
  });

  it("rolls back via the revision history into the draft", async () => {
    const { c, docs } = fakeSanity();
    const before = (await c.getResource("p1"))!;
    await c.applyPatch("p1", { field: "title", before: "Hello", after: "Hello from Acme" }, before.version, "k");
    const rb = await c.rollback("p1", before);
    expect(rb).toMatchObject({ ok: true, detail: { restored: ["seo.title"], source: "history_api" } });
    expect(getPath(docs.get("drafts.p1")!, "seo.title")).toBe("Hello");
    expect(getPath(docs.get("p1")!, "seo.title")).toBe("Hello");
  });

  it("never exposes the token in serialized output", async () => {
    const { c } = fakeSanity();
    const r = await c.getResource("p1");
    const p = await c.applyPatch("p1", { field: "title", before: "Hello", after: "X" }, r?.version, "k");
    expect(JSON.stringify({ c, r, p, caps: c.getCapabilities(), t: await c.testConnection() })).not.toContain(TOKEN);
    const v = descriptor.validateConfig({
      projectId: "abc123", token: TOKEN, siteUrl: "https://acme.test", urlMap: "/blog=post:slug",
      titleField: "seo.title", descriptionField: "seo.description",
    });
    expect(JSON.stringify(v.config)).not.toContain(TOKEN);
    expect(v.config).toMatchObject({ dataset: "production", apiVersion: "2025-02-19", urlMap: [{ urlPrefix: "/blog", type: "post", slugField: "slug" }] });
    expect(descriptor.create(v.config, v.secrets).id).toBe("sanity");
    expect(() => descriptor.validateConfig({ projectId: "abc123", token: TOKEN, siteUrl: "https://acme.test", urlMap: "/blog=post:slug", titleField: "x] || true", descriptionField: "d" })).toThrow();
  });
});
