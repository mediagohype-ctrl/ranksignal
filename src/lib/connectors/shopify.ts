// Shopify connector (Admin GraphQL API, custom-app access token).
// Resource ids are Shopify GraphQL GIDs (gid://shopify/Product/123 | Collection | Page | Article).
// Version = updatedAt; applyPatch refuses to write when the live version differs from expectedVersion.
// Writes only SEO title/description, body HTML (sanitised check) and product image alt text. It never
// touches prices, inventory, variants, checkout, payments, handles/URLs or publish state.
// Every request goes through safeRequest to the merchant's fixed *.myshopify.com host.
import { safeRequest, SafeRequestError, type SafeRequestOptions } from "@/lib/net/safe-request";
import { simpleDiff } from "@/lib/connectors/manual";
import type {
  Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";

/** Admin API version (quarterly releases, each supported ~12 months). Bump deliberately. */
export const SHOPIFY_API_VERSION = "2026-07";
export const SHOPIFY_REQUIRED_SCOPES = [
  "read_products", "write_products", "read_content", "write_content",
  "read_online_store_pages", "write_online_store_pages",
] as const;

export interface ShopifyConfig {
  /** "your-store.myshopify.com" (the permanent admin domain, not the custom domain). */
  shopDomain: string;
  /** Public storefront URL (custom domain), used to map crawled URLs to resources. */
  siteUrl: string;
}
export interface ShopifySecrets {
  accessToken: string;
}

/** Minimal response shape used from safeRequest (lets tests inject a fake). */
export interface HttpResponseLike {
  status: number;
  body: string;
  headers?: Headers;
}
export type HttpRequestFn = (url: string, opts: SafeRequestOptions) => Promise<HttpResponseLike>;

export interface ShopifyOptions {
  /** Test seam; defaults to safeRequest. */
  request?: HttpRequestFn;
  timeoutMs?: number;
}

type Kind = "product" | "collection" | "page" | "article";
const GID_KIND: Record<string, Kind> = { Product: "product", Collection: "collection", Page: "page", Article: "article" };

export const SHOPIFY_WRITABLE_FIELDS = ["title", "meta_description", "content"] as const;
const IMAGE_ALT = /^image_alt(?::(gid:\/\/shopify\/(?:MediaImage|Media)\/\d+))?$/;
/** Fields that must never be written by this connector (also blocked by policy). */
const FORBIDDEN_FIELD = /(price|compare_at|cost|inventory|stock|quantity|sku|barcode|variant|checkout|cart|payment|tax|shipping|discount|publish|status|handle|slug|url|redirect|vendor|tags|template)/i;

export const SHOPIFY_CAPABILITIES: ConnectorCapabilities = {
  readPages: true,
  createDraft: false,
  updateContent: true,
  updateMetadata: true,
  updateSchema: false,
  preview: true,
  publish: false,
  revisionHistory: false,
  rollback: true,
  delete: false,
  resourceTypes: ["product", "collection", "page", "article"],
  limitations: [
    "Edits SEO title and meta description (products/collections via the SEO fields; pages and blog articles via the global.title_tag / global.description_tag metafields), body HTML and product image alt text only.",
    "Never changes prices, inventory, variants, checkout, payments, handles/URLs or publish/visibility — those are refused by the connector and blocked by policy.",
    "Changes are saved directly to the live product/page (Shopify has no draft revisions for existing resources); every change goes through approval and records the before-state for rollback.",
    "JSON-LD/structured data (e.g. FAQ schema) is rendered by your theme; it cannot be edited here. A copy-ready snippet is provided for manual theme edits.",
    "Body HTML containing scripts, iframes, inline event handlers or javascript: links is refused.",
    "Preview is a text diff in this app, not a storefront preview. Shopify keeps no revision history, so rollback restores the values we recorded before the change.",
    "Only the primary language/market is edited; translated content is not changed.",
    "Concurrency control uses updatedAt; edits made in Shopify after review cause a conflict and nothing is written.",
  ],
};

/** Clear, user-facing failure from the Shopify API. Never contains the token. */
export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "forbidden" | "rate_limited" | "not_found" | "server" | "bad_response",
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
  get retryable() {
    return this.kind === "rate_limited" || this.kind === "server";
  }
}

export function normalizeShopDomain(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/.test(d) ? d : null;
}

const PRODUCT_FIELDS = `id handle title updatedAt descriptionHtml seo { title description } featuredMedia { id alt } media(first: 20) { nodes { id alt mediaContentType } }`;
const COLLECTION_FIELDS = `id handle title updatedAt descriptionHtml seo { title description }`;
const META_FIELDS = `titleTag: metafield(namespace: "global", key: "title_tag") { value } descriptionTag: metafield(namespace: "global", key: "description_tag") { value }`;
const PAGE_FIELDS = `id handle title updatedAt body ${META_FIELDS}`;
const ARTICLE_FIELDS = `id handle title updatedAt body blog { handle } ${META_FIELDS}`;
const FIELDS: Record<Kind, string> = { product: PRODUCT_FIELDS, collection: COLLECTION_FIELDS, page: PAGE_FIELDS, article: ARTICLE_FIELDS };
const LIST_ORDER: { kind: Kind; root: string }[] = [
  { kind: "product", root: "products" },
  { kind: "collection", root: "collections" },
  { kind: "page", root: "pages" },
  { kind: "article", root: "articles" },
];

export class ShopifyConnector implements Connector {
  id = "shopify";
  private endpoint: string;
  private site: string;
  private shop: string;
  private request: HttpRequestFn;
  private timeoutMs: number;

  constructor(config: ShopifyConfig, private secrets: ShopifySecrets, opts: ShopifyOptions = {}) {
    const shop = normalizeShopDomain(config.shopDomain);
    if (!shop) throw new Error('shopDomain must look like "your-store.myshopify.com"');
    if (!secrets.accessToken) throw new Error("accessToken is required");
    this.shop = shop;
    this.endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    this.site = (config.siteUrl?.trim() || `https://${shop}`).replace(/\/+$/, "");
    this.request = opts.request ?? safeRequest;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  getCapabilities() {
    return SHOPIFY_CAPABILITIES;
  }

  /** POST a GraphQL document; maps HTTP/GraphQL failures to ShopifyApiError with plain messages. */
  async gql<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let res: HttpResponseLike;
    try {
      res = await this.request(this.endpoint, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": this.secrets.accessToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        timeoutMs: this.timeoutMs,
        maxBytes: 4 * 1024 * 1024,
        allowedHosts: [this.shop],
      });
    } catch (e) {
      if (e instanceof SafeRequestError) {
        const transient = e.code === "timeout" || e.code === "network" || e.code === "dns_failed";
        throw new ShopifyApiError(
          transient ? `Could not reach Shopify (${e.code}). It will be retried.` : `Request to Shopify was refused (${e.code}).`,
          transient ? "server" : "bad_response",
        );
      }
      throw e;
    }
    if (res.status === 401) throw new ShopifyApiError("Shopify rejected the access token (401). Check that the custom app is installed and the Admin API access token was copied correctly.", "auth");
    if (res.status === 402) throw new ShopifyApiError("This Shopify store is frozen or unpaid (402); the Admin API is unavailable.", "forbidden");
    if (res.status === 403) throw new ShopifyApiError(`Shopify refused the request (403). The app is missing an access scope — it needs: ${SHOPIFY_REQUIRED_SCOPES.join(", ")}.`, "forbidden");
    if (res.status === 404) throw new ShopifyApiError("Shopify store or API version not found (404). Check the myshopify.com domain.", "not_found");
    if (res.status === 423) throw new ShopifyApiError("This Shopify store is locked (423).", "forbidden");
    if (res.status === 429) throw new ShopifyApiError("Shopify rate limit reached (429). The change will be retried shortly.", "rate_limited");
    if (res.status >= 500) throw new ShopifyApiError(`Shopify is temporarily unavailable (HTTP ${res.status}).`, "server");
    if (res.status !== 200) throw new ShopifyApiError(`Shopify returned HTTP ${res.status}.`, "bad_response");
    let parsed: { data?: T; errors?: { message?: string; extensions?: { code?: string } }[] };
    try {
      parsed = JSON.parse(res.body);
    } catch {
      throw new ShopifyApiError("Shopify returned an unreadable response.", "bad_response");
    }
    if (parsed.errors?.length) {
      const codes = parsed.errors.map((e) => e.extensions?.code ?? "");
      if (codes.includes("THROTTLED")) throw new ShopifyApiError("Shopify rate limit reached (query cost). The change will be retried shortly.", "rate_limited");
      if (codes.includes("ACCESS_DENIED")) throw new ShopifyApiError(`Shopify denied access to this data. The app needs these scopes: ${SHOPIFY_REQUIRED_SCOPES.join(", ")}.`, "forbidden");
      const msg = parsed.errors.map((e) => e.message ?? "error").join("; ").slice(0, 300);
      throw new ShopifyApiError(`Shopify GraphQL error: ${msg}`, "bad_response");
    }
    if (!parsed.data) throw new ShopifyApiError("Shopify returned no data.", "bad_response");
    return parsed.data;
  }

  async testConnection() {
    try {
      const data = await this.gql<{
        shop: { name: string; primaryDomain?: { url?: string } };
        currentAppInstallation?: { accessScopes?: { handle: string }[] };
      }>(`{ shop { name primaryDomain { url } } currentAppInstallation { accessScopes { handle } } }`);
      const granted = new Set((data.currentAppInstallation?.accessScopes ?? []).map((s) => s.handle));
      if (granted.size && !granted.has("write_products")) {
        return { ok: false, error: "The app token is missing the write_products scope. Add read/write products, content and online store pages scopes, then reinstall the app." };
      }
      const missing = ["write_content", "write_online_store_pages"].filter((s) => granted.size && !granted.has(s));
      const domain = data.shop.primaryDomain?.url ? ` (${data.shop.primaryDomain.url})` : "";
      const note = missing.length ? ` — missing ${missing.join(", ")}: pages/blog articles stay read-only` : "";
      return { ok: true, identity: `${data.shop.name}${domain}${note}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Connection to Shopify failed" };
    }
  }

  private kindOf(resourceId: string): Kind {
    const m = /^gid:\/\/shopify\/(Product|Collection|Page|Article)\/\d+$/.exec(resourceId);
    if (!m) throw new Error(`Invalid Shopify resource id "${resourceId}"`);
    return GID_KIND[m[1]];
  }

  private urlFor(kind: Kind, n: ShopifyNode): string {
    const h = encodeURIComponent(n.handle ?? "");
    switch (kind) {
      case "product": return `${this.site}/products/${h}`;
      case "collection": return `${this.site}/collections/${h}`;
      case "page": return `${this.site}/pages/${h}`;
      case "article": return `${this.site}/blogs/${encodeURIComponent(n.blog?.handle ?? "")}/${h}`;
    }
  }

  private toResource(kind: Kind, n: ShopifyNode): ConnectorResource {
    const fields: Record<string, string | null> = { name: n.title ?? null, handle: n.handle ?? null };
    if (kind === "product" || kind === "collection") {
      fields.title = n.seo?.title || null;
      fields.meta_description = n.seo?.description || null;
      fields.content = n.descriptionHtml ?? null;
    } else {
      fields.title = n.titleTag?.value || null;
      fields.meta_description = n.descriptionTag?.value || null;
      fields.content = n.body ?? null;
    }
    if (kind === "product") {
      fields.image_alt = n.featuredMedia ? n.featuredMedia.alt ?? "" : null;
      fields.featured_media_id = n.featuredMedia?.id ?? null;
      for (const m of n.media?.nodes ?? []) {
        if (m.mediaContentType === "IMAGE") fields[`image_alt:${m.id}`] = m.alt ?? "";
      }
    }
    return { id: n.id, type: kind, url: this.urlFor(kind, n), title: n.title ?? undefined, version: n.updatedAt, fields };
  }

  async listResources(cursor?: string) {
    const [kindRaw, ...rest] = (cursor ?? "product:").split(":");
    const idx = Math.max(0, LIST_ORDER.findIndex((x) => x.kind === kindRaw));
    const { kind, root } = LIST_ORDER[idx];
    const after = rest.join(":") || null;
    const data = await this.gql<Record<string, { nodes: ShopifyNode[]; pageInfo: { hasNextPage: boolean; endCursor?: string } }>>(
      `query($after: String) { ${root}(first: 50, after: $after) { nodes { ${FIELDS[kind]} } pageInfo { hasNextPage endCursor } } }`,
      { after },
    );
    const conn = data[root];
    const items = (conn?.nodes ?? []).map((n) => this.toResource(kind, n));
    let nextCursor: string | undefined;
    if (conn?.pageInfo?.hasNextPage && conn.pageInfo.endCursor) nextCursor = `${kind}:${conn.pageInfo.endCursor}`;
    else if (idx + 1 < LIST_ORDER.length) nextCursor = `${LIST_ORDER[idx + 1].kind}:`;
    return { items, nextCursor };
  }

  async getResource(resourceId: string) {
    const kind = this.kindOf(resourceId);
    const typeName = Object.keys(GID_KIND).find((k) => GID_KIND[k] === kind)!;
    const data = await this.gql<{ node: ShopifyNode | null }>(
      `query($id: ID!) { node(id: $id) { ... on ${typeName} { ${FIELDS[kind]} } } }`,
      { id: resourceId },
    );
    if (!data.node || !data.node.id) return null;
    return this.toResource(kind, data.node);
  }

  /** Map a storefront URL (/products|/collections|/pages|/blogs/{blog}/{handle}) to a GraphQL id by handle. */
  async resolveResourceId(url: string): Promise<string | null> {
    const parsed = parseShopifyStorefrontUrl(url);
    if (!parsed) return null;
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
    const siteHost = new URL(this.site).hostname.toLowerCase().replace(/^www\./, "");
    if (host !== siteHost && host !== this.shop) return null;
    const q = `handle:${JSON.stringify(parsed.handle)}`;
    if (parsed.kind === "article") {
      const data = await this.gql<{ blogs: { nodes: { handle: string; articles: { nodes: { id: string; handle: string }[] } }[] } }>(
        `query($bq: String!, $aq: String!) { blogs(first: 1, query: $bq) { nodes { handle articles(first: 5, query: $aq) { nodes { id handle } } } } }`,
        { bq: `handle:${JSON.stringify(parsed.blog)}`, aq: q },
      );
      const blog = data.blogs?.nodes?.find((b) => b.handle === parsed.blog);
      return blog?.articles?.nodes?.find((a) => a.handle === parsed.handle)?.id ?? null;
    }
    const root = LIST_ORDER.find((x) => x.kind === parsed.kind)!.root;
    const data = await this.gql<Record<string, { nodes: { id: string; handle: string }[] }>>(
      `query($q: String!) { ${root}(first: 5, query: $q) { nodes { id handle } } }`,
      { q },
    );
    return data[root]?.nodes?.find((n) => n.handle === parsed.handle)?.id ?? null;
  }

  async createDraft(): Promise<PatchResult> {
    return { ok: false, error: "not_supported", detail: { reason: "The Shopify connector does not create new products, pages or articles." } };
  }

  async proposePatch(_resourceId: string, change: ProposedChange) {
    return { preview: change.after, diff: simpleDiff(change.before, change.after) };
  }

  /** null when allowed; otherwise an error code. */
  private refuseField(kind: Kind, field: string, value: string | null): string | null {
    const isAlt = IMAGE_ALT.test(field);
    if (!isAlt && !(SHOPIFY_WRITABLE_FIELDS as readonly string[]).includes(field)) {
      return FORBIDDEN_FIELD.test(field) ? "blocked_field" : "unsupported_field";
    }
    if (isAlt && kind !== "product") return "unsupported_field";
    if (field === "content" && value && !isSafeHtml(value)) return "unsafe_html";
    return null;
  }

  private async userErrors(query: string, variables: Record<string, unknown>, root: string) {
    const data = await this.gql<Record<string, { userErrors?: { field?: string[]; message: string }[] } | null>>(query, variables);
    const errs = data[root]?.userErrors ?? [];
    if (errs.length) throw new ShopifyApiError(`Shopify refused the update: ${errs.map((e) => e.message).join("; ").slice(0, 300)}`, "bad_response");
  }

  private async writeField(current: ConnectorResource, field: string, value: string | null) {
    const kind = current.type as Kind;
    const id = current.id;
    if (IMAGE_ALT.test(field)) {
      const mediaId = IMAGE_ALT.exec(field)![1] ?? current.fields.featured_media_id;
      if (!mediaId) throw new ShopifyApiError("This product has no image to describe.", "bad_response");
      await this.userErrors(
        `mutation($productId: ID!, $media: [UpdateMediaInput!]!) { productUpdateMedia(productId: $productId, media: $media) { media { id alt } userErrors: mediaUserErrors { field message } } }`,
        { productId: id, media: [{ id: mediaId, alt: value ?? "" }] },
        "productUpdateMedia",
      );
      return;
    }
    if (kind === "product" || kind === "collection") {
      const input: Record<string, unknown> = { id };
      if (field === "content") input.descriptionHtml = value ?? "";
      else {
        input.seo = {
          title: field === "title" ? value ?? "" : current.fields.title ?? "",
          description: field === "meta_description" ? value ?? "" : current.fields.meta_description ?? "",
        };
      }
      if (kind === "product") {
        await this.userErrors(
          `mutation($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id updatedAt } userErrors { field message } } }`,
          { product: input }, "productUpdate",
        );
      } else {
        await this.userErrors(
          `mutation($input: CollectionInput!) { collectionUpdate(input: $input) { collection { id updatedAt } userErrors { field message } } }`,
          { input }, "collectionUpdate",
        );
      }
      return;
    }
    if (field === "content") {
      if (kind === "page") {
        await this.userErrors(
          `mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id updatedAt } userErrors { field message } } }`,
          { id, page: { body: value ?? "" } }, "pageUpdate",
        );
      } else {
        await this.userErrors(
          `mutation($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { id updatedAt } userErrors { field message } } }`,
          { id, article: { body: value ?? "" } }, "articleUpdate",
        );
      }
      return;
    }
    // Pages/articles: SEO lives in the global.title_tag / global.description_tag metafields.
    const key = field === "title" ? "title_tag" : "description_tag";
    if (value == null || value === "") {
      await this.userErrors(
        `mutation($metafields: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $metafields) { deletedMetafields { key } userErrors { field message } } }`,
        { metafields: [{ ownerId: id, namespace: "global", key }] }, "metafieldsDelete",
      );
      return;
    }
    await this.userErrors(
      `mutation($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { key value } userErrors { field message } } }`,
      { metafields: [{ ownerId: id, namespace: "global", key, type: field === "title" ? "single_line_text_field" : "multi_line_text_field", value }] },
      "metafieldsSet",
    );
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    let kind: Kind;
    try {
      kind = this.kindOf(resourceId);
    } catch {
      return { ok: false, error: "invalid_resource" };
    }
    const refused = this.refuseField(kind, change.field, change.after);
    if (refused) return { ok: false, error: refused, detail: { field: change.field } };
    try {
      const current = await this.getResource(resourceId);
      if (!current) return { ok: false, error: "not_found" };
      if (IMAGE_ALT.test(change.field) && current.fields[change.field] === undefined && change.field !== "image_alt") {
        return { ok: false, error: "not_found", detail: { field: change.field, reason: "Image not found on this product." } };
      }
      if (norm(current.fields[change.field]) === norm(change.after)) {
        return { ok: true, newVersion: current.version, detail: { alreadyApplied: true, idempotencyKey } };
      }
      if (expectedVersion && current.version !== expectedVersion) {
        return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: current.version } };
      }
      await this.writeField(current, change.field, change.after);
      const after = await this.getResource(resourceId);
      return { ok: true, newVersion: after?.version, detail: { idempotencyKey } };
    } catch (e) {
      return handleError(e);
    }
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const r = await this.getResource(resourceId);
    if (!r) return { status: "failed" as const, detail: "Resource no longer exists in Shopify" };
    if (norm(r.fields[change.field]) === norm(change.after)) return { status: "passed" as const, detail: `${change.field} matches the approved draft` };
    return { status: "failed" as const, detail: `${change.field} in Shopify does not match the approved draft` };
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    try {
      const current = await this.getResource(resourceId);
      if (!current) return { ok: false, error: "not_found" };
      const restored: string[] = [];
      for (const [field, before] of Object.entries(beforeState.fields)) {
        if (field === "image_alt") continue; // restored via its explicit image_alt:<mediaId> entry
        if (this.refuseField(current.type as Kind, field, null)) continue; // read-only/non-writable fields
        if (current.fields[field] === undefined) continue;
        if (norm(before) === norm(current.fields[field])) continue;
        await this.writeField(current, field, before);
        current.fields[field] = before; // keep sibling SEO values accurate for the next write
        restored.push(field);
      }
      if (!restored.length) return { ok: true, newVersion: current.version, detail: { nothingToRestore: true } };
      const after = await this.getResource(resourceId);
      return { ok: true, newVersion: after?.version, detail: { restored } };
    } catch (e) {
      const r = handleError(e);
      return { ...r, error: r.error ? `rollback_failed:${r.error}` : "rollback_failed" };
    }
  }

  async disconnect() {
    // The merchant revokes the token by uninstalling the custom app in Shopify admin; we only wipe our copy.
  }
}

interface ShopifyNode {
  id: string;
  handle?: string;
  title?: string;
  updatedAt?: string;
  descriptionHtml?: string | null;
  body?: string | null;
  seo?: { title?: string | null; description?: string | null } | null;
  titleTag?: { value?: string | null } | null;
  descriptionTag?: { value?: string | null } | null;
  featuredMedia?: { id: string; alt?: string | null } | null;
  media?: { nodes?: { id: string; alt?: string | null; mediaContentType?: string }[] };
  blog?: { handle?: string } | null;
}

/** Parse a storefront URL into {kind, handle}. Tolerates locale/market prefixes (/en-us/products/x). */
export function parseShopifyStorefrontUrl(url: string): { kind: Kind; handle: string; blog?: string } | null {
  let segs: string[];
  try {
    segs = new URL(url).pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  } catch {
    return null;
  }
  const pi = segs.lastIndexOf("products");
  if (pi !== -1 && segs[pi + 1]) return { kind: "product", handle: segs[pi + 1] };
  const ci = segs.indexOf("collections");
  if (ci !== -1 && segs[ci + 1]) return { kind: "collection", handle: segs[ci + 1] };
  const pg = segs.indexOf("pages");
  if (pg !== -1 && segs[pg + 1]) return { kind: "page", handle: segs[pg + 1] };
  const bi = segs.indexOf("blogs");
  if (bi !== -1 && segs[bi + 1] && segs[bi + 2] && segs[bi + 2] !== "tagged") {
    return { kind: "article", blog: segs[bi + 1], handle: segs[bi + 2] };
  }
  return null;
}

/** Conservative check: refuse HTML that could execute script on the storefront. */
export function isSafeHtml(html: string): boolean {
  return !/<\s*(script|iframe|object|embed|form|style|link|meta|base)\b/i.test(html)
    && !/\son[a-z]+\s*=/i.test(html)
    && !/(href|src|action|formaction|srcset|xlink:href)\s*=\s*["']?\s*(javascript|vbscript|data)\s*:/i.test(html);
}

function handleError(e: unknown): PatchResult {
  if (e instanceof ShopifyApiError) {
    if (e.retryable) throw e; // transient → job retries with backoff
    return { ok: false, error: e.kind === "auth" || e.kind === "forbidden" ? `shopify_${e.kind}` : "write_failed", detail: { message: e.message } };
  }
  throw e;
}

function norm(v: string | null | undefined) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/** Copy-ready FAQ JSON-LD instructions for Shopify themes (the connector cannot write theme code). */
export function shopifyFaqSnippetInstructions(jsonLd: string): string {
  return [
    "Shopify themes render structured data, so FAQ schema must be added to the theme by hand:",
    "1. In Shopify admin open Online Store → Themes → … → Edit code.",
    "2. Open the template or section for this page (e.g. sections/main-page.liquid).",
    "3. Paste the snippet below at the end of that file and save. Preview before publishing the theme.",
    "",
    `<script type="application/ld+json">\n${jsonLd}\n</script>`,
  ].join("\n");
}
