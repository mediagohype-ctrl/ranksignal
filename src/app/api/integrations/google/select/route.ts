// POST /api/integrations/google/select {projectId, product, siteUrl | propertyId} — saves the property to read from.
// The choice is re-checked against what the Google account can actually access. Admin+. Audit-logged.
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { assertGoogleConfigured } from "@/lib/google/config";
import { listGa4Properties, listGscSites } from "@/lib/google/api";
import { accessTokenFor, findGoogleIntegration, googleIntegrationView, readGoogleConfig, toJson } from "@/lib/google/integration";
import { productSchema, projectIdSchema, toHttpError } from "@/lib/google/route-helpers";
import { syncGoogleIntegrationById } from "@/lib/google/sync";
import { log } from "@/lib/log";

const schema = z.object({
  projectId: projectIdSchema,
  product: productSchema,
  siteUrl: z.string().min(1).max(500).optional(),
  propertyId: z.string().regex(/^properties\/\d+$/).optional(),
});

export const POST = handler(async (req: Request) => {
  assertGoogleConfigured();
  const s = await requireSession("admin");
  const body = await parseBody(req, schema);
  const project = await requireProject(s, body.projectId);
  const row = await findGoogleIntegration(s.organizationId, project.id, body.product);
  if (!row?.credentialEncrypted) throw new HttpError(409, "not_connected", "Connect your Google account first.");
  const target = body.product === "gsc" ? body.siteUrl : body.propertyId;
  if (!target) throw new HttpError(400, "invalid_request", body.product === "gsc" ? "siteUrl is required" : "propertyId is required");

  let propertyName: string | null = null;
  try {
    const token = await accessTokenFor(row);
    if (body.product === "gsc") {
      const sites = await listGscSites(token);
      if (!sites.some((x) => x.siteUrl === target)) throw new HttpError(400, "not_accessible", "This Google account can't read that Search Console property.");
    } else {
      const p = (await listGa4Properties(token)).find((x) => x.propertyId === target);
      if (!p) throw new HttpError(400, "not_accessible", "This Google account can't read that GA4 property.");
      propertyName = p.displayName.slice(0, 200);
    }
  } catch (e) {
    throw toHttpError(e);
  }

  const prev = readGoogleConfig(row.config);
  const prevTarget = body.product === "gsc" ? prev.siteUrl : prev.propertyId;
  const changed = prevTarget !== target;
  const next = {
    ...prev,
    ...(body.product === "gsc" ? { siteUrl: target } : { propertyId: target, propertyName }),
    // A different property means a fresh 90-day backfill.
    sync: changed ? {} : prev.sync,
  };
  if (changed) {
    // Don't mix data from two properties: this source's stored history is replaced by the new property's.
    await db.metricDaily.deleteMany({ where: { organizationId: s.organizationId, projectId: project.id, source: body.product } });
  }
  const updated = await db.integration.update({
    where: { id: row.id },
    data: { config: toJson(next), health: "healthy", ...(changed ? { lastSyncAt: null } : {}) },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    actorType: s.staffMode ? "staff" : "user",
    action: "integration.property_selected",
    resourceType: "integration",
    resourceId: row.id,
    before: { target: prevTarget ?? null },
    after: { provider: body.product, target },
  });
  if (changed) {
    // First sync (90-day backfill) runs in the background; the scheduler picks it up again if this fails.
    void syncGoogleIntegrationById(row.id, s.organizationId).catch((e) => log.warn("google.sync.initial_failed", { err: e }));
  }
  return json({ item: googleIntegrationView(body.product, updated) });
});
