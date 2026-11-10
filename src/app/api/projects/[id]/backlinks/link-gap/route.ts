// POST /api/projects/[id]/backlinks/link-gap {competitors: string[]} — sites that link to 1–3 competitors but not to
// this project's domain (member+; 1 unit of the monthly "link_gap" allowance). Past lookups are in GET ../backlinks.
import { z } from "zod";
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { getBacklinksView, runLinkGap } from "@/lib/backlinks/service";
import { LINK_GAP_MAX_COMPETITORS } from "@/lib/backlinks/limits";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const bodySchema = z.object({ competitors: z.array(z.string().trim().min(1).max(253)).min(1).max(LINK_GAP_MAX_COMPETITORS) });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const { competitors } = await parseBody(req, bodySchema);
  const { reportId } = await runLinkGap({
    organizationId: s.organizationId, projectId: project.id, websiteUrl: project.websiteUrl, competitors, userId: s.userId,
  });
  return json({ reportId, item: await getBacklinksView(s.organizationId, project.id, project.websiteUrl, project.competitors) }, { status: 201 });
});
