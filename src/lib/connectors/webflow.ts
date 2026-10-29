// Webflow connector (Data API v2, site API token).
// Resource ids: "page:<pageId>" for static pages, "item:<collectionId>:<itemId>" for CMS items.
// Version = lastUpdated; applyPatch refuses to write when the live version differs from expectedVersion.
// Static page SEO/Open Graph is written via PUT /v2/pages/{id}; CMS items are written to the STAGED
// item (PATCH /v2/collections/{cid}/items/{iid}, never the /live endpoint) so nothing goes live until
// someone publishes the site in Webflow. This connector never publishes, never changes name/slug and
// never deletes. Every request goes through safeRequest to the fixed host api.webflow.com.
import { safeRequest, SafeRequestError, type SafeRequestOptions } from "@/lib/net/safe-request";
import { simpleDiff } from "@/lib/connectors/manual";
import type {
  Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";

export const WEBFLOW_API_BASE = "https://api.webflow.com/v2";
export const WEBFLOW_HOST = "api.webflow.com";
export const WEBFLOW_REQUIRED_SCOPES = ["sites:read", "pages:read", "pages:write", "cms:read", "cms:write"] as const;

/** Standard field name → Webflow CMS field slug (per site; applies to every collection that has that slug). */
export type WebflowFieldMap = Partial<Record<"title" | "meta_description" | "og_title" | "og_description" | "content", string>>;

export interface WebflowConfig {
  siteId: string;
  /** Public site URL, used to map audited URLs to pages/items. */
  siteUrl: string;
  fieldMap?: WebflowFieldMap;
}
export interface WebflowSecrets {
  token: string;
}

export interface HttpResponseLike {
  status: number;
  body: string;
  headers?: Headers;
}
export type HttpRequestFn = (url: string, opts: SafeRequestOptions) => Promise<HttpResponseLike>;

export interface WebflowOptions {
  /** Test seam; defaults to safeRequest. */
  request?: HttpRequestFn;
  timeoutMs?: number;
}

const PAGE_FIELDS = ["title", "meta_description", "og_title", "og_description"] as const;
const FORBIDDEN_FIELD = /(price|inventory|sku|checkout|payment|publish|status|draft|archive|slug|url|name|redirect|password|delete)/i;

export const WEBFLOW_CAPABILITIES: ConnectorCapabilities = {
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
  resourceTypes: ["page", "cms_item"],
  limitations: [
    "Static pages: edits the SEO title, meta description and Open Graph title/description in page settings.",
    "CMS items: edits only the fields you map (SEO title, meta description, Open Graph, one rich-text body field). Item name and slug are never changed.",
    "Nothing is published: changes are saved as staged edits and go live only when you publish the site in Webflow (Webflow publishes all staged changes together, so review other pending edits first).",
    "CMS collection template pages are not edited (their SEO comes from item fields), and secondary locales are not changed.",
    "Structured data (JSON-LD) lives in custom code / embeds and is not edited; a copy-ready snippet is provided instead.",
    "Rich text containing scripts, iframes, inline event handlers or javascript: links is refused.",
    "Preview is a text diff in this app. Webflow keeps no API revision history, so rollback restores the values we recorded before the change.",
    "Concurrency control uses lastUpdated; edits made in Webflow after review cause a conflict and nothing is written.",
  ],
};

export class WebflowApiError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "forbidden" | "rate_limited" | "not_found" | "server" | "bad_response",
  ) {
    super(message);
    this.name = "WebflowApiError";
  }
  get retryable() {
    return this.kind === "rate_limited" || this.kind === "server";
  }
}

interface WfPage {
  id: string;
  title?: string;
  slug?: string;
  parentId?: string | null;
  collectionId?: string | null;
  publishedPath?: string | null;
  lastUpdated?: string;
  draft?: boolean;
  archived?: boolean;
  seo?: { title?: string | null; description?: string | null } | null;
  openGraph?: { title?: string | null; titleCopied?: boolean; description?: string | null; descriptionCopied?: boolean } | null;
}
interface WfCollection {
  id: string;
  slug?: string;
  displayName?: string;
  fields?: { slug: string; type: string }[];
}
interface WfItem {
  id: string;
  lastUpdated?: string;
  isDraft?: boolean;
  isArchived?: boolean;
  fieldData?: Record<string, unknown>;
}

const ID_RE = /^[a-f0-9]{24}$/i;

export class WebflowConnector implements Connector {
  id = "webflow";
  private site: string;
  private siteId: string;
  private fieldMap: WebflowFieldMap;
  private request: HttpRequestFn;
  private timeoutMs: number;
  private collectionCache = new Map<string, WfCollection>();

  constructor(config: WebflowConfig, private secrets: WebflowSecrets, opts: WebflowOptions = {}) {
    if (!config.siteId || !/^[A-Za-z0-9]{6,64}$/.test(config.siteId)) throw new Error("siteId is invalid");
    if (!secrets.token) throw new Error("token is required");
    this.siteId = config.siteId;
    this.site = config.siteUrl.trim().replace(/\/+$/, "");
    this.fieldMap = sanitizeFieldMap(config.fieldMap);
    this.request = opts.request ?? safeRequest;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  getCapabilities() {
    return WEBFLOW_CAPABILITIES;
  }

  async call<T>(path: string, init: { method?: "GET" | "PUT" | "PATCH"; body?: unknown } = {}): Promise<T> {
    let res: HttpResponseLike;
    try {
      res = await this.request(`${WEBFLOW_API_BASE}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${this.secrets.token}`,
          Accept: "application/json",
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        timeoutMs: this.timeoutMs,
        maxBytes: 4 * 1024 * 1024,
        allowedHosts: [WEBFLOW_HOST],
      });
    } catch (e) {
      if (e instanceof SafeRequestError) {
        const transient = e.code === "timeout" || e.code === "network" || e.code === "dns_failed";
        throw new WebflowApiError(
          transient ? `Could not reach Webflow (${e.code}). It will be retried.` : `Request to Webflow was refused (${e.code}).`,
          transient ? "server" : "bad_response",
        );
      }
      throw e;
    }
    const s = res.status;
    if (s === 401) throw new WebflowApiError("Webflow rejected the API token (401). It may have been revoked — generate a new site token in Webflow and reconnect.", "auth");
    if (s === 403) throw new WebflowApiError(`Webflow refused the request (403). The token is missing a scope — it needs: ${WEBFLOW_REQUIRED_SCOPES.join(", ")}.`, "forbidden");
    if (s === 404) throw new WebflowApiError("Not found in Webflow (404). Check the Site ID, or the page/item was deleted.", "not_found");
    if (s === 429) {
      const after = res.headers?.get("retry-after");
      throw new WebflowApiError(`Webflow rate limit reached (429)${after ? `; retry after ${after}s` : ""}. The change will be retried.`, "rate_limited");
    }
    if (s >= 500) throw new WebflowApiError(`Webflow is temporarily unavailable (HTTP ${s}).`, "server");
    if (s < 200 || s >= 300) {
      let msg = "";
      try {
        msg = String((JSON.parse(res.body) as { message?: string }).message ?? "");
      } catch {
        msg = "";
      }
      throw new WebflowApiError(`Webflow returned HTTP ${s}${msg ? `: ${msg.slice(0, 200)}` : ""}.`, "bad_response");
    }
    try {
      return (res.body ? JSON.parse(res.body) : {}) as T;
    } catch {
      throw new WebflowApiError("Webflow returned an unreadable response.", "bad_response");
    }
  }

  async testConnection() {
    try {
      const site = await this.call<{ id: string; displayName?: string; shortName?: string; customDomains?: { url?: string }[] }>(
        `/sites/${encodeURIComponent(this.siteId)}`,
      );
      const domain = site.customDomains?.[0]?.url;
      return { ok: true, identity: `${site.displayName ?? site.shortName ?? "Webflow site"}${domain ? ` (${domain})` : ""}` };
    } catch (e) {
      if (e instanceof WebflowApiError && e.kind === "not_found") return { ok: false, error: "Webflow site not found — check the Site ID (Site settings → General)." };
      return { ok: false, error: e instanceof Error ? e.message : "Connection to Webflow failed" };
    }
  }

  // ---------- reading ----------

  private pagePath(p: WfPage): string {
    if (p.publishedPath) return p.publishedPath.startsWith("/") ? p.publishedPath : `/${p.publishedPath}`;
    return p.slug && p.slug !== "index" ? `/${p.slug}` : "/";
  }

  private pageResource(p: WfPage): ConnectorResource {
    return {
      id: `page:${p.id}`,
      type: "page",
      url: `${this.site}${this.pagePath(p)}`,
      title: p.title ?? undefined,
      version: p.lastUpdated,
      fields: {
        name: p.title ?? null,
        slug: p.slug ?? null,
        title: p.seo?.title ?? null,
        meta_description: p.seo?.description ?? null,
        og_title: p.openGraph?.title ?? null,
        og_title_copied: p.openGraph?.titleCopied ? "true" : "false",
        og_description: p.openGraph?.description ?? null,
        og_description_copied: p.openGraph?.descriptionCopied ? "true" : "false",
      },
    };
  }

  private async collection(collectionId: string): Promise<WfCollection> {
    const hit = this.collectionCache.get(collectionId);
    if (hit) return hit;
    const c = await this.call<WfCollection>(`/collections/${encodeURIComponent(collectionId)}`);
    this.collectionCache.set(collectionId, c);
    return c;
  }

  private itemResource(c: WfCollection, item: WfItem): ConnectorResource {
    const fd = item.fieldData ?? {};
    const fields: Record<string, string | null> = {
      name: str(fd.name),
      slug: str(fd.slug),
      is_draft: item.isDraft ? "true" : "false",
    };
    for (const [std, slug] of Object.entries(this.fieldMap)) {
      if (slug) fields[std] = str(fd[slug]);
    }
    return {
      id: `item:${c.id}:${item.id}`,
      type: "cms_item",
      url: `${this.site}/${c.slug ?? ""}/${str(fd.slug) ?? ""}`,
      title: str(fd.name) ?? undefined,
      version: item.lastUpdated,
      fields,
    };
  }

  private parseId(resourceId: string): { kind: "page"; pageId: string } | { kind: "item"; collectionId: string; itemId: string } {
    const parts = resourceId.split(":");
    if (parts[0] === "page" && parts.length === 2 && ID_RE.test(parts[1])) return { kind: "page", pageId: parts[1] };
    if (parts[0] === "item" && parts.length === 3 && ID_RE.test(parts[1]) && ID_RE.test(parts[2])) {
      return { kind: "item", collectionId: parts[1], itemId: parts[2] };
    }
    throw new Error(`Invalid Webflow resource id "${resourceId}"`);
  }

  async getResource(resourceId: string): Promise<ConnectorResource | null> {
    const id = this.parseId(resourceId);
    try {
      if (id.kind === "page") return this.pageResource(await this.call<WfPage>(`/pages/${id.pageId}`));
      const c = await this.collection(id.collectionId);
      const item = await this.call<WfItem>(`/collections/${id.collectionId}/items/${id.itemId}`);
      return this.itemResource(c, item);
    } catch (e) {
      if (e instanceof WebflowApiError && e.kind === "not_found") return null;
      throw e;
    }
  }

  async listResources(cursor?: string) {
    const [kind, a, b] = (cursor ?? "pages:0").split(":");
    if (kind === "pages") {
      const offset = Math.max(0, Number(a) || 0);
      const data = await this.call<{ pages?: WfPage[]; pagination?: { total?: number } }>(
        `/sites/${encodeURIComponent(this.siteId)}/pages?limit=100&offset=${offset}`,
      );
      const pages = data.pages ?? [];
      const items = pages.filter((p) => !p.collectionId && !p.archived).map((p) => this.pageResource(p));
      const total = data.pagination?.total ?? 0;
      const nextCursor = offset + pages.length < total && pages.length ? `pages:${offset + pages.length}` : "items:0:0";
      return { items, nextCursor };
    }
    const ci = Math.max(0, Number(a) || 0);
    const offset = Math.max(0, Number(b) || 0);
    const cols = await this.listCollections();
    const c = cols[ci];
    if (!c) return { items: [] };
    const data = await this.call<{ items?: WfItem[]; pagination?: { total?: number } }>(
      `/collections/${c.id}/items?limit=100&offset=${offset}`,
    );
    const list = data.items ?? [];
    const items = list.filter((i) => !i.isArchived).map((i) => this.itemResource(c, i));
    const total = data.pagination?.total ?? 0;
    let nextCursor: string | undefined;
    if (list.length && offset + list.length < total) nextCursor = `items:${ci}:${offset + list.length}`;
    else if (ci + 1 < cols.length) nextCursor = `items:${ci + 1}:0`;
    return { items, nextCursor };
  }

  private async listCollections(): Promise<WfCollection[]> {
    const data = await this.call<{ collections?: WfCollection[] }>(`/sites/${encodeURIComponent(this.siteId)}/collections`);
    const cols = data.collections ?? [];
    for (const c of cols) if (!this.collectionCache.has(c.id)) this.collectionCache.set(c.id, c);
    return cols;
  }

  /** Map a public URL to a static page (by published path) or a CMS item (/<collection-slug>/<item-slug>). */
  async resolveResourceId(url: string): Promise<string | null> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    const host = (h: string) => h.toLowerCase().replace(/^www\./, "");
    if (host(u.hostname) !== host(new URL(this.site).hostname) && !u.hostname.endsWith(".webflow.io")) return null;
    const path = u.pathname.replace(/\/+$/, "") || "/";

    // 1. Static pages by published path.
    for (let offset = 0, guard = 0; guard < 20; guard++) {
      const data = await this.call<{ pages?: WfPage[]; pagination?: { total?: number } }>(
        `/sites/${encodeURIComponent(this.siteId)}/pages?limit=100&offset=${offset}`,
      );
      const pages = data.pages ?? [];
      const hit = pages.find((p) => !p.collectionId && this.pagePath(p).replace(/\/+$/, "") === (path === "/" ? "" : path));
      if (hit) return `page:${hit.id}`;
      offset += pages.length;
      if (!pages.length || offset >= (data.pagination?.total ?? 0)) break;
    }

    // 2. CMS items: /<collection-slug>/<item-slug>.
    const segs = path.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
    if (segs.length < 2) return null;
    const itemSlug = segs[segs.length - 1];
    const colSlug = segs[segs.length - 2];
    const col = (await this.listCollections()).find((c) => c.slug === colSlug);
    if (!col) return null;
    const data = await this.call<{ items?: WfItem[] }>(`/collections/${col.id}/items?slug=${encodeURIComponent(itemSlug)}&limit=10`);
    const item = (data.items ?? []).find((i) => str(i.fieldData?.slug) === itemSlug);
    return item ? `item:${col.id}:${item.id}` : null;
  }

  // ---------- writing ----------

  async createDraft(): Promise<PatchResult> {
    return { ok: false, error: "not_supported", detail: { reason: "The Webflow connector does not create pages or CMS items." } };
  }

  async proposePatch(_resourceId: string, change: ProposedChange) {
    return { preview: change.after, diff: simpleDiff(change.before, change.after) };
  }

  private refuseField(kind: "page" | "item", field: string, value: string | null): string | null {
    const allowed = kind === "page" ? (PAGE_FIELDS as readonly string[]).includes(field) : Boolean(this.fieldMap[field as keyof WebflowFieldMap]);
    if (!allowed) {
      if (kind === "item" && (PAGE_FIELDS as readonly string[]).concat("content").includes(field)) return "field_not_mapped";
      return FORBIDDEN_FIELD.test(field) ? "blocked_field" : "unsupported_field";
    }
    if (field === "content" && value && !isSafeHtml(value)) return "unsafe_html";
    return null;
  }

  private async writeFields(resourceId: string, current: ConnectorResource, values: Record<string, string | null>) {
    const id = this.parseId(resourceId);
    if (id.kind === "page") {
      const f = { ...current.fields, ...values };
      const body: Record<string, unknown> = {};
      if ("title" in values || "meta_description" in values) {
        body.seo = { title: f.title ?? "", description: f.meta_description ?? "" };
      }
      if ("og_title" in values || "og_description" in values || "og_title_copied" in values || "og_description_copied" in values) {
        body.openGraph = {
          title: f.og_title ?? "",
          titleCopied: "og_title" in values && !("og_title_copied" in values) ? false : f.og_title_copied === "true",
          description: f.og_description ?? "",
          descriptionCopied: "og_description" in values && !("og_description_copied" in values) ? false : f.og_description_copied === "true",
        };
      }
      await this.call(`/pages/${id.pageId}`, { method: "PUT", body });
      return;
    }
    const fieldData: Record<string, string | null> = {};
    for (const [std, v] of Object.entries(values)) {
      const slug = this.fieldMap[std as keyof WebflowFieldMap];
      if (slug) fieldData[slug] = v;
    }
    // Staged endpoint only (not /live): isDraft, name and slug are left exactly as they are.
    await this.call(`/collections/${id.collectionId}/items/${id.itemId}`, { method: "PATCH", body: { fieldData } });
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    let kind: "page" | "item";
    try {
      kind = this.parseId(resourceId).kind;
    } catch {
      return { ok: false, error: "invalid_resource" };
    }
    const refused = this.refuseField(kind, change.field, change.after);
    if (refused) return { ok: false, error: refused, detail: { field: change.field } };
    try {
      const current = await this.getResource(resourceId);
      if (!current) return { ok: false, error: "not_found" };
      if (norm(current.fields[change.field]) === norm(change.after)) {
        return { ok: true, newVersion: current.version, detail: { alreadyApplied: true, idempotencyKey } };
      }
      if (expectedVersion && current.version !== expectedVersion) {
        return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: current.version } };
      }
      await this.writeFields(resourceId, current, { [change.field]: change.after });
      const after = await this.getResource(resourceId);
      return { ok: true, newVersion: after?.version, detail: { idempotencyKey, staged: true, published: false } };
    } catch (e) {
      return handleError(e);
    }
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const r = await this.getResource(resourceId);
    if (!r) return { status: "failed" as const, detail: "Resource no longer exists in Webflow" };
    if (norm(r.fields[change.field]) === norm(change.after)) {
      return { status: "passed" as const, detail: `${change.field} saved in Webflow (goes live at the next site publish)` };
    }
    return { status: "failed" as const, detail: `${change.field} in Webflow does not match the approved draft` };
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    try {
      const kind = this.parseId(resourceId).kind;
      const current = await this.getResource(resourceId);
      if (!current) return { ok: false, error: "not_found" };
      const values: Record<string, string | null> = {};
      for (const [field, before] of Object.entries(beforeState.fields)) {
        if (this.refuseField(kind, field, null)) continue;
        if (current.fields[field] === undefined || norm(before) === norm(current.fields[field])) continue;
        values[field] = before;
      }
      if (kind === "page" && Object.keys(values).some((k) => k.startsWith("og_"))) {
        values.og_title_copied = beforeState.fields.og_title_copied ?? "false";
        values.og_description_copied = beforeState.fields.og_description_copied ?? "false";
      }
      const restored = Object.keys(values).filter((k) => !k.endsWith("_copied"));
      if (!restored.length) return { ok: true, newVersion: current.version, detail: { nothingToRestore: true } };
      await this.writeFields(resourceId, current, values);
      const after = await this.getResource(resourceId);
      return { ok: true, newVersion: after?.version, detail: { restored } };
    } catch (e) {
      const r = handleError(e);
      return { ...r, error: r.error ? `rollback_failed:${r.error}` : "rollback_failed" };
    }
  }

  async disconnect() {
    // Site tokens are revoked in Webflow (Site settings → Apps & integrations → API access); we only wipe our copy.
  }
}

export function sanitizeFieldMap(input: unknown): WebflowFieldMap {
  const out: WebflowFieldMap = {};
  if (!input || typeof input !== "object") return out;
  for (const key of ["title", "meta_description", "og_title", "og_description", "content"] as const) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v !== "string") continue;
    const slug = v.trim();
    // Never map onto the item name/slug or Webflow system fields.
    if (/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug) && !["name", "slug", "_archived", "_draft"].includes(slug.toLowerCase())) out[key] = slug;
  }
  return out;
}

export function isSafeHtml(html: string): boolean {
  return !/<\s*(script|iframe|object|embed|form|style|link|meta|base)\b/i.test(html)
    && !/\son[a-z]+\s*=/i.test(html)
    && !/(href|src|action|formaction|srcset|xlink:href)\s*=\s*["']?\s*(javascript|vbscript|data)\s*:/i.test(html);
}

function handleError(e: unknown): PatchResult {
  if (e instanceof WebflowApiError) {
    if (e.retryable) throw e; // transient → job retries with backoff
    return { ok: false, error: e.kind === "auth" || e.kind === "forbidden" ? `webflow_${e.kind}` : e.kind === "not_found" ? "not_found" : "write_failed", detail: { message: e.message } };
  }
  throw e;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : v == null ? null : String(v);
}

function norm(v: string | null | undefined) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}
