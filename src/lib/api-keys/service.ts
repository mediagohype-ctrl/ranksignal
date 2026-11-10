// API key lifecycle: create (owner/admin), list, revoke, and authenticate a request's key. Server-only.
// Every query is scoped by organizationId; authentication looks a key up by its SHA-256 hash only.
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { generateApiKey, hashApiKey, looksLikeApiKey, normalizeKeyName, type ApiScope } from "./keys";
import { apiLimitsFor } from "./limits";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface Actor {
  actorId: string;
  actorType: "user" | "staff";
  requestId?: string;
  ip?: string;
}

const VIEW_SELECT = { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true } as const;

function toView(k: { id: string; name: string; prefix: string; scopes: string[]; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null }): ApiKeyView {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
  };
}

/** Active keys first (newest first), then revoked ones. Never returns hashes. */
export async function listApiKeys(organizationId: string): Promise<ApiKeyView[]> {
  const rows = await db.apiKey.findMany({
    where: { organizationId },
    select: VIEW_SELECT,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  return rows.map(toView).sort((a, b) => Number(!!a.revokedAt) - Number(!!b.revokedAt));
}

/** Creates a key and returns the secret ONCE. Callers must have checked the owner/admin role. */
export async function createApiKey(organizationId: string, rawName: unknown, actor: Actor): Promise<{ key: string; item: ApiKeyView }> {
  const name = normalizeKeyName(rawName);
  if (!name) throw new HttpError(400, "invalid_name", "Give the key a name of 1–60 characters, e.g. \"Looker Studio\".");
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true, status: true } });
  if (!org) throw new HttpError(404, "not_found", "Workspace not found");
  if (org.status === "suspended") throw new HttpError(403, "org_suspended", "This workspace is suspended.");
  const limits = apiLimitsFor(org.planId);
  const active = await db.apiKey.count({ where: { organizationId, revokedAt: null } });
  if (active >= limits.maxKeys) {
    throw new HttpError(402, "plan_limit", `Your plan allows ${limits.maxKeys} active API key${limits.maxKeys === 1 ? "" : "s"}. Revoke one first, or upgrade.`);
  }
  const g = generateApiKey();
  const scopes: ApiScope[] = ["read"];
  const row = await db.apiKey.create({
    data: { organizationId, name, prefix: g.prefix, keyHash: g.hash, scopes, createdById: actor.actorId },
    select: VIEW_SELECT,
  });
  await writeAuditLog({
    organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: "api_key.created",
    resourceType: "api_key",
    resourceId: row.id,
    after: { name, prefix: g.prefix, scopes }, // never the key or its hash
    requestId: actor.requestId,
    ip: actor.ip,
  });
  return { key: g.key, item: toView(row) };
}

/** Revokes a key of this organization. Idempotent; 404 for keys of other organizations. */
export async function revokeApiKey(organizationId: string, keyId: string, actor: Actor): Promise<ApiKeyView> {
  const existing = await db.apiKey.findFirst({ where: { id: keyId, organizationId }, select: VIEW_SELECT });
  if (!existing) throw new HttpError(404, "not_found", "API key not found");
  if (existing.revokedAt) return toView(existing);
  const row = await db.apiKey.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), revokedById: actor.actorId },
    select: VIEW_SELECT,
  });
  await writeAuditLog({
    organizationId,
    actorId: actor.actorId,
    actorType: actor.actorType,
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: row.id,
    before: { name: existing.name, prefix: existing.prefix },
    requestId: actor.requestId,
    ip: actor.ip,
  });
  return toView(row);
}

/** Who is calling the public API: the key and its organization. */
export interface ApiPrincipal {
  keyId: string;
  organizationId: string;
  planId: string;
  scopes: string[];
}

/** lastUsedAt is written at most this often per key, so reads don't turn into a write per request. */
export const LAST_USED_RESOLUTION_MS = 60_000;

/**
 * Resolves a presented key to its principal, or null for unknown / revoked / malformed keys (callers answer 401
 * without saying which). Throws 403 org_suspended for keys of a suspended organization.
 */
export async function authenticateApiKey(presented: string | null, now = new Date()): Promise<ApiPrincipal | null> {
  if (!presented || !looksLikeApiKey(presented)) return null;
  const row = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(presented) },
    select: { id: true, organizationId: true, scopes: true, revokedAt: true, lastUsedAt: true, organization: { select: { planId: true, status: true } } },
  });
  if (!row || row.revokedAt) return null;
  if (row.organization.status === "suspended") throw new HttpError(403, "org_suspended", "This workspace is suspended.");
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    // Best effort: a failed timestamp write must not fail the request.
    void Promise.resolve()
      .then(() => db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: now } }))
      .catch(() => undefined);
  }
  return { keyId: row.id, organizationId: row.organizationId, planId: row.organization.planId, scopes: row.scopes };
}
