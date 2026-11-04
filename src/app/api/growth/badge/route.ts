// GET /api/growth/badge?projectId=… → the public score badge for a project (embed snippet for Progress/Settings).
// The badge reuses the report share link: it only works while sharing is on, and turning sharing off (or making a
// new link) stops the badge too. Only Owners/Admins get the URLs, like the share link itself.
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { readShareSettings, signShareToken } from "@/lib/share/token";
import { badgeUrls } from "@/lib/growth/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId || projectId.length > 64) throw new HttpError(400, "invalid_project", "projectId is required");
  const project = await requireProject(s, projectId);
  const share = readShareSettings(project.settings);
  const canManage = s.role === "owner" || s.role === "admin";
  if (!share?.enabled || !canManage) {
    return json({ item: { enabled: !!share?.enabled, canManage, svgUrl: null, reportUrl: null, html: null, markdown: null } }, { headers: { "Cache-Control": "no-store" } });
  }
  const token = await signShareToken({ projectId: project.id, tokenId: share.tokenId });
  const u = badgeUrls({ token });
  return json(
    {
      item: {
        enabled: true,
        canManage,
        svgUrl: u.svg,
        reportUrl: u.report,
        html: u.html,
        markdown: `[![AI-ready score](${u.svg})](${u.report})`,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
