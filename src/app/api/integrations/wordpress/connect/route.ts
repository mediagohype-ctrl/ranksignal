import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { writeAuditLog } from "@/lib/audit-log";
import { WordPressConnector, WORDPRESS_CAPABILITIES } from "@/lib/connectors/wordpress";
import { publicIntegration } from "@/lib/connectors/serialize";

const schema = z.object({
  projectId: z.string().min(1).max(64),
  siteUrl: z.string().url().max(500),
  username: z.string().min(1).max(200),
  applicationPassword: z.string().min(8).max(200),
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  const body = await parseBody(req, schema);
  const project = await requireProject(s, body.projectId);
  const siteUrl = body.siteUrl.trim().replace(/\/+$/, "");

  let connector: WordPressConnector;
  try {
    connector = new WordPressConnector({ siteUrl, username: body.username, applicationPassword: body.applicationPassword });
  } catch (e) {
    throw new HttpError(400, "invalid_site_url", e instanceof Error ? e.message : "Invalid site URL");
  }
  const test = await connector.testConnection();
  if (!test.ok) throw new HttpError(400, "connection_failed", test.error ?? "Could not connect to WordPress");

  const credentialEncrypted = encryptSecret(JSON.stringify({ username: body.username, applicationPassword: body.applicationPassword }));
  const data = {
    credentialEncrypted,
    capabilities: WORDPRESS_CAPABILITIES as unknown as Prisma.InputJsonValue,
    config: { siteUrl, username: body.username, identity: test.identity ?? null } as Prisma.InputJsonValue,
    health: "healthy",
    connectedBy: s.userId,
    lastSyncAt: new Date(),
  };
  const existing = await db.integration.findFirst({ where: { organizationId: s.organizationId, projectId: project.id, provider: "wordpress" } });
  const row = existing
    ? await db.integration.update({ where: { id: existing.id }, data })
    : await db.integration.create({ data: { ...data, organizationId: s.organizationId, projectId: project.id, provider: "wordpress" } });

  await writeAuditLog({
    organizationId: s.organizationId, actorId: s.userId,
    action: existing ? "integration.credentials_rotated" : "integration.connected",
    resourceType: "integration", resourceId: row.id,
    after: { provider: "wordpress", siteUrl, username: body.username, identity: test.identity ?? null, projectId: project.id },
  });
  return json({ item: publicIntegration(row) }, { status: existing ? 200 : 201 });
});
