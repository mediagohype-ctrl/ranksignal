// /api/admin/team/[id] — PATCH {roles, reason} changes a staff member's roles; DELETE {reason} removes staff access.
import { handler, json, parseBody } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { removeStaff, removeStaffSchema, setRolesSchema, setStaffRoles } from "@/lib/admin/team";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("team.manage");
  const { id } = await params;
  const input = await parseBody(req, setRolesSchema);
  return json({ item: await setStaffRoles(staff, req, id, input) });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("team.manage");
  const { id } = await params;
  const { reason } = await parseBody(req, removeStaffSchema);
  await removeStaff(staff, req, id, reason);
  return json({ item: { removed: true } });
});
