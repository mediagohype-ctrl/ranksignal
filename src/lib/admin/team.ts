// Staff team management: add staff, set roles, remove access. Guards against locking everyone out.
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { passwordPolicyError } from "@/lib/security/email-policy";
import { normalizeRoles, STAFF_ROLE_IDS, type StaffRole } from "./rbac";
import { reasonSchema, staffAudit } from "./audit";
import type { StaffContext } from "./guard";

const rolesSchema = z
  .array(z.enum(STAFF_ROLE_IDS as [StaffRole, ...StaffRole[]]))
  .min(1, "Pick at least one role.")
  .max(STAFF_ROLE_IDS.length);

export const addStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  roles: rolesSchema,
  reason: reasonSchema,
});
export const setRolesSchema = z.object({ roles: rolesSchema, reason: reasonSchema });
export const removeStaffSchema = z.object({ reason: reasonSchema });

const passwordField = z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200).optional().or(z.literal(""));

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Empty = generate a strong one and show it once. */
  password: passwordField,
  roles: rolesSchema,
  reason: reasonSchema,
});
export const setPasswordSchema = z.object({ password: passwordField, reason: reasonSchema });

const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
/** 16 characters from an unambiguous alphabet (≈ 93 bits), grouped for reading aloud: Abcd-Efgh-Jkmn-Pqrs. */
export function generatePassword(): string {
  const bytes = randomBytes(16);
  const chars = [...bytes].map((b) => PW_ALPHABET[b % PW_ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

const TEAM_WORKSPACE_NAME = `${BRAND.name} Team`;

/**
 * The internal workspace staff accounts belong to (sign-in needs a workspace). Paid plan with no subscription =
 * always active; isInternal keeps it out of revenue numbers. Your team can add our own site as a project here.
 */
export async function ensureTeamWorkspace(tx: Prisma.TransactionClient = db): Promise<{ id: string }> {
  const found = await tx.organization.findFirst({ where: { isInternal: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (found) return found;
  return tx.organization.create({ data: { name: TEAM_WORKSPACE_NAME, planId: "agency", status: "active", isInternal: true }, select: { id: true } });
}

async function ensureCanSignIn(tx: Prisma.TransactionClient, userId: string) {
  const active = await tx.membership.findFirst({ where: { userId, status: "active" }, select: { id: true } });
  if (active) return;
  const ws = await ensureTeamWorkspace(tx);
  await tx.membership.upsert({
    where: { userId_organizationId: { userId, organizationId: ws.id } },
    create: { userId, organizationId: ws.id, role: "member", status: "active" },
    update: { status: "active" },
  });
}

/** Creates a brand-new staff account with a password the admin hands over. Returns the password once. */
export async function createStaffAccount(staff: StaffContext, req: Request, input: z.infer<typeof createAccountSchema>) {
  const password = input.password || generatePassword();
  const policy = passwordPolicyError(password, input.email);
  if (policy) throw new HttpError(400, "weak_password", policy, { fieldErrors: { password: [policy] } });
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new HttpError(409, "email_taken", "This email already has an account. Use “Add existing account” instead, then “Set password” if needed.");
  const roles = normalizeRoles(input.roles);
  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash, emailVerified: true, isStaff: true, staffRoles: roles },
      select: { id: true, email: true, name: true, staffRoles: true },
    });
    await ensureCanSignIn(tx, u.id);
    return u;
  });
  await staffAudit(staff, req, {
    action: "admin.staff_account_created",
    resourceType: "user",
    resourceId: user.id,
    after: { email: user.email, staffRoles: roles, passwordGenerated: !input.password },
    reason: input.reason,
  });
  return { user, password };
}

/**
 * Sets a new password for a staff member (they forgot it, or first login). Signs them out everywhere: sessions
 * carry a fingerprint of the password hash. Not for yourself — use Settings → Account.
 */
export async function setStaffPassword(staff: StaffContext, req: Request, userId: string, input: z.infer<typeof setPasswordSchema>) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "Change your own password in Settings → Account.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isStaff: true } });
  if (!user?.isStaff) throw new HttpError(404, "not_found", "Staff member not found. Passwords can only be set for team members.");
  const password = input.password || generatePassword();
  const policy = passwordPolicyError(password, user.email);
  if (policy) throw new HttpError(400, "weak_password", policy, { fieldErrors: { password: [policy] } });
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, emailVerified: true } });
    await ensureCanSignIn(tx, userId);
  });
  await staffAudit(staff, req, {
    action: "admin.staff_password_set",
    resourceType: "user",
    resourceId: userId,
    after: { passwordGenerated: !input.password },
    reason: input.reason,
  });
  return { password };
}

/** True when `next` would leave the team with no super admin (counting everyone except `userId`). */
export async function wouldRemoveLastSuperAdmin(userId: string, next: readonly StaffRole[] | null): Promise<boolean> {
  if (next?.includes("super_admin")) return false;
  const others = await db.user.count({ where: { isStaff: true, staffRoles: { has: "super_admin" }, id: { not: userId } } });
  return others === 0;
}

export async function listStaff() {
  const users = await db.user.findMany({
    where: { isStaff: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, staffRoles: true, createdAt: true },
  });
  return users.map((u) => ({ ...u, staffRoles: normalizeRoles(u.staffRoles) }));
}

export async function addStaff(staff: StaffContext, req: Request, input: z.infer<typeof addStaffSchema>) {
  const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, isStaff: true, staffRoles: true } });
  if (!user) throw new HttpError(404, "user_not_found", "No account uses this email. Ask them to sign up first, then add them here.");
  const roles = normalizeRoles(input.roles);
  const item = await db.user.update({
    where: { id: user.id },
    data: { isStaff: true, staffRoles: roles },
    select: { id: true, email: true, staffRoles: true },
  });
  await staffAudit(staff, req, {
    action: user.isStaff ? "admin.staff_roles_changed" : "admin.staff_granted",
    resourceType: "user",
    resourceId: user.id,
    before: { isStaff: user.isStaff, staffRoles: user.staffRoles },
    after: { isStaff: true, staffRoles: roles },
    reason: input.reason,
  });
  return item;
}

export async function setStaffRoles(staff: StaffContext, req: Request, userId: string, input: z.infer<typeof setRolesSchema>) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't change your own roles. Ask another super admin.");
  const before = await db.user.findUnique({ where: { id: userId }, select: { isStaff: true, staffRoles: true } });
  if (!before?.isStaff) throw new HttpError(404, "not_found", "Staff member not found");
  const roles = normalizeRoles(input.roles);
  if (await wouldRemoveLastSuperAdmin(userId, roles)) throw new HttpError(409, "last_super_admin", "Keep at least one super admin on the team.");
  const item = await db.user.update({ where: { id: userId }, data: { staffRoles: roles }, select: { id: true, email: true, staffRoles: true } });
  await staffAudit(staff, req, {
    action: "admin.staff_roles_changed",
    resourceType: "user",
    resourceId: userId,
    before: { staffRoles: before.staffRoles },
    after: { staffRoles: roles },
    reason: input.reason,
  });
  return item;
}

export async function removeStaff(staff: StaffContext, req: Request, userId: string, reason: string) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't remove your own staff access.");
  const before = await db.user.findUnique({ where: { id: userId }, select: { isStaff: true, staffRoles: true } });
  if (!before?.isStaff) throw new HttpError(404, "not_found", "Staff member not found");
  if (await wouldRemoveLastSuperAdmin(userId, null)) throw new HttpError(409, "last_super_admin", "Keep at least one super admin on the team.");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { isStaff: false, staffRoles: [] } }),
    // They also leave the internal team workspace (customer workspaces they own are untouched).
    db.membership.updateMany({ where: { userId, organization: { isInternal: true } }, data: { status: "removed" } }),
  ]);
  await staffAudit(staff, req, {
    action: "admin.staff_revoked",
    resourceType: "user",
    resourceId: userId,
    before: { isStaff: true, staffRoles: before.staffRoles },
    after: { isStaff: false, staffRoles: [] },
    reason,
  });
}
