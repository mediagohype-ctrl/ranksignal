// Business Profile monitor (Google Places API). GET: the page view (viewer+). POST {placeId}: pick the business and
// take the first snapshot (admin+). DELETE: stop monitoring and drop its history (admin+). Tenant-scoped.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import { NOT_CONFIGURED_MESSAGE, PLACE_ID_RE, isPlacesConfigured } from "@/lib/business-profile/places";
import { getBusinessProfileView, removeBusiness, selectBusiness } from "@/lib/business-profile/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const selectSchema = z.object({ placeId: z.string().regex(PLACE_ID_RE) });

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  return json({ item: await getBusinessProfileView(s.organizationId, project.id, project.websiteUrl) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  const project = await requireProject(s, id);
  if (!isPlacesConfigured()) throw new HttpError(501, "places_not_configured", NOT_CONFIGURED_MESSAGE);
  const { placeId } = await parseBody(req, selectSchema);
  const profile = await selectBusiness({ organizationId: s.organizationId, projectId: project.id, placeId, userId: s.userId });
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "business_profile.selected",
    resourceType: "project",
    resourceId: project.id,
    after: { placeId, name: profile.name },
  });
  return json({ item: await getBusinessProfileView(s.organizationId, project.id, project.websiteUrl) }, { status: 201 });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  const project = await requireProject(s, id);
  const r = await removeBusiness(s.organizationId, project.id);
  if (r.removed) {
    await writeAuditLog({
      organizationId: s.organizationId,
      ...auditActorFromSession(s),
      action: "business_profile.removed",
      resourceType: "project",
      resourceId: project.id,
    });
  }
  return json({ ok: true, ...r });
});
