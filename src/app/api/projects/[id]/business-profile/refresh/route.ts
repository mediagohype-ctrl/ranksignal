// POST /api/projects/[id]/business-profile/refresh — take a snapshot now (member+, at most once per 24 hours per
// profile to keep Places API costs down). Tenant-scoped.
import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { NOT_CONFIGURED_MESSAGE, isPlacesConfigured } from "@/lib/business-profile/places";
import { getBusinessProfileView, refreshBusiness } from "@/lib/business-profile/service";

export const dynamic = "force-dynamic";

export const POST = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  if (!isPlacesConfigured()) throw new HttpError(501, "places_not_configured", NOT_CONFIGURED_MESSAGE);
  await refreshBusiness(s.organizationId, project.id);
  return json({ item: await getBusinessProfileView(s.organizationId, project.id, project.websiteUrl) });
});
