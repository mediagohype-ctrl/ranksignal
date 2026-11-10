// GET /api/projects/[id]/backlinks — the backlink page view from stored snapshots (viewer+). Never makes a paid call.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { getBacklinksView } from "@/lib/backlinks/service";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  return json({ item: await getBacklinksView(s.organizationId, project.id, project.websiteUrl, project.competitors) });
});
