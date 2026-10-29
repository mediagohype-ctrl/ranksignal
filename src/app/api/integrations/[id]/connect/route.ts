// Generic connector connect route: POST /api/integrations/<provider>/connect {projectId, ...fields}.
// (The dynamic segment is named [id] because Next.js forbids two different slug names at the same
// level — /api/integrations/[id] already exists. Here it carries the PROVIDER id.)
// The static /api/integrations/wordpress/connect route still takes precedence for WordPress.
//
// Flow: validateConfig → create(...).testConnection() → encrypt secrets → store Integration → audit-log.
// Admin+ only (staff support-mode sessions carry role "admin"). Never returns or logs secrets.
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit-log";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { publicIntegration } from "@/lib/connectors/serialize";
import { ConnectorConfigError } from "@/lib/connectors/catalog/types";
import { CONNECTOR_DESCRIPTORS } from "@/lib/connectors/catalog";

// All credential-based connectors (src/lib/connectors/catalog/index.ts).
const DESCRIPTORS = CONNECTOR_DESCRIPTORS;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({ projectId: z.string().min(1).max(64) })
  .catchall(z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]));

/** Every string value appearing in the secrets object (to verify config never contains one). */
function secretValues(secrets: unknown): string[] {
  if (typeof secrets === "string") return secrets.length >= 6 ? [secrets] : [];
  if (secrets && typeof secrets === "object") return Object.values(secrets).flatMap(secretValues);
  return [];
}

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id: provider } = await params;
  const s = await requireSession("admin");
  const descriptor = DESCRIPTORS[provider];
  if (!descriptor) throw new HttpError(404, "unknown_provider", `No connector named "${provider}" is available`);

  const rl = checkRateLimit(`integration-connect:${s.organizationId}`, 10, 10 * 60_000);
  if (!rl.allowed) throw new HttpError(429, "rate_limited", `Too many connection attempts. Try again in ${rl.retryAfterSec}s.`);

  const body = await parseBody(req, bodySchema);
  const project = await requireProject(s, body.projectId);
  const { projectId: _projectId, ...fields } = body;
  void _projectId;
  const context = { organizationId: s.organizationId, projectId: project.id, projectWebsiteUrl: project.websiteUrl };

  let config: unknown;
  let secrets: unknown;
  try {
    ({ config, secrets } = descriptor.validateConfig(fields, context));
  } catch (e) {
    if (e instanceof ConnectorConfigError) throw new HttpError(400, "invalid_config", e.message, e.field ? { field: e.field } : undefined);
    if (e instanceof ZodError) throw e;
    throw new HttpError(400, "invalid_config", e instanceof Error ? e.message : "Invalid settings");
  }
  const configJson = JSON.stringify(config ?? {});
  if (secretValues(secrets).some((v) => configJson.includes(v))) {
    // Defensive: a descriptor must never put a secret into plain-JSON config.
    throw new HttpError(500, "connector_misconfigured", "Connector configuration error");
  }

  let test: { ok: boolean; identity?: string; error?: string };
  try {
    test = await descriptor.create(config, secrets, context).testConnection();
  } catch (e) {
    test = { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
  if (!test.ok) throw new HttpError(400, "connection_failed", test.error ?? `Could not connect to ${descriptor.name}`);

  let credentialEncrypted: string;
  try {
    credentialEncrypted = encryptSecret(JSON.stringify(secrets));
  } catch {
    throw new HttpError(503, "credentials_unavailable", "Secure credential storage is not configured on this server.");
  }

  const storedConfig = { ...(config as Record<string, unknown>), identity: test.identity ?? null };
  const data = {
    credentialEncrypted,
    capabilities: descriptor.capabilities as unknown as Prisma.InputJsonValue,
    config: storedConfig as Prisma.InputJsonValue,
    health: "healthy",
    connectedBy: s.userId,
    lastSyncAt: new Date(),
  };
  const existing = await db.integration.findFirst({ where: { organizationId: s.organizationId, projectId: project.id, provider: descriptor.id } });
  const row = existing
    ? await db.integration.update({ where: { id: existing.id }, data })
    : await db.integration.create({ data: { ...data, organizationId: s.organizationId, projectId: project.id, provider: descriptor.id } });

  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    actorType: s.staffMode ? "staff" : "user",
    action: existing ? "integration.credentials_rotated" : "integration.connected",
    resourceType: "integration",
    resourceId: row.id,
    after: { provider: descriptor.id, projectId: project.id, identity: test.identity ?? null, config: storedConfig },
  });
  return json({ item: publicIntegration(row) }, { status: existing ? 200 : 201 });
});
