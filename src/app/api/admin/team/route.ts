// /api/admin/team — GET staff list; POST {email, roles, reason} adds an existing account to the team (or updates roles).
import { handler, json, parseBody } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { addStaff, addStaffSchema, listStaff } from "@/lib/admin/team";

export const GET = handler(async () => {
  await requireStaffApi("team.manage");
  return json({ items: await listStaff() });
});

export const POST = handler(async (req: Request) => {
  const staff = await requireStaffApi("team.manage");
  const input = await parseBody(req, addStaffSchema);
  return json({ item: await addStaff(staff, req, input) });
});
