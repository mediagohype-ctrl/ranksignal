// Integration rows for Google products (provider "gsc" | "ga4"). credentialEncrypted = encrypt(JSON {refresh_token}).
// config = {googleEmail, siteUrl | propertyId, propertyName, sync{...}} — never secrets.
import { Prisma, type Integration } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit-log";
import { PRODUCT_LABEL, type GoogleProduct } from "./config";
import { refreshAccessToken, revokeToken } from "./oauth";

export interface GoogleSyncState {
  backfilledAt?: string | null;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  notifiedAt?: string | null;
}

export interface GoogleIntegrationConfig {
  googleEmail: string | null;
  siteUrl?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  sync?: GoogleSyncState;
}

const str = (v: unknown) => (typeof v === "string" && v.length ? v : null);

export function readGoogleConfig(config: unknown): GoogleIntegrationConfig {
  const c = config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
  const s = c.sync && typeof c.sync === "object" ? (c.sync as Record<string, unknown>) : {};
  return {
    googleEmail: str(c.googleEmail),
    siteUrl: str(c.siteUrl),
    propertyId: str(c.propertyId),
    propertyName: str(c.propertyName),
    sync: {
      backfilledAt: str(s.backfilledAt),
      lastAttemptAt: str(s.lastAttemptAt),
      lastError: str(s.lastError),
      notifiedAt: str(s.notifiedAt),
    },
  };
}

export const toJson = (c: GoogleIntegrationConfig) => c as unknown as Prisma.InputJsonValue;

/** The property this integration reads from (GSC siteUrl or GA4 propertyId), or null until the user picks one. */
export function selectedTarget(provider: string, c: GoogleIntegrationConfig): string | null {
  return provider === "gsc" ? c.siteUrl ?? null : c.propertyId ?? null;
}

export async function findGoogleIntegration(organizationId: string, projectId: string, product: GoogleProduct) {
  return db.integration.findFirst({ where: { organizationId, projectId, provider: product }, orderBy: { createdAt: "desc" } });
}

export function readRefreshToken(row: Pick<Integration, "credentialEncrypted">): string | null {
  if (!row.credentialEncrypted) return null;
  try {
    const parsed = JSON.parse(decryptSecret(row.credentialEncrypted)) as { refresh_token?: unknown };
    return typeof parsed.refresh_token === "string" && parsed.refresh_token ? parsed.refresh_token : null;
  } catch {
    return null;
  }
}

/** Fresh access token for one request/run (never stored). */
export async function accessTokenFor(row: Pick<Integration, "credentialEncrypted">): Promise<string> {
  const rt = readRefreshToken(row);
  if (!rt) throw new Error("Google connection has no stored credential; connect again");
  return refreshAccessToken(rt);
}

export async function saveGoogleConnection(o: {
  organizationId: string;
  projectId: string;
  product: GoogleProduct;
  refreshToken: string;
  googleEmail: string | null;
  scopes: string[];
  userId: string;
  actorType?: "user" | "staff";
}): Promise<Integration> {
  const existing = await findGoogleIntegration(o.organizationId, o.projectId, o.product);
  const prev = existing ? readGoogleConfig(existing.config) : null;
  // Same Google account re-consenting keeps the chosen property; a different account must pick again.
  const keepSelection = prev && prev.googleEmail && prev.googleEmail === o.googleEmail;
  const config: GoogleIntegrationConfig = {
    googleEmail: o.googleEmail,
    siteUrl: keepSelection ? prev!.siteUrl ?? null : null,
    propertyId: keepSelection ? prev!.propertyId ?? null : null,
    propertyName: keepSelection ? prev!.propertyName ?? null : null,
    sync: keepSelection ? { ...prev!.sync, lastError: null, notifiedAt: null } : {},
  };
  const data = {
    credentialEncrypted: encryptSecret(JSON.stringify({ refresh_token: o.refreshToken })),
    scopes: o.scopes as unknown as Prisma.InputJsonValue,
    capabilities: { read: true, write: false, metrics: true } as Prisma.InputJsonValue,
    config: toJson(config),
    health: "healthy",
    connectedBy: o.userId,
  };
  const row = existing
    ? await db.integration.update({ where: { id: existing.id }, data })
    : await db.integration.create({ data: { ...data, organizationId: o.organizationId, projectId: o.projectId, provider: o.product } });
  await writeAuditLog({
    organizationId: o.organizationId,
    actorId: o.userId,
    actorType: o.actorType ?? "user",
    action: existing ? "integration.credentials_rotated" : "integration.connected",
    resourceType: "integration",
    resourceId: row.id,
    after: { provider: o.product, projectId: o.projectId, googleEmail: o.googleEmail, scopes: o.scopes },
  });
  return row;
}

/** Revoke at Google (best effort), wipe the credential, delete the row. Stored MetricDaily history is kept. */
export async function disconnectGoogleIntegration(row: Integration, actor: { userId: string; actorType?: "user" | "staff" }) {
  const rt = readRefreshToken(row);
  const revoked = rt ? await revokeToken(rt) : false;
  await db.integration.update({ where: { id: row.id }, data: { credentialEncrypted: null, health: "unknown" } });
  await db.integration.delete({ where: { id: row.id } });
  await writeAuditLog({
    organizationId: row.organizationId,
    actorId: actor.userId,
    actorType: actor.actorType ?? "user",
    action: "integration.disconnected",
    resourceType: "integration",
    resourceId: row.id,
    before: { provider: row.provider, projectId: row.projectId, config: row.config },
    after: { credentialWiped: true, revokedAtGoogle: revoked },
  });
  return { revoked };
}

export interface GoogleIntegrationView {
  product: GoogleProduct;
  label: string;
  connected: boolean;
  id: string | null;
  googleEmail: string | null;
  siteUrl: string | null;
  propertyId: string | null;
  propertyName: string | null;
  health: string;
  lastSyncAt: string | null;
  lastError: string | null;
  needsSelection: boolean;
}

export function googleIntegrationView(product: GoogleProduct, row: Integration | null): GoogleIntegrationView {
  const c = readGoogleConfig(row?.config);
  const connected = Boolean(row?.credentialEncrypted);
  return {
    product,
    label: PRODUCT_LABEL[product],
    connected,
    id: row?.id ?? null,
    googleEmail: c.googleEmail,
    siteUrl: c.siteUrl ?? null,
    propertyId: c.propertyId ?? null,
    propertyName: c.propertyName ?? null,
    health: row?.health ?? "unknown",
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    lastError: c.sync?.lastError ?? null,
    needsSelection: connected && !selectedTarget(product, c),
  };
}
