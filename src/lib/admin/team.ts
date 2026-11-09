// Staff team management: create accounts, add staff, set roles and passwords, remove access.
// Safety rules: never change yourself; always keep one super admin (checked inside a serializable transaction,
// so two super admins can't demote each other at the same moment); never set a super admin's or a customer's
// password (that would be an account takeover — they use the reset email instead).
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
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
/** 16 characters from an unambiguous alphabet (≈ 93 bits, unbiased), grouped for reading aloud: Abcd-Efgh-Jkmn-Pqrs. */
export function generatePassword(): string {
  const chars = Array.from({ length: 16 }, () => PW_ALPHABET[randomInt(PW_ALPHABET.length)]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

const COMMON = ["password", "passw0rd", "qwerty", "123456", "111111", "abc123", "letmein", "welcome", "admin", "iloveyou", "mywebrank", "gohype"];

/**
 * Extra rules for passwords an admin types for staff (staff can hold powerful roles): 3 of 4 character kinds,
 * no common words, not mostly one character. Generated passwords always pass.
 */
export function staffPasswordProblem(password: string, email: string): string | null {
  const base = passwordPolicyError(password, email);
  if (base) return base;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (kinds < 3) return "Mix at least three of: lowercase, uppercase, numbers, symbols — or leave it empty to generate one.";
  const lower = password.toLowerCase();
  if (COMMON.some((w) => lower.includes(w))) return "Avoid common words like “password”, “admin” or our brand name.";
  const counts = new Map<string, number>();
  for (const c of lower) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (Math.max(...counts.values()) > password.length / 2) return "Too many repeated characters.";
  return null;
}

const TEAM_WORKSPACE_NAME = `${BRAND.name} Team`;

/**
 * The internal workspace staff accounts belong to (sign-in needs a workspace). Paid plan with no subscription =
 * always active; isInternal keeps it out of revenue numbers. Staff join it as viewers; what they can do in the
 * back-office comes from their staff roles, not from this membership.
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
    create: { userId, organizationId: ws.id, role: "viewer", status: "active" },
    update: { status: "active" },
  });
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const isSerializationFailure = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";

/**
 * Runs a change that may drop someone's super_admin role. Inside one serializable transaction it applies the
 * change and then re-counts super admins; if none are left it rolls back. Concurrent attempts fail safe (409).
 */
async function keepingASuperAdmin(change: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await db.$transaction(
      async (tx) => {
        await change(tx);
        const left = await tx.user.count({ where: { isStaff: true, staffRoles: { has: "super_admin" } } });
        if (left === 0) throw new HttpError(409, "last_super_admin", "Keep at least one super admin on the team.");
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (isSerializationFailure(e)) throw new HttpError(409, "conflict", "Another team change happened at the same time. Please try again.");
    throw e;
  }
}

/** Creates a brand-new staff account with a password the admin hands over. Returns the password once. */
export async function createStaffAccount(staff: StaffContext, req: Request, input: z.infer<typeof createAccountSchema>) {
  const password = input.password || generatePassword();
  const policy = staffPasswordProblem(password, input.email);
  if (policy) throw new HttpError(400, "weak_password", policy, { fieldErrors: { password: [policy] } });
  const taken = () => new HttpError(409, "email_taken", "This email already has an account. Use “Add an existing account” instead.");
  if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw taken();
  const roles = normalizeRoles(input.roles);
  const passwordHash = await hashPassword(password);
  const user = await db
    .$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash, emailVerified: true, isStaff: true, staffRoles: roles },
        select: { id: true, email: true, name: true, staffRoles: true },
      });
      await ensureCanSignIn(tx, u.id);
      return u;
    })
    .catch((e) => {
      throw isUniqueViolation(e) ? taken() : e;
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
 * Sets a new password for a team member (they forgot it, or first login) and signs them out everywhere
 * (sessions carry a fingerprint of the password hash). Refused for: yourself (Settings → Account), super admins,
 * and anyone who is also a member of a customer workspace — those use the password-reset email, so no admin
 * can quietly take over another powerful or customer identity.
 */
export async function setStaffPassword(staff: StaffContext, req: Request, userId: string, input: z.infer<typeof setPasswordSchema>) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "Change your own password in Settings → Account.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isStaff: true, staffRoles: true } });
  if (!user?.isStaff) throw new HttpError(404, "not_found", "Staff member not found. Passwords can only be set for team members.");
  if (normalizeRoles(user.staffRoles).includes("super_admin")) {
    throw new HttpError(403, "use_reset_email", "Super admins can't have their password set by someone else. Send them a password-reset email from Users instead.");
  }
  const customerSeat = await db.membership.findFirst({
    where: { userId, status: "active", organization: { isInternal: false } },
    select: { id: true },
  });
  if (customerSeat) {
    throw new HttpError(403, "use_reset_email", "This person also belongs to a customer workspace. Send a password-reset email from Users instead.");
  }
  const password = input.password || generatePassword();
  const policy = staffPasswordProblem(password, user.email);
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

/** Quick pre-check for UI messages; the binding check runs inside keepingASuperAdmin(). */
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

/** Gives staff roles to an account that signed up by itself. Existing staff are changed with setStaffRoles. */
export async function addStaff(staff: StaffContext, req: Request, input: z.infer<typeof addStaffSchema>) {
  const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, isStaff: true } });
  if (!user) throw new HttpError(404, "user_not_found", "No account uses this email. Create an employee account instead.");
  if (user.id === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't change your own roles. Ask another super admin.");
  if (user.isStaff) throw new HttpError(409, "already_staff", "This person is already on the team — use “Change roles” in the list below.");
  const roles = normalizeRoles(input.roles);
  const item = await db.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: user.id }, data: { isStaff: true, staffRoles: roles }, select: { id: true, email: true, staffRoles: true } });
    await ensureCanSignIn(tx, user.id);
    return u;
  });
  await staffAudit(staff, req, {
    action: "admin.staff_granted",
    resourceType: "user",
    resourceId: user.id,
    before: { isStaff: false },
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
  let item: { id: string; email: string; staffRoles: string[] } | null = null;
  await keepingASuperAdmin(async (tx) => {
    item = await tx.user.update({ where: { id: userId }, data: { staffRoles: roles }, select: { id: true, email: true, staffRoles: true } });
  });
  await staffAudit(staff, req, {
    action: "admin.staff_roles_changed",
    resourceType: "user",
    resourceId: userId,
    before: { staffRoles: before.staffRoles },
    after: { staffRoles: roles },
    reason: input.reason,
  });
  return item!;
}

export async function removeStaff(staff: StaffContext, req: Request, userId: string, reason: string) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't remove your own staff access.");
  const before = await db.user.findUnique({ where: { id: userId }, select: { isStaff: true, staffRoles: true } });
  if (!before?.isStaff) throw new HttpError(404, "not_found", "Staff member not found");
  await keepingASuperAdmin(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isStaff: false, staffRoles: [] } });
    // They also leave the internal team workspace (customer workspaces they own are untouched).
    await tx.membership.updateMany({ where: { userId, organization: { isInternal: true } }, data: { status: "removed" } });
  });
  await staffAudit(staff, req, {
    action: "admin.staff_revoked",
    resourceType: "user",
    resourceId: userId,
    before: { isStaff: true, staffRoles: before.staffRoles },
    after: { isStaff: false, staffRoles: [] },
    reason,
  });
}
