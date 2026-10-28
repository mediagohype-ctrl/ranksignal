// WordPress connector (blueprint §3.3) over the WP REST API with Application Passwords (basic auth).
// Resource ids are "<collection>:<numeric id>" where collection is "pages" | "posts".
// Version = modified_gmt; applyPatch refuses to write when the live version differs from expectedVersion.
// Every outbound request first passes assertPublicUrl (SSRF guard) and refuses redirects.
import { assertPublicUrl } from "@/lib/crawler/safe-fetch";
import type {
  Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";
import { simpleDiff } from "@/lib/connectors/manual";

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  /** Test seams. */
  fetchImpl?: typeof fetch;
  assertUrl?: (url: string) => Promise<unknown>;
  timeoutMs?: number;
}

const COLLECTIONS = ["pages", "posts"] as const;
type Collection = (typeof COLLECTIONS)[number];
/** Yoast's post meta key; writable over REST only if the site registers it with show_in_rest. */
export const YOAST_META_KEY = "_yoast_wpseo_metadesc";
const WRITABLE_FIELDS = ["title", "excerpt", "content", "meta_description"] as const;

export const WORDPRESS_CAPABILITIES: ConnectorCapabilities = {
  readPages: true,
  createDraft: true,
  updateContent: true,
  updateMetadata: true,
  updateSchema: false,
  preview: true,
  publish: false, // drafts only; publishing stays a human step in WP admin
  revisionHistory: true,
  rollback: true,
  delete: false,
  resourceTypes: ["page", "post"],
  limitations: [
    `Meta description is read from Yoast's yoast_head_json; writing it requires the "${YOAST_META_KEY}" post meta to be registered with show_in_rest (not enabled by default). Otherwise the change fails safely and a manual export is produced.`,
    "JSON-LD/schema edits are not supported (WordPress strips <script> for most roles); use manual export.",
    "Slug/URL changes, deletion and publishing are never performed by this connector.",
    "Concurrency control uses modified_gmt; edits made in WP after the before-state capture cause a conflict.",
  ],
};

export class WordPressConnector implements Connector {
  id = "wordpress";
  private base: string;
  private auth: string;
  private fetchImpl: typeof fetch;
  private assertUrl: (url: string) => Promise<unknown>;
  private timeoutMs: number;

  constructor(private cfg: WordPressConfig) {
    const site = cfg.siteUrl.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(site)) throw new Error("siteUrl must be an http(s) URL");
    if (process.env.NODE_ENV === "production" && !site.toLowerCase().startsWith("https://")) {
      throw new Error("siteUrl must use https in production (credentials are sent with every request)");
    }
    this.base = `${site}/wp-json/wp/v2`;
    this.auth = "Basic " + Buffer.from(`${cfg.username}:${cfg.applicationPassword}`).toString("base64");
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.assertUrl = cfg.assertUrl ?? ((u: string) => assertPublicUrl(u));
    this.timeoutMs = cfg.timeoutMs ?? 15_000;
  }

  getCapabilities() {
    return WORDPRESS_CAPABILITIES;
  }

  private async request(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: unknown }> {
    const url = `${this.base}${path}`;
    await this.assertUrl(url);
    const res = await this.fetchImpl(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: this.auth,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  }

  private parseId(resourceId: string): { col: Collection; id: number } {
    const [col, id] = resourceId.split(":");
    const n = Number(id);
    if (!COLLECTIONS.includes(col as Collection) || !Number.isInteger(n) || n <= 0) {
      throw new Error(`Invalid WordPress resource id "${resourceId}"`);
    }
    return { col: col as Collection, id: n };
  }

  private toResource(col: Collection, p: WpPost): ConnectorResource {
    const meta = (p.meta ?? {}) as Record<string, unknown>;
    const metaDesc = typeof meta[YOAST_META_KEY] === "string" && meta[YOAST_META_KEY]
      ? (meta[YOAST_META_KEY] as string)
      : p.yoast_head_json?.description ?? null;
    return {
      id: `${col}:${p.id}`,
      type: col === "pages" ? "page" : "post",
      url: p.link ?? "",
      title: raw(p.title) ?? undefined,
      version: p.modified_gmt,
      fields: {
        title: raw(p.title),
        excerpt: raw(p.excerpt),
        content: raw(p.content),
        slug: p.slug ?? null,
        status: p.status ?? null,
        meta_description: metaDesc,
        meta_description_writable: YOAST_META_KEY in meta ? "true" : "false",
      },
    };
  }

  async testConnection() {
    try {
      const { status, data } = await this.request("/users/me?context=edit");
      if (status === 401 || status === 403) return { ok: false, error: "Authentication failed — check username and application password." };
      if (status !== 200) return { ok: false, error: `WordPress REST API returned HTTP ${status}` };
      const u = data as { name?: string; slug?: string; capabilities?: Record<string, boolean> };
      if (u.capabilities && !u.capabilities.edit_pages && !u.capabilities.edit_posts) {
        return { ok: false, error: "This WordPress user cannot edit pages or posts." };
      }
      return { ok: true, identity: u.name ?? u.slug ?? "wordpress user" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  async listResources(cursor?: string) {
    const [colRaw, pageRaw] = (cursor ?? "pages:1").split(":");
    const col = (COLLECTIONS.includes(colRaw as Collection) ? colRaw : "pages") as Collection;
    const page = Math.max(1, Number(pageRaw) || 1);
    const { status, data } = await this.request(`/${col}?context=edit&per_page=50&page=${page}`);
    const items = status === 200 && Array.isArray(data) ? (data as WpPost[]).map((p) => this.toResource(col, p)) : [];
    let nextCursor: string | undefined;
    if (items.length === 50) nextCursor = `${col}:${page + 1}`;
    else if (col === "pages") nextCursor = "posts:1";
    return { items, nextCursor };
  }

  async getResource(resourceId: string) {
    const { col, id } = this.parseId(resourceId);
    const { status, data } = await this.request(`/${col}/${id}?context=edit`);
    if (status === 404) return null;
    if (status !== 200) throw new Error(`WordPress GET ${col}/${id} failed: HTTP ${status}`);
    return this.toResource(col, data as WpPost);
  }

  /** Resolve a public URL to "<collection>:<id>" by slug lookup (pages first, then posts). */
  async resolveResourceId(url: string): Promise<string | null> {
    let slug = "";
    try {
      slug = new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    } catch {
      return null;
    }
    if (!slug) return null; // homepage / front page cannot be resolved by slug
    for (const col of COLLECTIONS) {
      const { status, data } = await this.request(`/${col}?context=edit&slug=${encodeURIComponent(slug)}`);
      if (status === 200 && Array.isArray(data) && data.length) {
        const exact = (data as WpPost[]).find((p) => (p.link ?? "").replace(/\/+$/, "") === url.replace(/\/+$/, "")) ?? (data as WpPost[])[0];
        return `${col}:${exact.id}`;
      }
    }
    return null;
  }

  async createDraft(resourceType: string, content: Record<string, string>): Promise<PatchResult> {
    const col: Collection = resourceType === "page" ? "pages" : "posts";
    const { status, data } = await this.request(`/${col}`, {
      method: "POST",
      body: { title: content.title ?? "", content: content.content ?? "", excerpt: content.excerpt ?? "", status: "draft" },
    });
    if (status !== 201 && status !== 200) return { ok: false, error: `create_failed_http_${status}` };
    const p = data as WpPost;
    return { ok: true, newVersion: p.modified_gmt, detail: { resourceId: `${col}:${p.id}`, status: "draft" } };
  }

  async proposePatch(_resourceId: string, change: ProposedChange) {
    return { preview: change.after, diff: simpleDiff(change.before, change.after) };
  }

  private bodyFor(field: string, value: string | null): Record<string, unknown> | null {
    switch (field) {
      case "title":
      case "excerpt":
      case "content":
        return { [field]: value ?? "" };
      case "meta_description":
        return { meta: { [YOAST_META_KEY]: value ?? "" } };
      default:
        return null; // slug/status/schema etc. are never written
    }
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    const body = this.bodyFor(change.field, change.after);
    if (!body) return { ok: false, error: "unsupported_field", detail: { field: change.field } };
    const current = await this.getResource(resourceId);
    if (!current) return { ok: false, error: "not_found" };
    if (norm(current.fields[change.field]) === norm(change.after)) {
      // Already in the desired state (e.g. a retried request that landed) — do not write again.
      return { ok: true, newVersion: current.version, detail: { alreadyApplied: true, idempotencyKey } };
    }
    if (expectedVersion && current.version !== expectedVersion) {
      return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: current.version } };
    }
    if (change.field === "meta_description" && current.fields.meta_description_writable !== "true") {
      return { ok: false, error: "meta_not_registered", detail: { hint: WORDPRESS_CAPABILITIES.limitations[0] } };
    }
    const { col, id } = this.parseId(resourceId);
    const { status, data } = await this.request(`/${col}/${id}`, { method: "POST", body });
    if (status === 409 || status === 412) return { ok: false, error: "conflict" };
    if (status >= 500) throw new Error(`WordPress write failed: HTTP ${status}`); // transient → retried
    if (status !== 200) return { ok: false, error: `write_failed_http_${status}` };
    const p = data as WpPost;
    return { ok: true, newVersion: p.modified_gmt, detail: { idempotencyKey } };
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const r = await this.getResource(resourceId);
    if (!r) return { status: "failed" as const, detail: "Resource no longer exists" };
    const live = r.fields[change.field];
    if (norm(live) === norm(change.after)) return { status: "passed" as const, detail: `${change.field} matches the approved draft` };
    if (change.field === "meta_description" && norm(live).includes(norm(change.after).slice(0, 40))) {
      return { status: "warning" as const, detail: "Meta description stored, but rendered value differs (SEO plugin template or cache)." };
    }
    return { status: "failed" as const, detail: `${change.field} on the live resource does not match the approved draft` };
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    const current = await this.getResource(resourceId);
    if (!current) return { ok: false, error: "not_found" };
    const body: Record<string, unknown> = {};
    for (const f of WRITABLE_FIELDS) {
      const before = beforeState.fields[f];
      if (before === undefined || norm(before) === norm(current.fields[f])) continue;
      if (f === "meta_description" && current.fields.meta_description_writable !== "true") continue;
      Object.assign(body, f === "meta_description" ? { meta: { [YOAST_META_KEY]: before ?? "" } } : { [f]: before ?? "" });
    }
    if (!Object.keys(body).length) return { ok: true, newVersion: current.version, detail: { nothingToRestore: true } };
    const { col, id } = this.parseId(resourceId);
    const { status, data } = await this.request(`/${col}/${id}`, { method: "POST", body });
    if (status !== 200) return { ok: false, error: `rollback_failed_http_${status}` };
    return { ok: true, newVersion: (data as WpPost).modified_gmt, detail: { restored: Object.keys(body) } };
  }

  async disconnect() {
    // Application passwords are revoked by the user in WP admin; we only wipe our stored copy.
  }
}

interface WpPost {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  modified_gmt?: string;
  title?: { raw?: string; rendered?: string } | string;
  excerpt?: { raw?: string; rendered?: string } | string;
  content?: { raw?: string; rendered?: string } | string;
  meta?: unknown;
  yoast_head_json?: { description?: string };
}

function raw(v: WpPost["title"]): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return v.raw ?? v.rendered ?? null;
}

function norm(v: string | null | undefined) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}
