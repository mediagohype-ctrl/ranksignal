// PATCH/DELETE /api/admin/orgs/[id]/notes/[noteId] — edit or remove an internal staff note.
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";

type Ctx = { params: Promise<{ id: string; noteId: string }> };
const schema = z.object({ body: z.string().trim().min(1, "Write something first.").max(5000) });

async function load(id: string, noteId: string) {
  const note = await db.adminNote.findFirst({ where: { id: noteId, organizationId: id } });
  if (!note) throw new HttpError(404, "not_found", "Note not found");
  return note;
}

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi();
  const { id, noteId } = await params;
  const { body } = await parseBody(req, schema);
  const before = await load(id, noteId);
  const item = await db.adminNote.update({ where: { id: noteId }, data: { body } });
  await staffAudit(staff, req, {
    organizationId: id,
    action: "admin.note_updated",
    resourceType: "admin_note",
    resourceId: noteId,
    before: { body: before.body },
    after: { body },
  });
  return json({ item });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi();
  const { id, noteId } = await params;
  const before = await load(id, noteId);
  await db.adminNote.delete({ where: { id: noteId } });
  await staffAudit(staff, req, {
    organizationId: id,
    action: "admin.note_deleted",
    resourceType: "admin_note",
    resourceId: noteId,
    before: { body: before.body, authorId: before.authorId },
  });
  return json({ ok: true });
});
