import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net/safe-request", () => ({ safeRequest: vi.fn() }));

import { safeRequest } from "@/lib/net/safe-request";
import { ContentfulConnector } from "@/lib/connectors/contentful";
import { descriptor } from "@/lib/connectors/catalog/contentful";

const TOKEN = "CFPAT-super-secret-token-value-123";
const mocked = vi.mocked(safeRequest);

type Call = { method: string; url: string; headers: Record<string, string>; body?: Record<string, unknown> };

function fakeContentful() {
  const entry = {
    sys: { id: "e1", version: 5, publishedVersion: 4, contentType: { sys: { id: "blogPost" } }, updatedAt: "2026-10-01T00:00:00Z" },
    fields: {
      slug: { "en-US": "hello-world" },
      seoTitle: { "en-US": "Hello", "de-DE": "Hallo" },
      seoDescription: { "en-US": "Old description" },
      body: { "en-US": { nodeType: "document", content: [] } },
    } as Record<string, Record<string, unknown>>,
  };
  const calls: Call[] = [];
  mocked.mockImplementation(async (url, opts = {}) => {
    const method = opts.method ?? "GET";
    const headers = opts.headers ?? {};
    const body = opts.body ? (JSON.parse(String(opts.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, url, headers, body });
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(opts.timeoutMs).toBeGreaterThan(0);
    expect(opts.allowedHosts).toEqual(["api.contentful.com"]);
    const u = new URL(url);
    const res = (status: number, data: unknown) => ({ status, headers: new Headers(), body: JSON.stringify(data), url });
    if (u.pathname === "/spaces/sp1") return res(200, { name: "Acme Space", sys: { id: "sp1" } });
    if (u.pathname === "/spaces/sp1/environments/master") return res(200, { sys: { id: "master" } });
    if (u.pathname === "/spaces/sp1/environments/master/entries" && method === "GET") {
      const slug = u.searchParams.get("fields.slug");
      const match = u.searchParams.get("content_type") === "blogPost" && (!slug || slug === entry.fields.slug["en-US"]);
      return res(200, { items: match ? [entry] : [], total: match ? 1 : 0 });
    }
    if (u.pathname === "/spaces/sp1/environments/master/entries/e1") {
      if (method === "GET") return res(200, entry);
      if (method === "PUT") {
        if (headers["X-Contentful-Version"] !== String(entry.sys.version)) return res(409, { sys: { id: "VersionMismatch" } });
        entry.fields = (body as { fields: typeof entry.fields }).fields;
        entry.sys.version += 1;
        return res(200, entry);
      }
    }
    return res(404, { sys: { id: "NotFound" } });
  });
  const c = new ContentfulConnector(
    {
      spaceId: "sp1", environmentId: "master", locale: "en-US", siteUrl: "https://www.acme.test",
      urlMap: [{ urlPrefix: "/blog", contentType: "blogPost", slugField: "slug" }],
      fieldMap: { title: "seoTitle", description: "seoDescription", body: "body" },
    },
    { managementToken: TOKEN },
  );
  return { c, entry, calls };
}

describe("contentful connector", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it("tests the connection against the space", async () => {
    const { c, calls } = fakeContentful();
    expect(await c.testConnection()).toEqual({ ok: true, identity: "Acme Space (master)" });
    expect(calls[0].url).toBe("https://api.contentful.com/spaces/sp1");
  });

  it("reports auth and rate-limit errors clearly", async () => {
    const { c } = fakeContentful();
    mocked.mockResolvedValueOnce({ status: 401, headers: new Headers(), body: "{}", url: "" });
    const r = await c.testConnection();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/management token/);
    mocked.mockResolvedValueOnce({ status: 429, headers: new Headers({ "x-contentful-ratelimit-reset": "3" }), body: "{}", url: "" });
    await expect(c.getResource("e1")).rejects.toThrow(/rate limit.*3s/);
  });

  it("maps a URL to an entry through the URL map, with sys.version as version", async () => {
    const { c, calls } = fakeContentful();
    expect(await c.resolveResourceId("https://acme.test/blog/hello-world/")).toBe("e1");
    const q = new URL(calls[0].url).searchParams;
    expect(q.get("content_type")).toBe("blogPost");
    expect(q.get("fields.slug")).toBe("hello-world");
    expect(await c.resolveResourceId("https://www.acme.test/blog/")).toBeNull();
    expect(await c.resolveResourceId("https://other.test/blog/hello-world")).toBeNull();
    const r = await c.getResource("e1");
    expect(r).toMatchObject({ id: "e1", version: "5", url: "https://www.acme.test/blog/hello-world" });
    expect(r?.fields.title).toBe("Hello");
    expect(r?.fields.status).toBe("published");
  });

  it("updates with X-Contentful-Version as an unpublished change, never publishing", async () => {
    const { c, entry, calls } = fakeContentful();
    const before = (await c.getResource("e1"))!;
    const r = await c.applyPatch("e1", { field: "title", before: "Hello", after: "Hello from Acme" }, before.version, "k1");
    expect(r).toMatchObject({ ok: true, newVersion: "6", detail: { published: false } });
    const put = calls.find((x) => x.method === "PUT")!;
    expect(put.headers["X-Contentful-Version"]).toBe("5");
    expect(put.url).not.toMatch(/published/);
    expect(entry.fields.seoTitle).toEqual({ "en-US": "Hello from Acme", "de-DE": "Hallo" }); // other locales untouched
    expect(calls.some((x) => x.url.includes("/published"))).toBe(false);
    expect(c.getCapabilities().publish).toBe(false);
    expect((await c.getResource("e1"))?.fields.status).toBe("changed");
    expect((await c.validateResource("e1", { field: "title", before: null, after: "Hello from Acme" })).status).toBe("warning");
  });

  it("refuses to write on version conflict (local check and Contentful 409)", async () => {
    const { c, entry, calls } = fakeContentful();
    const r = await c.applyPatch("e1", { field: "title", before: "Hello", after: "New" }, "3", "k");
    expect(r).toMatchObject({ ok: false, error: "conflict" });
    expect(calls.filter((x) => x.method === "PUT")).toHaveLength(0);
    // Entry changes between our read and our write → Contentful rejects the stale version.
    mocked.mockImplementationOnce(async (url) => {
      const e = { ...entry, sys: { ...entry.sys, version: 4 } };
      return { status: 200, headers: new Headers(), body: JSON.stringify(e), url };
    });
    const r2 = await c.applyPatch("e1", { field: "title", before: "Hello", after: "New" }, undefined, "k");
    expect(r2).toMatchObject({ ok: false, error: "conflict" });
  });

  it("refuses Rich Text fields with manual instructions and unknown fields", async () => {
    const { c } = fakeContentful();
    expect((await c.applyPatch("e1", { field: "content", before: null, after: "Text" }, undefined, "k")).error).toBe("manual_required");
    expect((await c.applyPatch("e1", { field: "slug", before: null, after: "x" }, undefined, "k")).error).toBe("unsupported_field");
  });

  it("rolls back by writing the previous field values", async () => {
    const { c, entry } = fakeContentful();
    const before = (await c.getResource("e1"))!;
    await c.applyPatch("e1", { field: "meta_description", before: "Old description", after: "New description" }, before.version, "k");
    expect(entry.fields.seoDescription["en-US"]).toBe("New description");
    const rb = await c.rollback("e1", before);
    expect(rb).toMatchObject({ ok: true, detail: { restored: ["seoDescription"] } });
    expect(entry.fields.seoDescription["en-US"]).toBe("Old description");
    expect(entry.fields.body["en-US"]).toEqual({ nodeType: "document", content: [] });
  });

  it("never exposes the token in serialized output", async () => {
    const { c } = fakeContentful();
    const r = await c.getResource("e1");
    const p = await c.applyPatch("e1", { field: "title", before: "Hello", after: "X" }, r?.version, "k");
    const out = JSON.stringify({ c, r, p, caps: c.getCapabilities(), test: await c.testConnection() });
    expect(out).not.toContain(TOKEN);
    const v = descriptor.validateConfig({
      spaceId: "sp1", managementToken: TOKEN, urlMap: "/blog=blogPost:slug, /=page",
      titleField: "seoTitle", descriptionField: "seoDescription",
    }, { projectWebsiteUrl: "https://www.acme.test/x" });
    expect(JSON.stringify(v.config)).not.toContain(TOKEN);
    expect(v.config).toMatchObject({ environmentId: "master", locale: "en-US", siteUrl: "https://www.acme.test" });
    expect(v.config.urlMap).toEqual([
      { urlPrefix: "/blog", contentType: "blogPost", slugField: "slug" },
      { urlPrefix: "/", contentType: "page", slugField: "slug" },
    ]);
    expect(v.secrets.managementToken).toBe(TOKEN);
    expect(descriptor.create(v.config, v.secrets).id).toBe("contentful");
    expect(() => descriptor.validateConfig({ spaceId: "sp1", managementToken: TOKEN, urlMap: "nope" })).toThrow();
  });
});
