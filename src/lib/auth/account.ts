// Account self-service: data export (DPDP right to access) and deletion (right to erasure).
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

const SECRET_KEY_RE = /(credential|secret|password|token|apikey|api_key)/i;

/** Defence in depth: drops any key that looks secret, at any depth, even if a select ever widens. */
export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v)) as T;
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) continue;
      out[k] = stripSecrets(v);
    }
    return out as T;
  }
  return value;
}

const EXPORT_ROW_CAP = 5000;

export async function buildAccountExport(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
  });
  if (!user) return null;
  const memberships = await db.membership.findMany({
    where: { userId },
    select: {
      id: true,
      role: true,
      status: true,
      invitedAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true, region: true, planId: true, status: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const ownedOrgIds = memberships.filter((m) => m.role === "owner" && m.status === "active").map((m) => m.organization.id);

  const organizations = [];
  for (const organizationId of ownedOrgIds) {
    const [projects, integrations, findings, actions, observations] = await Promise.all([
      db.project.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          websiteUrl: true,
          brandNames: true,
          categories: true,
          audience: true,
          countries: true,
          languages: true,
          competitors: true,
          keywords: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.integration.findMany({
        where: { organizationId },
        // credentialEncrypted is deliberately NOT selected.
        select: { id: true, projectId: true, provider: true, health: true, scopes: true, createdAt: true, lastSyncAt: true },
      }),
      db.auditFinding.findMany({
        where: { organizationId },
        select: {
          id: true,
          projectId: true,
          pageUrl: true,
          category: true,
          code: true,
          severity: true,
          message: true,
          status: true,
          detectedAt: true,
          resolvedAt: true,
        },
        orderBy: { detectedAt: "desc" },
        take: EXPORT_ROW_CAP,
      }),
      db.action.findMany({
        where: { organizationId },
        select: {
          id: true,
          projectId: true,
          type: true,
          target: true,
          rationale: true,
          priority: true,
          riskClass: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: EXPORT_ROW_CAP,
      }),
      db.observation.findMany({
        where: { organizationId },
        select: {
          id: true,
          visibilityRunId: true,
          promptId: true,
          provider: true,
          platformLabel: true,
          model: true,
          locale: true,
          brandMentioned: true,
          brandRecommended: true,
          brandCited: true,
          sentiment: true,
          simulated: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: EXPORT_ROW_CAP,
      }),
    ]);
    const org = memberships.find((m) => m.organization.id === organizationId)!.organization;
    organizations.push({ ...org, projects, integrations, findings, actions, observations });
  }

  return stripSecrets({
    exportedAt: new Date().toISOString(),
    format: "ranksignal-account-export/v1",
    notes: [
      "Contains your profile, your workspace memberships and, for workspaces you own, project data and metadata.",
      "Passwords, connection credentials and other secrets are never included.",
      `Large tables are capped at the ${EXPORT_ROW_CAP} most recent rows per workspace.`,
    ],
    user,
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      invitedAt: m.invitedAt,
      createdAt: m.createdAt,
      organization: { id: m.organization.id, name: m.organization.name },
    })),
    organizations,
  });
}

// ---------------------------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------------------------

export interface MembershipForDeletion {
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
  /** Active members in the org other than this user. */
  otherActiveMembers: number;
  /** Active owners in the org other than this user. */
  otherActiveOwners: number;
}

export interface DeletionPlan {
  /** Orgs where the user is the only active owner but others remain: ownership must be transferred first. */
  blocked: { organizationId: string; organizationName: string }[];
  /** Orgs where the user is the only active member: deleted with everything in them. */
  deleteOrganizations: string[];
  /** Orgs the user simply leaves (membership removed with the user). */
  leaveOrganizations: string[];
}

export function planAccountDeletion(memberships: MembershipForDeletion[]): DeletionPlan {
  const plan: DeletionPlan = { blocked: [], deleteOrganizations: [], leaveOrganizations: [] };
  for (const m of memberships) {
    if (m.status === "active" && m.role === "owner") {
      if (m.otherActiveMembers === 0) plan.deleteOrganizations.push(m.organizationId);
      else if (m.otherActiveOwners > 0) plan.leaveOrganizations.push(m.organizationId);
      else plan.blocked.push({ organizationId: m.organizationId, organizationName: m.organizationName });
    } else {
      plan.leaveOrganizations.push(m.organizationId);
    }
  }
  return plan;
}

export async function loadMembershipsForDeletion(userId: string): Promise<MembershipForDeletion[]> {
  const memberships = await db.membership.findMany({
    where: { userId, status: { in: ["active", "invited"] } },
    select: { organizationId: true, role: true, status: true, organization: { select: { name: true } } },
  });
  return Promise.all(
    memberships.map(async (m) => {
      const [otherActiveMembers, otherActiveOwners] = await Promise.all([
        db.membership.count({ where: { organizationId: m.organizationId, status: "active", userId: { not: userId } } }),
        db.membership.count({ where: { organizationId: m.organizationId, status: "active", role: "owner", userId: { not: userId } } }),
      ]);
      return {
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
        status: m.status,
        otherActiveMembers,
        otherActiveOwners,
      };
    }),
  );
}

/** Executes a non-blocked plan: deletes sole-member orgs (DB cascades their data) and the user (cascades memberships). */
export async function executeAccountDeletion(userId: string, plan: DeletionPlan) {
  if (plan.blocked.length > 0) throw new Error("Deletion plan is blocked");
  await db.$transaction(async (tx) => {
    if (plan.deleteOrganizations.length) {
      // Re-check inside the transaction: if someone joined meanwhile, refuse rather than delete their workspace.
      const joined = await tx.membership.count({
        where: { organizationId: { in: plan.deleteOrganizations }, status: "active", userId: { not: userId } },
      });
      if (joined > 0) throw new HttpError(409, "conflict", "Your workspace membership changed while deleting. Please try again.");
      await tx.organization.deleteMany({ where: { id: { in: plan.deleteOrganizations } } });
    }
    await tx.user.delete({ where: { id: userId } });
  });
}
