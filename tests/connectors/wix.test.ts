import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net/safe-request", () => ({ safeRequest: vi.fn() }));

import { safeRequest } from "@/lib/net/safe-request";
import { WixConnector } from "@/lib/connectors/wix";
import { descriptor } from "@/lib/connectors/catalog/wix";

const KEY = "IST.wix-api-key-super-secret-0123456789abcdef";
const SITE = "1a2b3c4d-1111-2222-3333-444455556666";
const mocked = vi.mocked(safeRequest);

function fakeWix() {
  const draft = {
    id: "post-1", title: "Hello world", excerpt: "Old excerpt", seoSlug: "hello-world", status: "PUBLISHED",
    editedDate: "2026-10-01T00:00:00.000Z", hasUnpublishedChanges: false,
    seoData: { tags: [{ type: "meta", props: { name: "description", content: "Old description" }, custom: true, disabled: false }, { type: "meta", props: { property: "og:image", content: "x.png" } }] as Record<string, unknown>[] },
  };
  const writes: { action: string; draftPost: Record<string, unknown> }[] = [];
  let tick = 1;
  mocked.mockImplementation(async (url, opts = {}) => {
    expect(opts.headers?.Authorization).toBe(KEY);
    expect(opts.headers?.["wix-site-id"]).toBe(SITE);
    expect(opts.allowedHosts).toEqual(["www.wixapis.com"]);
    expect(opts.timeoutMs).toBeGreaterThan(0);
    const u = new URL(url);
    const res = (status: number, data: unknown) => ({ status, headers: new Headers(), body: JSON.stringify(data), url });
    if (u.pathname === "/site-properties/v4/properties") return res(200, { properties: { siteDisplayName: "Acme Studio" } });
    if (u.pathname === "/blog/v3/posts/slugs/hello-world") return res(200, { post: { id: "post-1", slug: "hello-world" } });
    if (u.pathname.startsWith("/blog/v3/posts/slugs/")) return res(404, { message: "not found" });
    if (u.pathname === "/blog/v3/draft-posts/post-1") {
      if (opts.method === "PATCH") {
        const body = JSON.parse(String(opts.body)) as { action: string; draftPost: Record<string, unknown> };
        writes.push(body);
        Object.assign(draft, body.draftPost, { editedDate: `2026-10-0${++tick}T00:00:00.000Z`, hasUnpublishedChanges: true });
        return res(200, { draftPost: draft });
      }
      return res(200, { draftPost: draft });
    }
    return res(404, {});
  });
  const c = new WixConnector({ siteId: SITE, siteUrl: "https://www.acme.test" }, { apiKey: KEY });
  return { c, draft, writes };
}

describe("wix connector", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it("tests the connection via site properties and explains auth errors", async () => {
    const { c } = fakeWix();
    expect(await c.testConnection()).toEqual({ ok: true, identity: "Acme Studio" });
    mocked.mockResolvedValueOnce({ status: 403, headers: new Headers(), body: "{}", url: "" });
    expect((await c.testConnection()).error).toMatch(/API key/);
    mocked.mockResolvedValueOnce({ status: 429, headers: new Headers(), body: "{}", url: "" });
    expect((await c.testConnection()).error).toMatch(/rate limit/);
  });

  it("maps blog URLs to posts and other URLs to read-only static pages", async () => {
    const { c } = fakeWix();
    expect(await c.resolveResourceId("https://acme.test/post/hello-world")).toBe("post:post-1");
    expect(await c.resolveResourceId("https://www.acme.test/post/missing")).toBeNull();
    expect(await c.resolveResourceId("https://www.acme.test/about-us/")).toBe("page:/about-us");
    expect(await c.resolveResourceId("https://elsewhere.test/post/hello-world")).toBeNull();
    const r = await c.getResource("post:post-1");
    expect(r).toMatchObject({ type: "blog_post", url: "https://www.acme.test/post/hello-world", version: "2026-10-01T00:00:00.000Z" });
    expect(r?.fields).toMatchObject({ title: "Hello world", seo_title_tag: null, meta_description: "Old description", excerpt: "Old excerpt" });
  });

  it("saves blog SEO edits as unpublished changes, preserving other tags", async () => {
    const { c, draft, writes } = fakeWix();
    const before = (await c.getResource("post:post-1"))!;
    const r = await c.applyPatch("post:post-1", { field: "meta_description", before: "Old description", after: "New description" }, before.version, "k");
    expect(r).toMatchObject({ ok: true, newVersion: "2026-10-02T00:00:00.000Z", detail: { published: false } });
    expect(writes[0].action).toBe("UPDATE");
    expect(draft.seoData.tags).toHaveLength(2);
    expect(draft.seoData.tags.find((t) => (t.props as Record<string, string>)?.property === "og:image")).toBeTruthy();
    await c.applyPatch("post:post-1", { field: "title", before: "Hello world", after: "Hello from Acme" }, undefined, "k2");
    expect((await c.getResource("post:post-1"))?.fields).toMatchObject({ title: "Hello from Acme", seo_title_tag: "Hello from Acme", post_title: "Hello world" });
    expect(c.getCapabilities().publish).toBe(false);
    expect((await c.validateResource("post:post-1", { field: "title", before: null, after: "Hello from Acme" })).status).toBe("warning");
  });

  it("refuses to write when the post was edited since the before-state", async () => {
    const { c, writes } = fakeWix();
    const r = await c.applyPatch("post:post-1", { field: "excerpt", before: "Old excerpt", after: "New" }, "2025-01-01T00:00:00.000Z", "k");
    expect(r).toMatchObject({ ok: false, error: "conflict" });
    expect(writes).toHaveLength(0);
  });

  it("returns manual instructions for static editor pages", async () => {
    const { c, writes } = fakeWix();
    const before = await c.getResource("page:/about-us");
    expect(before).toMatchObject({ type: "static_page", fields: { editable: "false" } });
    const r = await c.applyPatch("page:/about-us", { field: "meta_description", before: null, after: "About Acme." }, before?.version, "k");
    expect(r.error).toBe("manual_required");
    expect(String(r.detail?.instructions)).toMatch(/SEO basics/);
    expect(String(r.detail?.instructions)).toContain("About Acme.");
    expect(writes).toHaveLength(0);
    expect(c.getCapabilities().limitations.join(" ")).toMatch(/cannot be edited through Wix's public APIs/);
  });

  it("rolls back the previous SEO values", async () => {
    const { c, draft } = fakeWix();
    const before = (await c.getResource("post:post-1"))!;
    await c.applyPatch("post:post-1", { field: "title", before: null, after: "New title" }, before.version, "k");
    await c.applyPatch("post:post-1", { field: "excerpt", before: "Old excerpt", after: "New excerpt" }, undefined, "k2");
    const rb = await c.rollback("post:post-1", before);
    expect(rb).toMatchObject({ ok: true, detail: { restored: ["seo_title_tag", "excerpt"] } });
    expect(draft.excerpt).toBe("Old excerpt");
    expect(draft.seoData.tags.some((t) => t.type === "title")).toBe(false);
    expect((await c.getResource("post:post-1"))?.fields.meta_description).toBe("Old description");
  });

  it("never exposes the API key in serialized output", async () => {
    const { c } = fakeWix();
    const r = await c.getResource("post:post-1");
    const p = await c.applyPatch("post:post-1", { field: "excerpt", before: null, after: "X" }, r?.version, "k");
    expect(JSON.stringify({ c, r, p, caps: c.getCapabilities(), t: await c.testConnection() })).not.toContain(KEY);
    const v = descriptor.validateConfig({ siteId: SITE, apiKey: KEY }, { projectWebsiteUrl: "https://www.acme.test" });
    expect(JSON.stringify(v.config)).not.toContain(KEY);
    expect(v.config).toEqual({ siteId: SITE, siteUrl: "https://www.acme.test", blogPrefix: "/post/" });
    expect(descriptor.create(v.config, v.secrets).id).toBe("wix");
    expect(() => descriptor.validateConfig({ siteId: "nope", apiKey: KEY })).toThrow();
  });
});
