// Grant staff (admin panel) access to an existing account, with roles (src/lib/admin/rbac.ts):
//   npm run make-staff -- you@yourdomain.com                 → super_admin (full access, can manage the team)
//   npm run make-staff -- seo@yourdomain.com seo marketing   → only the SEO and Marketing sections
// After the first super admin exists, manage everyone else from /admin/team.
import { db } from "@/lib/db";
import { isStaffRole, normalizeRoles, STAFF_ROLE_IDS } from "@/lib/admin/rbac";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error(`Usage: npm run make-staff -- <email> [roles…]  (roles: ${STAFF_ROLE_IDS.join(", ")})`);
  const asked = process.argv.slice(3);
  const unknown = asked.filter((r) => !isStaffRole(r));
  if (unknown.length) throw new Error(`Unknown role(s): ${unknown.join(", ")}. Choose from: ${STAFF_ROLE_IDS.join(", ")}`);
  const roles = asked.length ? normalizeRoles(asked) : ["super_admin" as const];
  const user = await db.user.update({ where: { email }, data: { isStaff: true, staffRoles: roles } }).catch(() => null);
  console.log(user ? `${email} is now staff with roles: ${roles.join(", ")}.` : `No account found for ${email} — sign up first.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
