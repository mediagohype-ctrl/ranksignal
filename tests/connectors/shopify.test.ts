import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net/safe-request", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/net/safe-request")>();
  return { ...orig, safeRequest: vi.fn() };
});

import { safeRequest, type SafeRequestOptions } from "@/lib/net/safe-request";
import {
  ShopifyConnector, SHOPIFY_API_VERSION, ShopifyApiError, parseShopifyStorefrontUrl, isSafeHtml,
} from "@/lib/connectors/shopify";
import { descriptor } from "@/lib/connectors/catalog/shopify";
import { classifyAction } from "@/lib/policy/engine";

const PRODUCT = "gid://shopify/Product/1";
const PAGE = "gid://shopify/Page/2";
const ARTICLE = "gid://shopify/Article/3";
const MEDIA = "gid://shopify/MediaImage/9";

type Call = { url: string; opts: SafeRequestOptions; query: string; variables: Record<string, unknown> };

function fakeShop() {
  let tick = 0;
  const stamp = () => `2026-10-0${++tick}T00:00:00Z`;
  const product = {
    id: PRODUCT, handle: "blue-mug", title: "Blue mug", updatedAt: stamp(), descriptionHtml: "<p>Mug</p>",
    seo: { title: "Blue mug | Acme", description: "A blue mug." },
    featuredMedia: { id: MEDIA, alt: "" }, media: { nodes: [{ id: MEDIA, alt: "", mediaContentType: "IMAGE" }] },
  };
  const page = {
    id: PAGE, handle: "about", title: "About", updatedAt: product.updatedAt, body: "<p>About</p>",
    titleTag: null as null | { value: string }, descriptionTag: { value: "Old about" } as null | { value: string },
  };
  const article = { id: ARTICLE, handle: "hello", title: "Hello", updatedAt: product.updatedAt, body: "", blog: { handle: "news" }, titleTag: null, descriptionTag: null };
  const calls: Call[] = [];
  const mutations: string[] = [];
  let next: { status: number; body?: string } | null = null;

  vi.mocked(safeRequest).mockImplementation(async (url: string, opts: SafeRequestOptions = {}) => {
    const { query, variables = {} } = JSON.parse(String(opts.body)) as { query: string; variables?: Record<string, unknown> };
    calls.push({ url, opts, query, variables });
    const ok = (data: unknown) => ({ status: 200, headers: new Headers(), body: JSON.stringify({ data }), url });
    if (next) {
      const r = next;
      next = null;
      return { status: r.status, headers: new Headers(), body: r.body ?? "", url };
    }
    if (query.includes("mutation")) mutations.push(query.match(/\{\s*(\w+)\(/)?.[1] ?? "?");
    if (query.includes("shop {")) {
      return ok({
        shop: { name: "Acme", primaryDomain: { url: "https://acme.example" } },
        currentAppInstallation: { accessScopes: ["read_products", "write_products", "write_content", "write_online_store_pages"].map((handle) => ({ handle })) },
      });
    }
    if (query.includes("node(id:")) {
      const id = variables.id;
      return ok({ node: id === PRODUCT ? product : id === PAGE ? page : id === ARTICLE ? article : null });
    }
    if (query.includes("products(first: 5")) return ok({ products: { nodes: String(variables.q).includes('"blue-mug"') ? [{ id: PRODUCT, handle: "blue-mug" }] : [] } });
    if (query.includes("pages(first: 5")) return ok({ pages: { nodes: String(variables.q).includes('"about"') ? [{ id: PAGE, handle: "about" }] : [] } });
    if (query.includes("collections(first: 5")) return ok({ collections: { nodes: [] } });
    if (query.includes("blogs(first: 1")) return ok({ blogs: { nodes: [{ handle: "news", articles: { nodes: [{ id: ARTICLE, handle: "hello" }] } }] } });
    if (query.includes("productUpdate(")) {
      const p = variables.product as { seo?: { title: string; description: string }; descriptionHtml?: string };
      if (p.seo) product.seo = { ...p.seo };
      if (p.descriptionHtml !== undefined) product.descriptionHtml = p.descriptionHtml;
      product.updatedAt = stamp();
      return ok({ productUpdate: { product: { id: PRODUCT, updatedAt: product.updatedAt }, userErrors: [] } });
    }
    if (query.includes("productUpdateMedia(")) {
      const m = (variables.media as { id: string; alt: string }[])[0];
      product.media.nodes[0].alt = m.alt;
      product.featuredMedia.alt = m.alt;
      product.updatedAt = stamp();
      return ok({ productUpdateMedia: { media: [], userErrors: [] } });
    }
    if (query.includes("metafieldsSet(")) {
      for (const m of variables.metafields as { key: string; value: string }[]) {
        if (m.key === "title_tag") page.titleTag = { value: m.value };
        else page.descriptionTag = { value: m.value };
      }
      page.updatedAt = stamp();
      return ok({ metafieldsSet: { metafields: [], userErrors: [] } });
    }
    if (query.includes("metafieldsDelete(")) {
      for (const m of variables.metafields as { key: string }[]) {
        if (m.key === "title_tag") page.titleTag = null;
        else page.descriptionTag = null;
      }
      page.updatedAt = stamp();
      return ok({ metafieldsDelete: { deletedMetafields: [], userErrors: [] } });
    }
    return ok({});
  });

  const c = new ShopifyConnector({ shopDomain: "acme.myshopify.com", siteUrl: "https://acme.example" }, { accessToken: "shpat_secret_value" });
  return { c, product, page, calls, mutations, failNext: (status: number, body?: string) => void (next = { status, body }) };
}

beforeEach(() => {
  vi.mocked(safeRequest).mockReset();
});

describe("shopify connector", () => {
  it("connects via safeRequest to the fixed admin host with the token header", async () => {
    const { c, calls } = fakeShop();
    const r = await c.testConnection();
    expect(r).toEqual({ ok: true, identity: "Acme (https://acme.example)" });
    expect(calls[0].url).toBe(`https://acme.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`);
    expect(calls[0].opts.allowedHosts).toEqual(["acme.myshopify.com"]);
    expect(calls[0].opts.timeoutMs).toBeGreaterThan(0);
    expect(calls[0].opts.headers?.["X-Shopify-Access-Token"]).toBe("shpat_secret_value");
    expect(calls[0].query).toContain("shop { name primaryDomain { url } }");
  });

  it("gives clear messages for 401, 403 and 429 and never echoes the token", async () => {
    const { c, failNext } = fakeShop();
    failNext(401);
    const r401 = await c.testConnection();
    expect(r401.ok).toBe(false);
    expect(r401.error).toMatch(/rejected the access token/);
    failNext(403);
    expect((await c.testConnection()).error).toMatch(/missing an access scope.*write_products/);
    failNext(429);
    const r429 = await c.testConnection();
    expect(r429.error).toMatch(/rate limit/);
    expect(JSON.stringify([r401, r429])).not.toContain("shpat_secret_value");
  });

  it("maps storefront URLs to GraphQL ids by handle", async () => {
    const { c } = fakeShop();
    expect(await c.resolveResourceId("https://acme.example/products/blue-mug")).toBe(PRODUCT);
    expect(await c.resolveResourceId("https://www.acme.example/en-us/collections/mugs/products/blue-mug?variant=1")).toBe(PRODUCT);
    expect(await c.resolveResourceId("https://acme.example/pages/about")).toBe(PAGE);
    expect(await c.resolveResourceId("https://acme.example/blogs/news/hello")).toBe(ARTICLE);
    expect(await c.resolveResourceId("https://acme.example/products/missing")).toBeNull();
    expect(await c.resolveResourceId("https://other.example/products/blue-mug")).toBeNull();
    expect(parseShopifyStorefrontUrl("https://acme.example/collections/mugs")).toEqual({ kind: "collection", handle: "mugs" });
    expect(parseShopifyStorefrontUrl("https://acme.example/cart")).toBeNull();
  });

  it("reads SEO fields with updatedAt as version", async () => {
    const { c, product } = fakeShop();
    const r = await c.getResource(PRODUCT);
    expect(r).toMatchObject({ type: "product", url: "https://acme.example/products/blue-mug", version: product.updatedAt });
    expect(r?.fields).toMatchObject({ title: "Blue mug | Acme", meta_description: "A blue mug.", image_alt: "", [`image_alt:${MEDIA}`]: "" });
  });

  it("refuses to write on version conflict", async () => {
    const { c, mutations } = fakeShop();
    const r = await c.applyPatch(PRODUCT, { field: "title", before: "Blue mug | Acme", after: "Blue ceramic mug | Acme" }, "1999-01-01T00:00:00Z", "k");
    expect(r).toMatchObject({ ok: false, error: "conflict" });
    expect(mutations).toHaveLength(0);
  });

  it("updates the SEO title (keeping the description), validates, and rolls back", async () => {
    const { c, product } = fakeShop();
    const before = (await c.getResource(PRODUCT))!;
    const change = { field: "title", before: "Blue mug | Acme", after: "Blue ceramic mug | Acme" };
    const r = await c.applyPatch(PRODUCT, change, before.version, "k");
    expect(r.ok).toBe(true);
    expect(r.newVersion).not.toBe(before.version);
    expect(product.seo).toEqual({ title: "Blue ceramic mug | Acme", description: "A blue mug." });
    expect((await c.validateResource(PRODUCT, change)).status).toBe("passed");

    const alt = await c.applyPatch(PRODUCT, { field: `image_alt:${MEDIA}`, before: "", after: "Blue ceramic mug on a desk" }, r.newVersion, "k2");
    expect(alt.ok).toBe(true);

    const rb = await c.rollback(PRODUCT, before);
    expect(rb).toMatchObject({ ok: true });
    expect(product.seo).toEqual({ title: "Blue mug | Acme", description: "A blue mug." });
    expect(product.media.nodes[0].alt).toBe("");
  });

  it("writes page SEO through global metafields and rollback deletes a previously empty tag", async () => {
    const { c, page, mutations } = fakeShop();
    const before = (await c.getResource(PAGE))!;
    expect(before.fields.title).toBeNull();
    const r = await c.applyPatch(PAGE, { field: "title", before: null, after: "About Acme" }, before.version, "k");
    expect(r.ok).toBe(true);
    expect(page.titleTag).toEqual({ value: "About Acme" });
    await c.rollback(PAGE, before);
    expect(page.titleTag).toBeNull();
    expect(page.descriptionTag).toEqual({ value: "Old about" });
    expect(mutations).toEqual(["metafieldsSet", "metafieldsDelete"]);
  });

  it("refuses price/inventory/publish fields and unsafe HTML without calling Shopify", async () => {
    const { c, calls } = fakeShop();
    for (const field of ["price", "compare_at_price", "inventory_quantity", "status", "handle"]) {
      const r = await c.applyPatch(PRODUCT, { field, before: "10", after: "1" }, undefined, "k");
      expect(r).toMatchObject({ ok: false, error: "blocked_field" });
    }
    const html = await c.applyPatch(PRODUCT, { field: "content", before: null, after: '<p onclick="x()">Hi</p>' }, undefined, "k");
    expect(html).toMatchObject({ ok: false, error: "unsafe_html" });
    expect(calls).toHaveLength(0);
    expect(isSafeHtml("<p>Metadata: fine</p>")).toBe(true);
    expect(isSafeHtml('<a href="javascript:alert(1)">x</a>')).toBe(false);
  });

  it("policy blocks price/checkout changes and requires approval for content even with these capabilities", () => {
    const caps = descriptor.capabilities;
    expect(classifyAction({ type: "update_price", target: { resourceType: "product" }, proposedChange: { field: "price", before: "10", after: "1" }, connector: caps }).decision).toBe("blocked");
    expect(classifyAction({ type: "update_checkout", target: null, proposedChange: null, connector: caps }).decision).toBe("blocked");
    expect(classifyAction({ type: "update_content", target: { resourceType: "product" }, proposedChange: { field: "content", before: "", after: "<p>x</p>" }, connector: caps }).decision).toBe("approval_required");
    expect(caps.publish).toBe(false);
  });

  it("throws a retryable error on rate limit during a write (job retries)", async () => {
    const { c, failNext } = fakeShop();
    const before = (await c.getResource(PRODUCT))!;
    failNext(429);
    await expect(c.applyPatch(PRODUCT, { field: "title", before: null, after: "New" }, before.version, "k")).rejects.toBeInstanceOf(ShopifyApiError);
  });
});

describe("shopify descriptor", () => {
  it("validates input and keeps the token out of config", () => {
    const { config, secrets } = descriptor.validateConfig({ shopDomain: "https://Acme.myshopify.com/admin", accessToken: "shpat_abcdefghijkl" }, { projectWebsiteUrl: "https://acme.example/shop" });
    expect(config).toEqual({ shopDomain: "acme.myshopify.com", siteUrl: "https://acme.example" });
    expect(JSON.stringify(config)).not.toContain("shpat");
    expect(secrets).toEqual({ accessToken: "shpat_abcdefghijkl" });
    expect(() => descriptor.validateConfig({ shopDomain: "acme.example.com", accessToken: "shpat_abcdefghijkl" })).toThrow(/myshopify\.com/);
    expect(descriptor.setupSteps.join(" ")).toMatch(/write_online_store_pages/);
    expect(descriptor.create(config, secrets).id).toBe("shopify");
  });
});
