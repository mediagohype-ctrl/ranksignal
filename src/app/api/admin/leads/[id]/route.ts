// GET/PATCH /api/admin/leads/[id] — lead detail; update pipeline status and notes (audit-logged).
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";
import { LEAD_STATUSES } from "@/lib/admin/leads";

type Ctx = { params: Promise<{ id: string }> };

const schema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    notes: z.string().max(10_000).optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, "Nothing to change");

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireStaffApi();
  const { id } = await params;
  const item = await db.lead.findUnique({ where: { id } });
  if (!item) throw new HttpError(404, "not_found", "Lead not found");
  return json({ item });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const input = await parseBody(req, schema);
  const before = await db.lead.findUnique({ where: { id }, select: { status: true, notes: true } });
  if (!before) throw new HttpError(404, "not_found", "Lead not found");
  const item = await db.lead.update({
    where: { id },
    data: { ...(input.status ? { status: input.status } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}) },
  });
  await staffAudit(staff, req, {
    action: input.status && input.status !== before.status ? "admin.lead_status_changed" : "admin.lead_updated",
    resourceType: "lead",
    resourceId: id,
    before: { status: before.status, notesLength: before.notes?.length ?? 0 },
    after: { status: item.status, notesLength: item.notes?.length ?? 0 },
  });
  return json({ item });
});
