import { db } from "@/lib/db";
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { publicIntegration } from "@/lib/connectors/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const rows = await db.integration.findMany({
    where: { organizationId: s.organizationId, projectId: project.id },
    orderBy: { createdAt: "desc" },
  });
  return json({ items: rows.map(publicIntegration) });
});
