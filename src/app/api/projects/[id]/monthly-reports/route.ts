// GET /api/projects/[id]/monthly-reports → { items } — sent reports (staff in support mode also see drafts).
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { listProjectReports, toListItem } from "@/lib/monthly-report/server";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const rows = await listProjectReports(s, project.id);
  return json({ items: rows.map(toListItem) }, { headers: { "Cache-Control": "no-store" } });
});
