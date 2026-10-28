import { handler, json, requireProject, requireSession } from "@/lib/api";
import { getProjectDashboard } from "@/lib/dashboard/data";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const item = await getProjectDashboard(s.organizationId, project.id);
  return json({ item: { project: { id: project.id, name: project.name, websiteUrl: project.websiteUrl }, ...item } });
});
