// POST /api/projects/[id]/backlinks/refresh — fetch fresh backlink data now (member+; once a day per project; uses
// BACKLINK_UNITS_PER_REFRESH units of the monthly "backlinks" allowance). Tenant-scoped.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { getBacklinksView, refreshBacklinksNow } from "@/lib/backlinks/service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const POST = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  await refreshBacklinksNow({ organizationId: s.organizationId, projectId: project.id, websiteUrl: project.websiteUrl });
  return json({ item: await getBacklinksView(s.organizationId, project.id, project.websiteUrl, project.competitors) });
});
