// Wix connector over the official REST APIs (www.wixapis.com) with an API key + wix-site-id header.
//
// What Wix's public APIs allow (and therefore what this connector does):
//   - Wix Blog posts: read and edit through the Draft Posts API — post title tag / meta description
//     (seoData tags) and excerpt. Edits are saved as unpublished changes (action "UPDATE"); the live
//     post only changes when someone publishes it in the Wix dashboard. publish = false.
//   - Static pages built in the Wix editor: Wix offers no public REST API to edit a page's SEO title /
//     description, so those resources are read-only and every write returns `manual_required` with
//     step-by-step instructions for the editor (Page settings → SEO basics).
// Resource ids: "post:<draftPostId>" or "page:<path>". Version = draft post editedDate.
// Wix has no server-side If-Match on draft posts: the conflict check compares editedDate right
// before writing (small race window, documented in limitations).
import { safeRequest, type HttpMethod } from "@/lib/net/safe-request";
import { buildManualInstructions, simpleDiff } from "@/lib/connectors/manual";
import { connectorHelpers } from "@/lib/connectors/contentful";
import type {
  Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";

const { parseJson, headerOf, norm } = connectorHelpers;

export const WIX_API = "https://www.wixapis.com";
const ALLOWED_HOST = "www.wixapis.com";

export interface WixConfig {
  siteId: string;
  siteUrl: string;
  /** Blog post URL prefix on the public site; Wix's default is "/post/". */
  blogPrefix?: string;
  timeoutMs?: number;
}

export interface WixSecrets {
  apiKey: string;
}

const POST_FIELDS = ["title", "meta_description", "excerpt"] as const;

export const WIX_CAPABILITIES: ConnectorCapabilities = {
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
  resourceTypes: ["blog_post"],
  limitations: [
    "Only Wix Blog posts can be edited automatically (SEO title, meta description and excerpt). Changes are saved as unpublished edits; publish the post in your Wix dashboard to make them live.",
    "Static pages built in the Wix editor (home, about, services, etc.) cannot be edited through Wix's public APIs. For those pages you get copy-ready instructions to paste into Page settings → SEO basics.",
    "Wix stores, bookings, events and dynamic pages are not edited by this connector.",
    "Wix has no server-side edit lock for draft posts; we check the post's last-edited date right before saving, so an edit made in the same second could still be overwritten.",
    "Post body content, structured data (JSON-LD), URLs/slugs and deletion are never changed by this connector.",
    "Rollback writes the previous SEO title, description and excerpt back as unpublished edits.",
  ],
};

interface WixSeoTag {
  type: string;
  children?: string;
  props?: Record<string, string>;
  custom?: boolean;
  disabled?: boolean;
}

interface WixDraftPost {
  id: string;
  title?: string;
  excerpt?: string;
  seoSlug?: string;
  slug?: string;
  status?: string;
  editedDate?: string;
  hasUnpublishedChanges?: boolean;
  seoData?: { tags?: WixSeoTag[]; settings?: Record<string, unknown> };
}

export class WixError extends Error {
  constructor(public code: "auth" | "rate_limited" | "http", message: string, public status?: number) {
    super(message);
    this.name = "WixError";
  }
}

export class WixConnector implements Connector {
  id = "wix";
  #apiKey: string;
  private cfg: WixConfig;

  constructor(cfg: WixConfig, secrets: WixSecrets) {
    if (!secrets.apiKey) throw new Error("Wix API key is required");
    if (!/^[0-9a-f-]{20,64}$/i.test(cfg.siteId)) throw new Error("Invalid Wix site ID (it looks like a UUID)");
    this.cfg = { ...cfg, siteUrl: cfg.siteUrl.replace(/\/+$/, ""), blogPrefix: cfg.blogPrefix ?? "/post/" };
    this.#apiKey = secrets.apiKey;
  }

  toJSON() {
    return { id: this.id, siteId: this.cfg.siteId };
  }

  getCapabilities() {
    return WIX_CAPABILITIES;
  }

  private async call(path: string, init: { method?: HttpMethod; body?: unknown } = {}): Promise<{ status: number; data: unknown }> {
    const res = await safeRequest(`${WIX_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: this.#apiKey,
        "wix-site-id": this.cfg.siteId,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      timeoutMs: this.cfg.timeoutMs ?? 15_000,
      maxBytes: 5 * 1024 * 1024,
      allowedHosts: [ALLOWED_HOST],
    });
    const data = parseJson(res.body);
    if (res.status === 401 || res.status === 403) {
      throw new WixError("auth", "Wix rejected the API key. Check that the key is active, belongs to the account that owns this site, and has the Wix Blog and Site Properties permissions.", res.status);
    }
    if (res.status === 429) {
      const retry = headerOf(res.headers, "retry-after");
      throw new WixError("rate_limited", `Wix rate limit reached${retry ? `; retry in ${retry}s` : ""}.`, 429);
    }
    if (res.status >= 500) throw new WixError("http", `Wix API error (HTTP ${res.status}).`, res.status);
    return { status: res.status, data };
  }

  async testConnection() {
    try {
      const { status, data } = await this.call("/site-properties/v4/properties");
      if (status === 404) return { ok: false, error: "Site not found — check the Site ID." };
      if (status !== 200) return { ok: false, error: `Wix returned HTTP ${status}.` };
      const p = (data as { properties?: { siteDisplayName?: string; businessName?: string } }).properties;
      return { ok: true, identity: p?.siteDisplayName ?? p?.businessName ?? this.cfg.siteId };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  private postUrl(p: WixDraftPost): string {
    const slug = p.seoSlug ?? p.slug;
    if (!slug) return "";
    const prefix = this.cfg.blogPrefix!.replace(/^\/+|\/+$/g, "");
    return `${this.cfg.siteUrl}/${prefix ? `${prefix}/` : ""}${slug}`;
  }

  private toResource(p: WixDraftPost): ConnectorResource {
    const tags = p.seoData?.tags ?? [];
    const titleTag = tags.find((t) => t.type === "title" && !t.disabled)?.children ?? null;
    const descTag = tags.find((t) => t.type === "meta" && t.props?.name === "description" && !t.disabled)?.props?.content ?? null;
    return {
      id: `post:${p.id}`,
      type: "blog_post",
      url: this.postUrl(p),
      title: p.title,
      version: p.editedDate ?? undefined,
      fields: {
        // Effective SEO title: the custom title tag, else Wix falls back to the post title.
        title: titleTag ?? p.title ?? null,
        seo_title_tag: titleTag,
        meta_description: descTag,
        excerpt: p.excerpt ?? null,
        post_title: p.title ?? null,
        slug: p.seoSlug ?? p.slug ?? null,
        status: p.hasUnpublishedChanges ? "unpublished_changes" : (p.status ?? null),
      },
    };
  }

  private staticPage(path: string): ConnectorResource {
    return {
      id: `page:${path}`,
      type: "static_page",
      url: `${this.cfg.siteUrl}${path === "/" ? "/" : path}`,
      version: "static",
      fields: { editable: "false" },
    };
  }

  private parseId(resourceId: string): { kind: "post" | "page"; id: string } {
    const i = resourceId.indexOf(":");
    const kind = resourceId.slice(0, i);
    const id = resourceId.slice(i + 1);
    if (kind === "post" && /^[A-Za-z0-9-]{1,64}$/.test(id)) return { kind, id };
    if (kind === "page" && id.startsWith("/")) return { kind, id };
    throw new Error(`Invalid Wix resource id "${resourceId}"`);
  }

  private async getDraft(id: string): Promise<WixDraftPost | null> {
    const { status, data } = await this.call(`/blog/v3/draft-posts/${encodeURIComponent(id)}`);
    if (status === 404) return null;
    if (status !== 200) throw new WixError("http", `Wix GET draft post failed: HTTP ${status}`, status);
    return (data as { draftPost?: WixDraftPost }).draftPost ?? null;
  }

  async getResource(resourceId: string) {
    const { kind, id } = this.parseId(resourceId);
    if (kind === "page") return this.staticPage(id);
    const p = await this.getDraft(id);
    return p ? this.toResource(p) : null;
  }

  async listResources(cursor?: string) {
    const offset = Math.max(0, Number(cursor) || 0);
    const { status, data } = await this.call(`/blog/v3/draft-posts?paging.limit=50&paging.offset=${offset}`);
    if (status === 404) return { items: [] }; // Wix Blog not installed on this site
    const posts = status === 200 ? ((data as { draftPosts?: WixDraftPost[] }).draftPosts ?? []) : [];
    const items = posts.map((p) => this.toResource(p));
    return { items, nextCursor: items.length === 50 ? String(offset + 50) : undefined };
  }

  /** Blog post URLs (blogPrefix/<slug>) → post:<id>; any other URL on the site → page:<path> (manual). */
  async resolveResourceId(url: string): Promise<string | null> {
    let u: URL;
    let site: URL;
    try {
      u = new URL(url);
      site = new URL(this.cfg.siteUrl);
    } catch {
      return null;
    }
    if (u.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")) return null;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const prefix = "/" + this.cfg.blogPrefix!.replace(/^\/+|\/+$/g, "") + "/";
    if (path.startsWith(prefix) && path.length > prefix.length) {
      let slug: string;
      try {
        slug = decodeURIComponent(path.slice(prefix.length));
      } catch {
        return null;
      }
      const { status, data } = await this.call(`/blog/v3/posts/slugs/${encodeURIComponent(slug)}`);
      const id = status === 200 ? (data as { post?: { id?: string } }).post?.id : undefined;
      if (id) return `post:${id}`; // a published post and its draft share the same id
      return null;
    }
    return `page:${path}`;
  }

  async createDraft(): Promise<PatchResult> {
    return { ok: false, error: "unsupported", detail: { reason: "Creating new Wix posts is not supported by this connector." } };
  }

  async proposePatch(_resourceId: string, change: ProposedChange) {
    return { preview: change.after, diff: simpleDiff(change.before, change.after) };
  }

  private manual(resourceId: string, change: ProposedChange): PatchResult {
    const path = resourceId.startsWith("page:") ? resourceId.slice(5) : "";
    const instructions = [
      buildManualInstructions({ type: `update_${change.field}`, target: { resourceType: "static_page", url: path ? `${this.cfg.siteUrl}${path}` : undefined }, proposedChange: change }),
      "Where in Wix: open the Wix Editor → Pages & Menu → hover the page → ⋯ → SEO basics. Paste the value into the matching box (Title tag or Meta description), then Publish the site.",
    ].join("\n\n");
    return { ok: false, error: "manual_required", detail: { instructions } };
  }

  /** Draft-post body for a field update, preserving every other SEO tag. */
  private postUpdate(p: WixDraftPost, field: string, value: string | null): Partial<WixDraftPost> | null {
    const tags = [...(p.seoData?.tags ?? [])];
    const setTag = (match: (t: WixSeoTag) => boolean, make: () => WixSeoTag) => {
      const i = tags.findIndex(match);
      if (value === null) {
        if (i >= 0) tags.splice(i, 1);
      } else if (i >= 0) {
        tags[i] = { ...tags[i], ...make(), custom: true, disabled: false };
      } else {
        tags.push({ ...make(), custom: true, disabled: false });
      }
      return { seoData: { ...(p.seoData ?? {}), tags } };
    };
    switch (field) {
      case "title":
      case "seo_title_tag":
        return setTag((t) => t.type === "title", () => ({ type: "title", children: value ?? "" }));
      case "meta_description":
        return setTag((t) => t.type === "meta" && t.props?.name === "description", () => ({ type: "meta", props: { name: "description", content: value ?? "" } }));
      case "excerpt":
        return { excerpt: value ?? "" };
      default:
        return null;
    }
  }

  private async saveDraft(id: string, update: Partial<WixDraftPost>): Promise<PatchResult> {
    const { status, data } = await this.call(`/blog/v3/draft-posts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      // "UPDATE" saves unpublished changes; the live post is untouched until published in Wix.
      body: { draftPost: { id, ...update }, action: "UPDATE" },
    });
    if (status === 409) return { ok: false, error: "conflict" };
    if (status !== 200) return { ok: false, error: `write_failed_http_${status}` };
    const saved = (data as { draftPost?: WixDraftPost }).draftPost;
    return { ok: true, newVersion: saved?.editedDate, detail: { published: false, status: "unpublished_changes" } };
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    const { kind, id } = this.parseId(resourceId);
    if (kind === "page") return this.manual(resourceId, change);
    if (!POST_FIELDS.includes(change.field as (typeof POST_FIELDS)[number])) {
      return { ok: false, error: "unsupported_field", detail: { field: change.field } };
    }
    const p = await this.getDraft(id);
    if (!p) return { ok: false, error: "not_found" };
    const current = this.toResource(p);
    if (norm(current.fields[change.field]) === norm(change.after) && (change.field !== "title" || current.fields.seo_title_tag !== null)) {
      return { ok: true, newVersion: current.version, detail: { alreadyApplied: true, idempotencyKey } };
    }
    if (expectedVersion && current.version !== expectedVersion) {
      return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: current.version } };
    }
    const r = await this.saveDraft(id, this.postUpdate(p, change.field, change.after)!);
    return r.ok ? { ...r, detail: { ...r.detail, idempotencyKey } } : r;
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const r = await this.getResource(resourceId);
    if (!r) return { status: "failed" as const, detail: "Post no longer exists" };
    if (r.type === "static_page") return { status: "warning" as const, detail: "Static Wix pages are changed manually; re-crawl to verify." };
    if (norm(r.fields[change.field]) !== norm(change.after)) {
      return { status: "failed" as const, detail: `${change.field} on the post does not match the approved draft` };
    }
    return { status: "warning" as const, detail: "Saved to the Wix blog post as unpublished changes. Publish the post in your Wix dashboard to make it live." };
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    const { kind, id } = this.parseId(resourceId);
    if (kind === "page") return { ok: true, detail: { nothingToRestore: true, reason: "static pages are never written" } };
    const live = await this.getDraft(id);
    if (!live) return { ok: false, error: "not_found" };
    let p: WixDraftPost = live;
    const restored: string[] = [];
    let update: Partial<WixDraftPost> = {};
    for (const field of ["seo_title_tag", "meta_description", "excerpt"] as const) {
      if (!(field in beforeState.fields)) continue;
      const before = beforeState.fields[field];
      const now = this.toResource(p).fields[field];
      if (norm(before) === norm(now) && (before === null) === (now === null)) continue;
      const u: Partial<WixDraftPost> = this.postUpdate(p, field, before)!;
      update = { ...update, ...u };
      p = { ...p, ...u };
      restored.push(field);
    }
    if (!restored.length) return { ok: true, newVersion: p.editedDate, detail: { nothingToRestore: true } };
    const r = await this.saveDraft(id, update);
    return r.ok ? { ...r, detail: { ...r.detail, restored } } : { ...r, error: `rollback_${r.error}` };
  }

  async disconnect() {
    // The customer deletes the API key in the Wix API Keys Manager; we only drop our stored copy.
  }
}
