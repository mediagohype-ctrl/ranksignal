-- Staff roles for the admin back-office (src/lib/admin/rbac.ts).
ALTER TABLE "User" ADD COLUMN "staffRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Existing staff keep full access: they become super admins.
UPDATE "User" SET "staffRoles" = ARRAY['super_admin']::TEXT[] WHERE "isStaff" = true;
