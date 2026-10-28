import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";

type Ctx = { params: Promise<{ id: string; findingId: string }> };

const schema = z.object({ status: z.enum(["ignored", "open"]) });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id, findingId } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const { status } = await parseBody(req, schema);

  const finding = await db.auditFinding.findFirst({
    where: { id: findingId, organizationId: s.organizationId, projectId: project.id },
  });
  if (!finding) throw new HttpError(404, "not_found", "Finding not found");
  if (finding.status === "resolved") throw new HttpError(409, "finding_resolved", "Resolved findings cannot be changed");

  const item = await db.auditFinding.update({ where: { id: finding.id }, data: { status } });
  return json({ item });
});
