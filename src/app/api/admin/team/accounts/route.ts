// POST /api/admin/team/accounts {name, email, password?, roles, reason} — create an employee's account (team.manage).
// The password (typed or generated) is returned ONCE so the admin can hand it over; only its hash is stored.
import { handler, json, parseBody } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { createAccountSchema, createStaffAccount } from "@/lib/admin/team";

export const POST = handler(async (req: Request) => {
  const staff = await requireStaffApi("team.manage");
  const { user, password } = await createStaffAccount(staff, req, await parseBody(req, createAccountSchema));
  return json({ item: { ...user, password } }, { headers: { "Cache-Control": "no-store" } });
});
