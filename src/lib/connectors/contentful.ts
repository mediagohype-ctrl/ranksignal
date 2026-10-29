// Contentful connector over the Content Management API (api.contentful.com).
//
// Resource id = Contentful entry id. Version = entry sys.version (string).
// URL → entry: the longest matching `urlMap[].urlPrefix` gives the content type + slug field; the
// remainder of the path is the slug (`fields.<slugField>=<slug>` query).
//
// Draft behaviour (chosen deliberately): Contentful has no separate "draft copy" of an entry — any
// CMA update creates a new, UNPUBLISHED version of the entry. The live (Delivery API) content keeps
// serving the last published version until someone publishes. This connector NEVER publishes
// (capabilities.publish = false): the customer reviews and publishes the entry in Contentful.
// Every write sends X-Contentful-Version, so Contentful itself rejects the write (HTTP 409) when the
// entry changed after we captured the before-state.
import { safeRequest, type HttpMethod } from "@/lib/net/safe-request";
import { simpleDiff } from "@/lib/connectors/manual";
import type {
  Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";

export const CONTENTFUL_API = "https://api.contentful.com";
const ALLOWED_HOST = "api.contentful.com";

export interface ContentfulUrlMapEntry {
  urlPrefix: string;
  contentType: string;
  slugField: string;
}

export interface ContentfulFieldMap {
  title: string;
  description: string;
  body?: string;
  faq?: string;
}

export interface ContentfulConfig {
  spaceId: string;
  environmentId: string;
  siteUrl: string;
  locale: string;
  urlMap: ContentfulUrlMapEntry[];
  fieldMap: ContentfulFieldMap;
  timeoutMs?: number;
}

export interface ContentfulSecrets {
  managementToken: string;
}

/** Our generic field name → fieldMap key. */
const FIELD_KEYS: Record<string, keyof ContentfulFieldMap> = {
  title: "title",
  meta_description: "description",
  content: "body",
  faq: "faq",
};
const WRITABLE_FIELDS = Object.keys(FIELD_KEYS);

export const CONTENTFUL_CAPABILITIES: ConnectorCapabilities = {
  readPages: true,
  createDraft: true,
  updateContent: true,
  updateMetadata: true,
  updateSchema: false,
  preview: true,
  publish: false,
  revisionHistory: false,
  rollback: true,
  delete: false,
  resourceTypes: ["entry"],
  limitations: [
    "Changes are saved as a new unpublished version of the entry. Nothing goes live until someone presses Publish on the entry in Contentful; this connector never publishes.",
    "Only text fields (Short text / Long text / Markdown) can be edited. Rich Text, references and JSON fields are read-only here and fall back to manual instructions.",
    "Only the configured locale is edited (default en-US). Other locales are left untouched.",
    "Pages are found through the URL map (URL prefix → content type + slug field). Pages that are not Contentful entries, such as hard-coded templates, need manual changes.",
    "Rollback writes the previous field values back as another unpublished version. If the entry was already published with our change, publish again after rolling back.",
    "Structured data (JSON-LD), slugs and deletion are never changed by this connector.",
  ],
};

const MGMT_JSON = "application/vnd.contentful.management.v1+json";

interface CfEntry {
  sys: {
    id: string;
    version: number;
    publishedVersion?: number;
    contentType?: { sys?: { id?: string } };
    updatedAt?: string;
  };
  fields: Record<string, Record<string, unknown> | undefined>;
}

export class ContentfulError extends Error {
  constructor(public code: "auth" | "rate_limited" | "not_found" | "conflict" | "http", message: string, public status?: number) {
    super(message);
    this.name = "ContentfulError";
  }
}

export class ContentfulConnector implements Connector {
  id = "contentful";
  // ES private field: never serialised by JSON.stringify and not reachable from outside.
  #token: string;
  private cfg: ContentfulConfig;

  constructor(cfg: ContentfulConfig, secrets: ContentfulSecrets) {
    if (!secrets.managementToken) throw new Error("Contentful management token is required");
    this.cfg = { ...cfg, siteUrl: cfg.siteUrl.replace(/\/+$/, "") };
    this.#token = secrets.managementToken;
  }

  toJSON() {
    return { id: this.id, spaceId: this.cfg.spaceId, environmentId: this.cfg.environmentId };
  }

  getCapabilities(): ConnectorCapabilities {
    const caps = { ...CONTENTFUL_CAPABILITIES, limitations: [...CONTENTFUL_CAPABILITIES.limitations] };
    if (!this.cfg.fieldMap.body) {
      caps.updateContent = false;
      caps.limitations.push("No body field is mapped, so page content cannot be edited.");
    }
    return caps;
  }

  private envPath(path = "") {
    return `/spaces/${encodeURIComponent(this.cfg.spaceId)}/environments/${encodeURIComponent(this.cfg.environmentId)}${path}`;
  }

  private async call(path: string, init: { method?: HttpMethod; body?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; data: unknown }> {
    const res = await safeRequest(`${CONTENTFUL_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": MGMT_JSON } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      timeoutMs: this.cfg.timeoutMs ?? 15_000,
      maxBytes: 5 * 1024 * 1024,
      allowedHosts: [ALLOWED_HOST],
    });
    const data = parseJson(res.body);
    if (res.status === 401 || res.status === 403) {
      throw new ContentfulError("auth", "Contentful rejected the management token (check that it is valid and that its user can edit this space/environment).", res.status);
    }
    if (res.status === 429) {
      const reset = headerOf(res.headers, "x-contentful-ratelimit-reset");
      throw new ContentfulError("rate_limited", `Contentful rate limit reached${reset ? `; retry in ${reset}s` : ""}.`, 429);
    }
    if (res.status >= 500) throw new ContentfulError("http", `Contentful API error (HTTP ${res.status}).`, res.status);
    return { status: res.status, data };
  }

  async testConnection() {
    try {
      const { status, data } = await this.call(`/spaces/${encodeURIComponent(this.cfg.spaceId)}`);
      if (status === 404) return { ok: false, error: "Space not found — check the Space ID." };
      if (status !== 200) return { ok: false, error: `Contentful returned HTTP ${status}.` };
      const env = await this.call(this.envPath());
      if (env.status === 404) return { ok: false, error: `Environment "${this.cfg.environmentId}" not found in this space.` };
      const name = (data as { name?: string }).name ?? this.cfg.spaceId;
      return { ok: true, identity: `${name} (${this.cfg.environmentId})` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  private fieldValue(entry: CfEntry, fieldId: string | undefined): unknown {
    if (!fieldId) return undefined;
    return entry.fields?.[fieldId]?.[this.cfg.locale];
  }

  private mapFor(contentType: string | undefined) {
    return this.cfg.urlMap.find((m) => m.contentType === contentType);
  }

  private toResource(entry: CfEntry): ConnectorResource {
    const ct = entry.sys.contentType?.sys?.id;
    const map = this.mapFor(ct);
    const fields: Record<string, string | null> = {};
    for (const f of WRITABLE_FIELDS) {
      const v = this.fieldValue(entry, this.cfg.fieldMap[FIELD_KEYS[f]]);
      fields[f] = typeof v === "string" ? v : v == null ? null : JSON.stringify(v);
      fields[`${f}_writable`] = this.cfg.fieldMap[FIELD_KEYS[f]] && (v == null || typeof v === "string") ? "true" : "false";
    }
    const slug = map ? this.fieldValue(entry, map.slugField) : undefined;
    fields.slug = typeof slug === "string" ? slug : null;
    fields.content_type = ct ?? null;
    fields.status = entry.sys.publishedVersion == null ? "draft" : entry.sys.version > entry.sys.publishedVersion + 1 ? "changed" : "published";
    return {
      id: entry.sys.id,
      type: "entry",
      url: map && typeof slug === "string" ? joinUrl(this.cfg.siteUrl, map.urlPrefix, slug) : "",
      title: fields.title ?? undefined,
      version: String(entry.sys.version),
      fields,
    };
  }

  async listResources(cursor?: string) {
    const [idxRaw, skipRaw] = (cursor ?? "0:0").split(":");
    const idx = Math.max(0, Number(idxRaw) || 0);
    const skip = Math.max(0, Number(skipRaw) || 0);
    const map = this.cfg.urlMap[idx];
    if (!map) return { items: [] };
    const q = new URLSearchParams({ content_type: map.contentType, limit: "50", skip: String(skip), order: "sys.id" });
    const { status, data } = await this.call(`${this.envPath("/entries")}?${q}`);
    const items = status === 200 ? ((data as { items?: CfEntry[] }).items ?? []).map((e) => this.toResource(e)) : [];
    const total = status === 200 ? Number((data as { total?: number }).total ?? 0) : 0;
    let nextCursor: string | undefined;
    if (skip + items.length < total && items.length) nextCursor = `${idx}:${skip + items.length}`;
    else if (idx + 1 < this.cfg.urlMap.length) nextCursor = `${idx + 1}:0`;
    return { items, nextCursor };
  }

  private async getEntry(entryId: string): Promise<CfEntry | null> {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(entryId)) throw new Error(`Invalid Contentful entry id "${entryId}"`);
    const { status, data } = await this.call(this.envPath(`/entries/${entryId}`));
    if (status === 404) return null;
    if (status !== 200) throw new ContentfulError("http", `Contentful GET entry failed: HTTP ${status}`, status);
    return data as CfEntry;
  }

  async getResource(entryId: string) {
    const e = await this.getEntry(entryId);
    return e ? this.toResource(e) : null;
  }

  /** Map a public URL to an entry id through the URL map (longest prefix wins). */
  async resolveResourceId(url: string): Promise<string | null> {
    const match = matchUrlMap(this.cfg.siteUrl, this.cfg.urlMap, url);
    if (!match) return null;
    const q = new URLSearchParams({ content_type: match.entry.contentType, [`fields.${match.entry.slugField}`]: match.slug, locale: this.cfg.locale, limit: "1" });
    const { status, data } = await this.call(`${this.envPath("/entries")}?${q}`);
    if (status !== 200) return null;
    return (data as { items?: CfEntry[] }).items?.[0]?.sys.id ?? null;
  }

  async createDraft(resourceType: string, content: Record<string, string>): Promise<PatchResult> {
    if (!this.cfg.urlMap.some((m) => m.contentType === resourceType)) {
      return { ok: false, error: "unsupported_content_type", detail: { resourceType } };
    }
    const fields: Record<string, Record<string, string>> = {};
    for (const [k, v] of Object.entries(content)) {
      const fieldId = FIELD_KEYS[k] ? this.cfg.fieldMap[FIELD_KEYS[k]] : undefined;
      if (fieldId) fields[fieldId] = { [this.cfg.locale]: v };
    }
    const { status, data } = await this.call(this.envPath("/entries"), {
      method: "POST",
      headers: { "X-Contentful-Content-Type": resourceType },
      body: { fields },
    });
    if (status !== 201 && status !== 200) return { ok: false, error: `create_failed_http_${status}` };
    const e = data as CfEntry;
    return { ok: true, newVersion: String(e.sys.version), detail: { resourceId: e.sys.id, status: "draft" } };
  }

  async proposePatch(_resourceId: string, change: ProposedChange) {
    return { preview: change.after, diff: simpleDiff(change.before, change.after) };
  }

  /** PUT the entry with updated fields; Contentful enforces X-Contentful-Version. */
  private async putFields(entry: CfEntry, updates: Record<string, string | null>): Promise<PatchResult> {
    const fields: CfEntry["fields"] = JSON.parse(JSON.stringify(entry.fields ?? {}));
    for (const [fieldId, value] of Object.entries(updates)) {
      const localized = { ...(fields[fieldId] ?? {}) };
      if (value === null) delete localized[this.cfg.locale];
      else localized[this.cfg.locale] = value;
      fields[fieldId] = localized;
    }
    const { status, data } = await this.call(this.envPath(`/entries/${entry.sys.id}`), {
      method: "PUT",
      headers: { "X-Contentful-Version": String(entry.sys.version) },
      body: { fields },
    });
    if (status === 409) return { ok: false, error: "conflict", detail: { expectedVersion: String(entry.sys.version) } };
    if (status === 422) return { ok: false, error: "validation_rejected", detail: { message: errorMessage(data) } };
    if (status !== 200) return { ok: false, error: `write_failed_http_${status}` };
    const saved = data as CfEntry;
    return { ok: true, newVersion: String(saved.sys.version), detail: { published: false, status: "unpublished_changes" } };
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    const key = FIELD_KEYS[change.field];
    const fieldId = key ? this.cfg.fieldMap[key] : undefined;
    if (!fieldId) return { ok: false, error: "unsupported_field", detail: { field: change.field } };
    const entry = await this.getEntry(resourceId);
    if (!entry) return { ok: false, error: "not_found" };
    const current = this.fieldValue(entry, fieldId);
    if (current != null && typeof current !== "string") {
      return { ok: false, error: "manual_required", detail: { instructions: `The Contentful field "${fieldId}" is not a plain text field (for example Rich Text). Paste this value into it manually and publish the entry:\n\n${change.after}` } };
    }
    if (norm(current as string | undefined) === norm(change.after)) {
      return { ok: true, newVersion: String(entry.sys.version), detail: { alreadyApplied: true, idempotencyKey } };
    }
    if (expectedVersion && String(entry.sys.version) !== expectedVersion) {
      return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: String(entry.sys.version) } };
    }
    const r = await this.putFields(entry, { [fieldId]: change.after });
    return r.ok ? { ...r, detail: { ...r.detail, idempotencyKey } } : r;
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const r = await this.getResource(resourceId);
    if (!r) return { status: "failed" as const, detail: "Entry no longer exists" };
    if (norm(r.fields[change.field]) !== norm(change.after)) {
      return { status: "failed" as const, detail: `${change.field} on the entry does not match the approved draft` };
    }
    return { status: "warning" as const, detail: "Saved to the Contentful entry as unpublished changes. Publish the entry in Contentful to make it live." };
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    const entry = await this.getEntry(resourceId);
    if (!entry) return { ok: false, error: "not_found" };
    const updates: Record<string, string | null> = {};
    for (const f of WRITABLE_FIELDS) {
      const fieldId = this.cfg.fieldMap[FIELD_KEYS[f]];
      if (!fieldId || !(f in beforeState.fields) || beforeState.fields[`${f}_writable`] === "false") continue;
      const now = this.fieldValue(entry, fieldId);
      if (now != null && typeof now !== "string") continue;
      const before = beforeState.fields[f];
      if (norm(before) === norm(now as string | undefined)) continue;
      updates[fieldId] = before;
    }
    if (!Object.keys(updates).length) return { ok: true, newVersion: String(entry.sys.version), detail: { nothingToRestore: true } };
    const r = await this.putFields(entry, updates);
    return r.ok ? { ...r, detail: { ...r.detail, restored: Object.keys(updates) } } : { ...r, error: r.error === "conflict" ? "conflict" : `rollback_${r.error}` };
  }

  async disconnect() {
    // The customer revokes the personal access token in Contentful; we only delete our stored copy.
  }
}

// ---------- helpers ----------

export function matchUrlMap<T extends { urlPrefix: string }>(siteUrl: string, urlMap: T[], url: string): { entry: T; slug: string } | null {
  let u: URL;
  let site: URL;
  try {
    u = new URL(url);
    site = new URL(siteUrl);
  } catch {
    return null;
  }
  if (u.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")) return null;
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const sorted = [...urlMap].sort((a, b) => b.urlPrefix.length - a.urlPrefix.length);
  for (const entry of sorted) {
    const prefix = entry.urlPrefix.replace(/^\/+|\/+$/g, "");
    const pre = prefix ? `/${prefix}/` : "/";
    if (!(path + "/").startsWith(pre)) continue;
    let slug: string;
    try {
      slug = decodeURIComponent(path.slice(pre.length - 1).replace(/^\/+/, ""));
    } catch {
      continue;
    }
    if (!slug) continue; // the prefix root / homepage can't be resolved by slug
    return { entry, slug };
  }
  return null;
}

function joinUrl(site: string, prefix: string, slug: string) {
  const p = prefix.replace(/^\/+|\/+$/g, "");
  return `${site}/${p ? `${p}/` : ""}${slug.replace(/^\/+/, "")}`;
}

function parseJson(body: string | undefined): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function headerOf(h: unknown, name: string): string | null {
  if (!h) return null;
  if (typeof (h as Headers).get === "function") return (h as Headers).get(name);
  const rec = h as Record<string, string | string[] | undefined>;
  const v = rec[name] ?? rec[name.toLowerCase()];
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

function errorMessage(data: unknown): string {
  const d = data as { message?: string; details?: { errors?: { details?: string }[] } } | null;
  return d?.details?.errors?.[0]?.details ?? d?.message ?? "Contentful rejected the value";
}

function norm(v: string | null | undefined) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

/** Shared with the Sanity and Wix connectors. */
export const connectorHelpers = { parseJson, headerOf, norm };
