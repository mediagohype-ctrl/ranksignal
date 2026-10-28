import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIp } from "@/lib/auth/rate-limit";
import type { Role } from "@/lib/types";
import { mergeShareSettings, newTokenId, readShareSettings, shareUrl, signShareToken, type ShareSettings } from "@/lib/share/token";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({ enabled: z.boolean().optional(), rotate: z.literal(true).optional() })
  .refine((b) => b.enabled !== undefined || b.rotate, { message: "Provide enabled and/or rotate" });

const isAdmin = (role: Role) => role === "admin" || role === "owner";

async function view(projectId: string, share: ShareSettings | null, admin: boolean) {
  const enabled = !!share?.enabled;
  // Only admins get the URL itself; everyone else just learns whether sharing is on.
  const url = admin && share && enabled ? shareUrl(await signShareToken({ projectId, tokenId: share.tokenId })) : null;
  return { enabled, url, canManage: admin };
}

/** GET /api/projects/[id]/share → { item: { enabled, url|null, canManage } } */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  return json({ item: await view(project.id, readShareSettings(project.settings), isAdmin(s.role)) }, { headers: { "Cache-Control": "no-store" } });
});

/** POST /api/projects/[id]/share { enabled?: boolean, rotate?: true } (admin+) → { item } */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, bodySchema);

  const before = readShareSettings(project.settings);
  const enabled = body.enabled ?? before?.enabled ?? false;
  const rotate = !!body.rotate || !before; // first enable always mints a tokenId
  const next: ShareSettings = { enabled, tokenId: rotate ? newTokenId() : before!.tokenId };

  await db.project.update({
    where: { id: project.id },
    data: { settings: mergeShareSettings(project.settings, next) as Prisma.InputJsonValue },
  });

  const action = body.rotate ? "report_share.rotated" : enabled ? "report_share.enabled" : "report_share.disabled";
  try {
    await writeAuditLog({
      organizationId: s.organizationId,
      actorId: s.userId,
      action,
      resourceType: "project",
      resourceId: project.id,
      // Never log tokens; booleans are enough to reconstruct what happened.
      before: { enabled: !!before?.enabled },
      after: { enabled, rotated: !!body.rotate },
      ip: clientIp(req),
    });
  } catch (e) {
    console.error("[share] audit log failed", e instanceof Error ? e.message : e);
  }

  return json({ item: await view(project.id, next, true) }, { headers: { "Cache-Control": "no-store" } });
});
