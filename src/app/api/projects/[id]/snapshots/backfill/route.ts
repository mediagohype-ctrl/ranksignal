import { handler, json, requireProject, requireSession } from "@/lib/api";
import { backfillSnapshots } from "@/lib/snapshots";

type Ctx = { params: Promise<{ id: string }> };

/** Create measurement-history snapshots for past runs that have none. Admin-only (staff support mode counts as admin). */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  const project = await requireProject(s, id);
  const created = await backfillSnapshots(project.id, s.organizationId, { force: true });
  return json({ item: { projectId: project.id, attempted: created } });
});
