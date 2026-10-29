import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net/safe-request", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/net/safe-request")>();
  return { ...orig, safeRequest: vi.fn() };
});

import { safeRequest, type SafeRequestOptions } from "@/lib/net/safe-request";
import { WebflowConnector, WebflowApiError, sanitizeFieldMap } from "@/lib/connectors/webflow";
import { descriptor } from "@/lib/connectors/catalog/webflow";
import { classifyAction } from "@/lib/policy/engine";

const SITE = "a".repeat(24);
const PAGE_ID = "b".repeat(24);
const COL = "c".repeat(24);
const ITEM = "d".repeat(24);

type Call = { method: string; path: string; opts: SafeRequestOptions; body?: Record<string, unknown> };

function fakeWebflow() {
  let tick = 0;
  const stamp = () => `2026-10-0${++tick}T00:00:00.000Z`;
  const page = {
    id: PAGE_ID, title: "About", slug: "about", publishedPath: "/about", lastUpdated: stamp(), collectionId: null,
    seo: { title: "About", description: "Old description" },
    openGraph: { title: "", titleCopied: true, description: "", descriptionCopied: true },
  };
  const item = {
    id: ITEM, lastUpdated: page.lastUpdated, isDraft: false, isArchived: false,
    fieldData: { name: "Hello world", slug: "hello-world", "meta-description": "Old item desc", "post-body": "<p>Body</p>", price: "10" } as Record<string, unknown>,
  };
  const calls: Call[] = [];
  let next: { status: number; headers?: Record<string, string> } | null = null;

  vi.mocked(safeRequest).mockImplementation(async (url: string, opts: SafeRequestOptions = {}) => {
    const method = opts.method ?? "GET";
    const path = url.replace("https://api.webflow.com/v2", "");
    const body = opts.body ? (JSON.parse(String(opts.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path, opts, body });
    const res = (status: number, data: unknown) => ({ status, headers: new Headers(next?.headers), body: JSON.stringify(data), url });
    if (next) {
      const r = res(next.status, { message: "nope" });
      next = null;
      return r;
    }
    const p = path.split("?")[0];
    if (p === `/sites/${SITE}`) return res(200, { id: SITE, displayName: "Acme site", customDomains: [{ url: "www.acme.example" }] });
    if (p === `/sites/${SITE}/pages`) {
      return res(200, { pages: [page, { id: "e".repeat(24), title: "Post template", slug: "detail_post", collectionId: COL }], pagination: { total: 2 } });
    }
    if (p === `/sites/${SITE}/collections`) return res(200, { collections: [{ id: COL, slug: "blog", displayName: "Blog" }] });
    if (p === `/collections/${COL}`) return res(200, { id: COL, slug: "blog", displayName: "Blog" });
    if (p === `/collections/${COL}/items`) {
      const slug = new URL(url).searchParams.get("slug");
      return res(200, { items: !slug || slug === item.fieldData.slug ? [item] : [] });
    }
    if (p === `/pages/${PAGE_ID}`) {
      if (method === "PUT" && body) {
        if (body.seo) page.seo = body.seo as typeof page.seo;
        if (body.openGraph) page.openGraph = body.openGraph as typeof page.openGraph;
        page.lastUpdated = stamp();
      }
      return res(200, page);
    }
    if (p === `/collections/${COL}/items/${ITEM}`) {
      if (method === "PATCH" && body) {
        Object.assign(item.fieldData, body.fieldData as Record<string, unknown>);
        item.lastUpdated = stamp();
      }
      return res(200, item);
    }
    return res(404, { message: "not found" });
  });

  const c = new WebflowConnector(
    { siteId: SITE, siteUrl: "https://www.acme.example", fieldMap: { meta_description: "meta-description", content: "post-body" } },
    { token: "wf_secret_token_value_123" },
  );
  return { c, page, item, calls, failNext: (status: number, headers?: Record<string, string>) => void (next = { status, headers }) };
}

beforeEach(() => {
  vi.mocked(safeRequest).mockReset();
});

describe("webflow connector", () => {
  it("connects with GET /v2/sites/{siteId} via safeRequest to api.webflow.com", async () => {
    const { c, calls } = fakeWebflow();
    expect(await c.testConnection()).toEqual({ ok: true, identity: "Acme site (www.acme.example)" });
    expect(calls[0]).toMatchObject({ method: "GET", path: `/sites/${SITE}` });
    expect(calls[0].opts.allowedHosts).toEqual(["api.webflow.com"]);
    expect(calls[0].opts.timeoutMs).toBeGreaterThan(0);
    expect(calls[0].opts.headers?.Authorization).toBe("Bearer wf_secret_token_value_123");
  });

  it("gives clear messages for 401, 403 and 429 without leaking the token", async () => {
    const { c, failNext } = fakeWebflow();
    failNext(401);
    const r401 = await c.testConnection();
    expect(r401.error).toMatch(/rejected the API token/);
    failNext(403);
    expect((await c.testConnection()).error).toMatch(/missing a scope.*pages:write/);
    failNext(429, { "retry-after": "30" });
    const r429 = await c.testConnection();
    expect(r429.error).toMatch(/rate limit.*30s/);
    expect(JSON.stringify([r401, r429])).not.toContain("wf_secret");
  });

  it("maps URLs to static pages and CMS items", async () => {
    const { c } = fakeWebflow();
    expect(await c.resolveResourceId("https://acme.example/about/")).toBe(`page:${PAGE_ID}`);
    expect(await c.resolveResourceId("https://www.acme.example/blog/hello-world")).toBe(`item:${COL}:${ITEM}`);
    expect(await c.resolveResourceId("https://www.acme.example/blog/missing")).toBeNull();
    expect(await c.resolveResourceId("https://other.example/about")).toBeNull();
    const list = await c.listResources();
    expect(list.items.map((r) => r.id)).toEqual([`page:${PAGE_ID}`]); // template page excluded
    expect(list.nextCursor).toBe("items:0:0");
  });

  it("updates page SEO via PUT with a version check, then rolls back", async () => {
    const { c, page, calls } = fakeWebflow();
    const before = (await c.getResource(`page:${PAGE_ID}`))!;
    expect(before.version).toBe(page.lastUpdated);

    const conflict = await c.applyPatch(`page:${PAGE_ID}`, { field: "meta_description", before: "Old description", after: "New" }, "2000-01-01T00:00:00.000Z", "k");
    expect(conflict).toMatchObject({ ok: false, error: "conflict" });
    expect(calls.filter((x) => x.method !== "GET")).toHaveLength(0);

    const change = { field: "meta_description", before: "Old description", after: "Acme makes mugs in Pune." };
    const r = await c.applyPatch(`page:${PAGE_ID}`, change, before.version, "k");
    expect(r).toMatchObject({ ok: true, detail: { published: false } });
    expect(page.seo).toEqual({ title: "About", description: "Acme makes mugs in Pune." });
    const put = calls.find((x) => x.method === "PUT")!;
    expect(put.path).toBe(`/pages/${PAGE_ID}`);
    expect(put.body).toEqual({ seo: { title: "About", description: "Acme makes mugs in Pune." } });
    expect((await c.validateResource(`page:${PAGE_ID}`, change)).status).toBe("passed");

    const og = await c.applyPatch(`page:${PAGE_ID}`, { field: "og_title", before: "", after: "About Acme" }, r.newVersion, "k2");
    expect(og.ok).toBe(true);
    expect(page.openGraph).toMatchObject({ title: "About Acme", titleCopied: false });

    const rb = await c.rollback(`page:${PAGE_ID}`, before);
    expect(rb.ok).toBe(true);
    expect(page.seo.description).toBe("Old description");
    expect(page.openGraph).toMatchObject({ title: "", titleCopied: true });
    expect(calls.some((x) => /publish/.test(x.path))).toBe(false);
  });

  it("updates mapped CMS fields on the staged item only (never /live, never publish) and rolls back", async () => {
    const { c, item, calls } = fakeWebflow();
    const id = `item:${COL}:${ITEM}`;
    const before = (await c.getResource(id))!;
    expect(before.fields).toMatchObject({ meta_description: "Old item desc", content: "<p>Body</p>", slug: "hello-world" });
    const r = await c.applyPatch(id, { field: "meta_description", before: "Old item desc", after: "A friendly hello." }, before.version, "k");
    expect(r.ok).toBe(true);
    const patch = calls.find((x) => x.method === "PATCH")!;
    expect(patch.path).toBe(`/collections/${COL}/items/${ITEM}`);
    expect(patch.body).toEqual({ fieldData: { "meta-description": "A friendly hello." } });
    expect(item.fieldData).toMatchObject({ name: "Hello world", slug: "hello-world" });
    expect(item.isDraft).toBe(false);

    await c.rollback(id, before);
    expect(item.fieldData["meta-description"]).toBe("Old item desc");
    expect(calls.some((x) => /live|publish/.test(x.path))).toBe(false);
  });

  it("refuses unmapped, price, slug and name fields and unsafe HTML without writing", async () => {
    const { c, calls } = fakeWebflow();
    const id = `item:${COL}:${ITEM}`;
    expect(await c.applyPatch(id, { field: "price", before: "10", after: "1" }, undefined, "k")).toMatchObject({ ok: false, error: "blocked_field" });
    expect(await c.applyPatch(id, { field: "slug", before: "a", after: "b" }, undefined, "k")).toMatchObject({ ok: false, error: "blocked_field" });
    expect(await c.applyPatch(id, { field: "name", before: "a", after: "b" }, undefined, "k")).toMatchObject({ ok: false, error: "blocked_field" });
    expect(await c.applyPatch(id, { field: "title", before: "a", after: "b" }, undefined, "k")).toMatchObject({ ok: false, error: "field_not_mapped" });
    expect(await c.applyPatch(id, { field: "content", before: "", after: "<script>alert(1)</script>" }, undefined, "k")).toMatchObject({ ok: false, error: "unsafe_html" });
    expect(await c.applyPatch(`page:${PAGE_ID}`, { field: "price", before: "", after: "1" }, undefined, "k")).toMatchObject({ ok: false, error: "blocked_field" });
    expect(calls).toHaveLength(0);
    expect(classifyAction({ type: "update_price", target: { resourceType: "cms_item" }, proposedChange: { field: "price", before: "10", after: "1" }, connector: descriptor.capabilities }).decision).toBe("blocked");
    expect(classifyAction({ type: "publish_post", target: { resourceType: "cms_item" }, proposedChange: { field: "status", before: "draft", after: "published" }, connector: descriptor.capabilities }).decision).toBe("blocked");
  });

  it("rethrows rate limits during writes so the job retries", async () => {
    const { c, failNext } = fakeWebflow();
    const before = (await c.getResource(`page:${PAGE_ID}`))!;
    failNext(429);
    await expect(c.applyPatch(`page:${PAGE_ID}`, { field: "title", before: "About", after: "About Acme" }, before.version, "k")).rejects.toBeInstanceOf(WebflowApiError);
  });
});

describe("webflow descriptor", () => {
  it("validates input, builds the field map and keeps the token out of config", () => {
    const { config, secrets } = descriptor.validateConfig({
      siteId: SITE.toUpperCase(), siteUrl: "https://www.acme.example/", token: "wf_secret_token_value_123",
      metaDescriptionField: "meta-description", contentField: "post-body", seoTitleField: "slug",
    });
    expect(config).toEqual({ siteId: SITE, siteUrl: "https://www.acme.example", fieldMap: { meta_description: "meta-description", content: "post-body" } });
    expect(JSON.stringify(config)).not.toContain("wf_secret");
    expect(secrets).toEqual({ token: "wf_secret_token_value_123" });
    expect(() => descriptor.validateConfig({ siteId: "nope", token: "wf_secret_token_value_123", siteUrl: "https://x.example" })).toThrow(/Site ID/);
    expect(sanitizeFieldMap({ title: "name", content: "post body!" })).toEqual({});
    expect(descriptor.setupSteps.join(" ")).toMatch(/CMS — Read and write/);
    expect(descriptor.capabilities.publish).toBe(false);
    expect(descriptor.create(config, secrets).id).toBe("webflow");
  });
});
