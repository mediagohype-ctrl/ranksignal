// GET /api/projects/[id]/competitors — the Competitors page view from cached snapshots (viewer+). Never calls
// DataForSEO, so viewing never uses allowance. Tenant-scoped.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { getCompetitorsView } from "@/lib/competitors/service";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  return json({ item: await getCompetitorsView(s.organizationId, project) });
});
