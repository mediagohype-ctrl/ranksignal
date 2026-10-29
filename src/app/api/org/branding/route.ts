// White-label branding for the session's organization. GET/PUT: admin+ only.
// Eligible: agency plan, or a done-for-you org (serviceTier set). "Hide Powered by" is agency-only.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError, handler, json, parseBody, requireSession } from "@/lib/api";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import {
  brandingInputSchema,
  canHidePoweredBy,
  isBrandingEligible,
  readStoredBranding,
  resolveBranding,
  toStoredBranding,
} from "@/lib/branding";

async function loadOrg(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, planId: true, serviceTier: true, branding: true },
  });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");
  return org;
}

function view(org: Awaited<ReturnType<typeof loadOrg>>) {
  return {
    eligible: isBrandingEligible(org),
    canHidePoweredBy: canHidePoweredBy(org),
    stored: readStoredBranding(org.branding),
    effective: resolveBranding(org),
  };
}

export const GET = handler(async () => {
  const s = await requireSession("admin");
  return json({ item: view(await loadOrg(s.organizationId)) });
});

export const PUT = handler(async (req: Request) => {
  const s = await requireSession("admin");
  const org = await loadOrg(s.organizationId);
  if (!isBrandingEligible(org)) {
    throw new HttpError(402, "plan_required", "White-label branding is included on the Agency plan and done-for-you services.");
  }
  const input = await parseBody(req, brandingInputSchema);
  if (input.hidePoweredBy && !canHidePoweredBy(org)) {
    throw new HttpError(403, "plan_required", "Hiding “Powered by” is available on the Agency plan.");
  }
  const before = readStoredBranding(org.branding);
  const stored = toStoredBranding(input, org);
  const updated = await db.organization.update({
    where: { id: s.organizationId },
    data: { branding: stored as unknown as Prisma.InputJsonValue },
    select: { id: true, name: true, planId: true, serviceTier: true, branding: true },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "org.branding.update",
    resourceType: "organization",
    resourceId: s.organizationId,
    before,
    after: stored,
  });
  return json({ item: view(updated) });
});
