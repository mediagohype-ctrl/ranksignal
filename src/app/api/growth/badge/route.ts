// GET  /api/growth/badge?projectId=…            → the public score badge for a project (embed code).
// POST /api/growth/badge { projectId, enabled }  → turn the badge on / off (Owner or Admin).
// The badge has its own on/off (Project.settings.badge), independent of the report share link: turning the share link
// off or replacing it never breaks a badge already on a website. Only Owners/Admins get the code.
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { mergeBadgeSettings, newTokenId, readBadgeSettings, readShareSettings, signShareToken, type BadgeSettings } from "@/lib/share/token";
import { BADGE_LABEL, badgeUrls } from "@/lib/growth/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/** Badge state as the app sees it. Older projects whose badge ran on the share link count as "on" while sharing is on. */
function effectiveBadge(settings: unknown): BadgeSettings | null {
  const badge = readBadgeSettings(settings);
  if (badge) return badge;
  const share = readShareSettings(settings);
  return share?.enabled ? { enabled: true, tokenId: share.tokenId } : null;
}

async function view(projectId: string, badge: BadgeSettings | null, canManage: boolean) {
  if (!badge?.enabled || !canManage) {
    return { enabled: !!badge?.enabled, canManage, svgUrl: null, reportUrl: null, html: null, markdown: null };
  }
  const token = await signShareToken({ projectId, tokenId: badge.tokenId });
  const u = badgeUrls({ token });
  return { enabled: true, canManage, svgUrl: u.svg, reportUrl: u.report, html: u.html, markdown: `[![${BADGE_LABEL}](${u.svg})](${u.report})` };
}

export const GET = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId || projectId.length > 64) throw new HttpError(400, "invalid_project", "projectId is required");
  const project = await requireProject(s, projectId);
  const canManage = s.role === "owner" || s.role === "admin";
  return json({ item: await view(project.id, effectiveBadge(project.settings), canManage) }, NO_STORE);
});

const bodySchema = z.object({ projectId: z.string().min(1).max(64), enabled: z.boolean() });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  const body = await parseBody(req, bodySchema);
  const project = await requireProject(s, body.projectId);
  const current = effectiveBadge(project.settings);
  // Turning on keeps the existing token (a badge already pasted starts working again); a first badge gets a new one.
  const next: BadgeSettings = { enabled: body.enabled, tokenId: current?.tokenId ?? newTokenId() };
  await db.project.update({ where: { id: project.id }, data: { settings: mergeBadgeSettings(project.settings, next) as Prisma.InputJsonValue } });
  return json({ item: await view(project.id, next, true) }, NO_STORE);
});
