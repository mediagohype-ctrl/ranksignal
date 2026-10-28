// Grant staff (admin panel) access to an existing account: npm run make-staff -- you@yourdomain.com
import { db } from "@/lib/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run make-staff -- <email>");
  const user = await db.user.update({ where: { email }, data: { isStaff: true } }).catch(() => null);
  console.log(user ? `${email} is now staff.` : `No account found for ${email} — sign up first.`);
}

main().finally(() => db.$disconnect());
