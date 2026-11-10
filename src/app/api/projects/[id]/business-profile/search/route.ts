// POST /api/projects/[id]/business-profile/search {query} — find the business on Google Maps (Places Text Search,
// id/name/address only). Admin+ (only they can pick it); rate-limited per organization. Tenant-scoped.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { NOT_CONFIGURED_MESSAGE, isPlacesConfigured } from "@/lib/business-profile/places";
import { searchBusiness } from "@/lib/business-profile/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ query: z.string().trim().min(2).max(200) });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("admin");
  await requireProject(s, id);
  if (!isPlacesConfigured()) throw new HttpError(501, "places_not_configured", NOT_CONFIGURED_MESSAGE);
  const { query } = await parseBody(req, bodySchema);
  return json({ items: await searchBusiness(s.organizationId, query) });
});
