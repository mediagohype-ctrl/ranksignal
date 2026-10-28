// GET/POST /api/admin/orgs/[id]/notes — internal staff notes on a customer organization.
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";

const noteBodySchema = z.object({ body: z.string().trim().min(1, "Write something first.").max(5000) });

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaffApi();
  const { id } = await params;
  const items = await db.adminNote.findMany({ where: { organizationId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  return json({ items });
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const { body } = await parseBody(req, noteBodySchema);
  const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");
  const item = await db.adminNote.create({ data: { organizationId: id, authorId: staff.user.id, body } });
  await staffAudit(staff, req, {
    organizationId: id,
    action: "admin.note_created",
    resourceType: "admin_note",
    resourceId: item.id,
    after: { length: body.length },
  });
  return json({ item }, { status: 201 });
});
