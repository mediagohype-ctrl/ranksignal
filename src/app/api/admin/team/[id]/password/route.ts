// POST /api/admin/team/[id]/password {password?, reason} — set a staff member's password (team.manage).
// Empty password = generate one. Returned ONCE; the member is signed out of every device.
import { handler, json, parseBody } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { setPasswordSchema, setStaffPassword } from "@/lib/admin/team";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaffApi("team.manage");
  const { id } = await params;
  const { password } = await setStaffPassword(staff, req, id, await parseBody(req, setPasswordSchema));
  return json({ item: { password } }, { headers: { "Cache-Control": "no-store" } });
});
