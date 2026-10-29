// Sanity connector over the HTTP API (https://<projectId>.api.sanity.io/v<apiVersion>/data/...).
//
// Resource id = the PUBLISHED document id (never the "drafts." id). Version = the _rev of the draft
// document when one exists, otherwise the _rev of the published document.
//
// Draft behaviour: every write goes to Sanity's native draft document `drafts.<id>`. The published
// document — what the live site reads — is never touched; the customer reviews and publishes in
// Sanity Studio (capabilities.publish = false). Conflict checks use Sanity's own `ifRevisionID` on
// patches, and `create` (fails if the draft appeared meanwhile) when the first draft is made.
// Rollback restores the previous field values, read from the History API at the captured revision
// when available (falls back to the stored before-state).
import { safeRequest, type HttpMethod } from "@/lib/net/safe-request";
import { simpleDiff } from "@/lib/connectors/manual";
import { connectorHelpers, matchUrlMap } from "@/lib/connectors/contentful";
import type {
  Connector, ConnectorCapabilities, ConnectorResource, PatchResult, ProposedChange,
} from "@/lib/types";

const { parseJson, headerOf, norm } = connectorHelpers;

export interface SanityUrlMapEntry {
  urlPrefix: string;
  type: string;
  slugField: string;
}

export interface SanityFieldMap {
  title: string;
  description: string;
  body?: string;
  faq?: string;
}

export interface SanityConfig {
  projectId: string;
  dataset: string;
  /** API version date, e.g. "2025-02-19". */
  apiVersion: string;
  siteUrl: string;
  urlMap: SanityUrlMapEntry[];
  fieldMap: SanityFieldMap;
  timeoutMs?: number;
}

export interface SanitySecrets {
  token: string;
}

const FIELD_KEYS: Record<string, keyof SanityFieldMap> = {
  title: "title",
  meta_description: "description",
  content: "body",
  faq: "faq",
};
const WRITABLE_FIELDS = Object.keys(FIELD_KEYS);
/** Field paths and type names are interpolated into GROQ/patch paths — allow identifiers only. */
export const SANITY_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const ALLOWED_HOST = "*.api.sanity.io";
const SYSTEM_KEYS = ["_rev", "_createdAt", "_updatedAt"];

export const SANITY_CAPABILITIES: ConnectorCapabilities = {
  readPages: true,
  createDraft: true,
  updateContent: true,
  updateMetadata: true,
  updateSchema: false,
  preview: true,
  publish: false,
  revisionHistory: true,
  rollback: true,
  delete: false,
  resourceTypes: ["document"],
  limitations: [
    "Changes are written to the document's draft (drafts.<id>). The live site keeps showing the published version until someone presses Publish in Sanity Studio; this connector never publishes.",
    "Only plain string/text fields can be edited. Portable Text (block content), references and objects are read-only here and fall back to manual instructions.",
    "Pages are found through the URL map (URL prefix → document type + slug field). Pages not backed by a Sanity document need manual changes.",
    "Rollback restores the previous values into the draft. The History API used to read old revisions is limited by your Sanity plan's history retention; the saved before-state is used when it is unavailable.",
    "Structured data (JSON-LD), slugs and deletion are never changed by this connector.",
  ],
};

type SanityDoc = Record<string, unknown> & { _id: string; _type: string; _rev: string; _updatedAt?: string };

export class SanityError extends Error {
  constructor(public code: "auth" | "rate_limited" | "http", message: string, public status?: number) {
    super(message);
    this.name = "SanityError";
  }
}

export class SanityConnector implements Connector {
  id = "sanity";
  #token: string;
  private cfg: SanityConfig;
  private base: string;

  constructor(cfg: SanityConfig, secrets: SanitySecrets) {
    if (!secrets.token) throw new Error("Sanity API token is required");
    if (!/^[a-z0-9-]{1,64}$/i.test(cfg.projectId)) throw new Error("Invalid Sanity project ID");
    if (!/^[a-z0-9_-]{1,64}$/i.test(cfg.dataset)) throw new Error("Invalid Sanity dataset name");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.apiVersion)) throw new Error("Sanity apiVersion must be a date like 2025-02-19");
    for (const m of cfg.urlMap) {
      if (!SANITY_PATH.test(m.type) || !SANITY_PATH.test(m.slugField)) throw new Error("Invalid Sanity type or slug field name");
    }
    for (const v of Object.values(cfg.fieldMap)) {
      if (v && !SANITY_PATH.test(v)) throw new Error(`Invalid Sanity field path "${v}"`);
    }
    this.cfg = { ...cfg, siteUrl: cfg.siteUrl.replace(/\/+$/, "") };
    this.#token = secrets.token;
    this.base = `https://${cfg.projectId}.api.sanity.io/v${cfg.apiVersion}`;
  }

  toJSON() {
    return { id: this.id, projectId: this.cfg.projectId, dataset: this.cfg.dataset };
  }

  getCapabilities(): ConnectorCapabilities {
    const caps = { ...SANITY_CAPABILITIES, limitations: [...SANITY_CAPABILITIES.limitations] };
    if (!this.cfg.fieldMap.body) {
      caps.updateContent = false;
      caps.limitations.push("No body field is mapped, so page content cannot be edited.");
    }
    return caps;
  }

  private async call(path: string, init: { method?: HttpMethod; body?: unknown } = {}): Promise<{ status: number; data: unknown }> {
    const res = await safeRequest(`${this.base}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.#token}`,
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
      throw new SanityError("auth", "Sanity rejected the API token (it needs Editor permissions on this project and dataset).", res.status);
    }
    if (res.status === 429) {
      const retry = headerOf(res.headers, "retry-after");
      throw new SanityError("rate_limited", `Sanity rate limit reached${retry ? `; retry in ${retry}s` : ""}.`, 429);
    }
    if (res.status >= 500) throw new SanityError("http", `Sanity API error (HTTP ${res.status}).`, res.status);
    return { status: res.status, data };
  }

  private async query<T>(groq: string, params: Record<string, unknown> = {}): Promise<T> {
    const q = new URLSearchParams({ query: groq, perspective: "raw" });
    for (const [k, v] of Object.entries(params)) q.set(`$${k}`, JSON.stringify(v));
    const { status, data } = await this.call(`/data/query/${this.cfg.dataset}?${q}`);
    if (status !== 200) throw new SanityError("http", `Sanity query failed: HTTP ${status} ${errorText(data)}`, status);
    return (data as { result: T }).result;
  }

  private async mutate(mutations: unknown[]): Promise<{ status: number; transactionId?: string; error?: string }> {
    const { status, data } = await this.call(`/data/mutate/${this.cfg.dataset}?returnIds=true&visibility=sync`, {
      method: "POST",
      body: { mutations },
    });
    const d = data as { transactionId?: string } | null;
    return { status, transactionId: d?.transactionId, error: status === 200 ? undefined : errorText(data) };
  }

  async testConnection() {
    try {
      const n = await this.query<number>("count(*)");
      return { ok: true, identity: `${this.cfg.projectId}/${this.cfg.dataset} (${Number(n) || 0} documents)` };
    } catch (e) {
      if (e instanceof SanityError && e.status === 404) return { ok: false, error: "Project or dataset not found — check the project ID and dataset name." };
      return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  /** Published + draft pair for a published id. */
  private async getPair(publishedId: string): Promise<{ published: SanityDoc | null; draft: SanityDoc | null }> {
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(publishedId) || publishedId.startsWith("drafts.")) {
      throw new Error(`Invalid Sanity document id "${publishedId}"`);
    }
    const docs = await this.query<SanityDoc[]>("*[_id in [$id, $draftId]]", { id: publishedId, draftId: `drafts.${publishedId}` });
    return {
      published: docs.find((d) => d._id === publishedId) ?? null,
      draft: docs.find((d) => d._id === `drafts.${publishedId}`) ?? null,
    };
  }

  private toResource(publishedId: string, doc: SanityDoc, hasPublished: boolean): ConnectorResource {
    const map = this.cfg.urlMap.find((m) => m.type === doc._type);
    const fields: Record<string, string | null> = {};
    for (const f of WRITABLE_FIELDS) {
      const path = this.cfg.fieldMap[FIELD_KEYS[f]];
      const v = path ? getPath(doc, path) : undefined;
      fields[f] = typeof v === "string" ? v : v == null ? null : JSON.stringify(v);
      fields[`${f}_writable`] = path && (v == null || typeof v === "string") ? "true" : "false";
    }
    const slugRaw = map ? getPath(doc, map.slugField) : undefined;
    const slug = typeof slugRaw === "string" ? slugRaw : (slugRaw as { current?: string } | undefined)?.current ?? null;
    fields.slug = slug;
    fields.document_type = doc._type;
    fields.revision_doc = doc._id;
    fields.status = doc._id.startsWith("drafts.") ? (hasPublished ? "published_with_draft" : "draft") : "published";
    return {
      id: publishedId,
      type: "document",
      url: map && slug ? `${this.cfg.siteUrl}/${map.urlPrefix.replace(/^\/+|\/+$/g, "")}${map.urlPrefix.replace(/^\/+|\/+$/g, "") ? "/" : ""}${slug}` : "",
      title: fields.title ?? undefined,
      version: doc._rev,
      fields,
    };
  }

  async getResource(publishedId: string) {
    const { published, draft } = await this.getPair(publishedId);
    const doc = draft ?? published;
    return doc ? this.toResource(publishedId, doc, Boolean(published)) : null;
  }

  async listResources(cursor?: string) {
    const offset = Math.max(0, Number(cursor) || 0);
    const types = this.cfg.urlMap.map((m) => m.type);
    const docs = await this.query<SanityDoc[]>(
      `*[_type in $types && !(_id in path("drafts.**"))] | order(_id asc) [${offset}...${offset + 50}]`,
      { types },
    );
    const items = docs.map((d) => this.toResource(d._id, d, true));
    return { items, nextCursor: items.length === 50 ? String(offset + 50) : undefined };
  }

  async resolveResourceId(url: string): Promise<string | null> {
    const match = matchUrlMap(this.cfg.siteUrl, this.cfg.urlMap, url);
    if (!match) return null;
    const f = match.entry.slugField;
    const ids = await this.query<string[]>(
      `*[_type == $type && (${f}.current == $slug || ${f} == $slug)]._id`,
      { type: match.entry.type, slug: match.slug },
    );
    const id = ids.find((i) => !i.startsWith("drafts.")) ?? ids[0];
    return id ? id.replace(/^drafts\./, "") : null;
  }

  async createDraft(resourceType: string, content: Record<string, string>): Promise<PatchResult> {
    if (!this.cfg.urlMap.some((m) => m.type === resourceType)) return { ok: false, error: "unsupported_document_type", detail: { resourceType } };
    const id = crypto.randomUUID();
    const doc: Record<string, unknown> = { _id: `drafts.${id}`, _type: resourceType };
    for (const [k, v] of Object.entries(content)) {
      const path = FIELD_KEYS[k] ? this.cfg.fieldMap[FIELD_KEYS[k]] : undefined;
      if (path) setPath(doc, path, v);
    }
    const r = await this.mutate([{ create: doc }]);
    if (r.status !== 200) return { ok: false, error: `create_failed_http_${r.status}` };
    return { ok: true, newVersion: r.transactionId, detail: { resourceId: id, status: "draft" } };
  }

  async proposePatch(_resourceId: string, change: ProposedChange) {
    return { preview: change.after, diff: simpleDiff(change.before, change.after) };
  }

  /**
   * Write `set`/`unset` to drafts.<id>. If no draft exists yet, it is created from the published
   * document in the same transaction (create fails if a draft appeared meanwhile → conflict).
   */
  private async writeDraft(publishedId: string, pair: { published: SanityDoc | null; draft: SanityDoc | null }, set: Record<string, string>, unset: string[]): Promise<PatchResult> {
    const draftId = `drafts.${publishedId}`;
    const patch: Record<string, unknown> = { id: draftId };
    if (Object.keys(set).length) patch.set = set;
    if (unset.length) patch.unset = unset;
    const mutations: unknown[] = [];
    if (pair.draft) {
      patch.ifRevisionID = pair.draft._rev;
    } else if (pair.published) {
      const copy: Record<string, unknown> = { ...pair.published, _id: draftId };
      for (const k of SYSTEM_KEYS) delete copy[k];
      mutations.push({ create: copy });
    } else {
      return { ok: false, error: "not_found" };
    }
    mutations.push({ patch });
    const r = await this.mutate(mutations);
    if (r.status === 409) return { ok: false, error: "conflict", detail: { message: r.error } };
    if (r.status !== 200) return { ok: false, error: `write_failed_http_${r.status}`, detail: { message: r.error } };
    // In Sanity the document _rev after a transaction equals its transactionId.
    return { ok: true, newVersion: r.transactionId, detail: { draftId, published: false } };
  }

  async applyPatch(resourceId: string, change: ProposedChange, expectedVersion: string | undefined, idempotencyKey: string): Promise<PatchResult> {
    const key = FIELD_KEYS[change.field];
    const path = key ? this.cfg.fieldMap[key] : undefined;
    if (!path) return { ok: false, error: "unsupported_field", detail: { field: change.field } };
    const pair = await this.getPair(resourceId);
    const doc = pair.draft ?? pair.published;
    if (!doc) return { ok: false, error: "not_found" };
    const current = getPath(doc, path);
    if (current != null && typeof current !== "string") {
      return { ok: false, error: "manual_required", detail: { instructions: `The Sanity field "${path}" is not a plain text field (for example Portable Text). Paste this value into it in Sanity Studio and publish:\n\n${change.after}` } };
    }
    if (norm(current as string | undefined) === norm(change.after)) {
      return { ok: true, newVersion: doc._rev, detail: { alreadyApplied: true, idempotencyKey } };
    }
    if (expectedVersion && doc._rev !== expectedVersion) {
      return { ok: false, error: "conflict", detail: { expectedVersion, currentVersion: doc._rev } };
    }
    const r = await this.writeDraft(resourceId, pair, { [path]: change.after }, []);
    return r.ok ? { ...r, detail: { ...r.detail, idempotencyKey } } : r;
  }

  async validateResource(resourceId: string, change: ProposedChange) {
    const r = await this.getResource(resourceId);
    if (!r) return { status: "failed" as const, detail: "Document no longer exists" };
    if (norm(r.fields[change.field]) !== norm(change.after)) {
      return { status: "failed" as const, detail: `${change.field} in the draft does not match the approved draft` };
    }
    return { status: "warning" as const, detail: "Saved to the Sanity draft. Publish the document in Sanity Studio to make it live." };
  }

  /** Read a document at a past revision through the History API (null when unavailable). */
  private async historyDoc(docId: string, rev: string): Promise<SanityDoc | null> {
    try {
      const q = new URLSearchParams({ revision: rev });
      const { status, data } = await this.call(`/data/history/${this.cfg.dataset}/documents/${encodeURIComponent(docId)}?${q}`);
      if (status !== 200) return null;
      return (data as { documents?: SanityDoc[] }).documents?.[0] ?? null;
    } catch (e) {
      if (e instanceof SanityError && e.code !== "http") throw e;
      return null;
    }
  }

  async rollback(resourceId: string, beforeState: ConnectorResource): Promise<PatchResult> {
    const pair = await this.getPair(resourceId);
    const doc = pair.draft ?? pair.published;
    if (!doc) return { ok: false, error: "not_found" };
    const revDoc = beforeState.fields.revision_doc;
    const historic = revDoc && beforeState.version ? await this.historyDoc(revDoc, beforeState.version) : null;
    const set: Record<string, string> = {};
    const unset: string[] = [];
    for (const f of WRITABLE_FIELDS) {
      const path = this.cfg.fieldMap[FIELD_KEYS[f]];
      if (!path || beforeState.fields[`${f}_writable`] === "false") continue;
      const h = historic ? getPath(historic, path) : undefined;
      let before: string | null;
      if (historic) {
        if (h != null && typeof h !== "string") continue;
        before = (h as string | undefined) ?? null;
      } else {
        if (!(f in beforeState.fields)) continue;
        before = beforeState.fields[f];
      }
      const now = getPath(doc, path);
      if (now != null && typeof now !== "string") continue;
      if (norm(before) === norm(now as string | undefined)) continue;
      if (before === null) unset.push(path);
      else set[path] = before;
    }
    if (!Object.keys(set).length && !unset.length) return { ok: true, newVersion: doc._rev, detail: { nothingToRestore: true } };
    const r = await this.writeDraft(resourceId, pair, set, unset);
    if (!r.ok) return { ...r, error: r.error === "conflict" ? "conflict" : `rollback_${r.error}` };
    return { ...r, detail: { ...r.detail, restored: [...Object.keys(set), ...unset], source: historic ? "history_api" : "before_state" } };
  }

  async disconnect() {
    // The customer deletes the token under API → Tokens in sanity.io/manage; we only drop our copy.
  }
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

function errorText(data: unknown): string {
  const d = data as { error?: { description?: string } | string; message?: string } | null;
  if (!d) return "";
  if (typeof d.error === "string") return d.message ? `${d.error}: ${d.message}` : d.error;
  return d.error?.description ?? d.message ?? "";
}
