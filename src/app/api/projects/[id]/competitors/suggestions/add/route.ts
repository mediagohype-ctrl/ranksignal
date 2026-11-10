// POST /api/projects/[id]/competitors/suggestions/add {domain} — add a suggested website to the project's saved
// competitor list (Project.competitors, max 20). member+ (same as editing the project). Free: no DataForSEO call.
import { z } from "zod";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import { domainSchema } from "@/lib/competitors/routes";
import { addSavedCompetitor, getCompetitorsView, MAX_SAVED_COMPETITORS } from "@/lib/competitors/service";

export const dynamic = "force-dynamic";

const schema = z.object({ domain: domainSchema });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  const { domain } = await parseBody(req, schema);
  const r = await addSavedCompetitor(s.organizationId, project.id, domain);
  if (!r.added && r.reason === "full") {
    throw new HttpError(409, "competitors_full", `You can save up to ${MAX_SAVED_COMPETITORS} competitors. Remove one in project settings first.`);
  }
  if (!r.added && r.reason === "own") throw new HttpError(400, "same_domain", "That's your own website.");
  if (r.added) {
    await writeAuditLog({
      organizationId: s.organizationId,
      ...auditActorFromSession(s),
      action: "project.competitor_added",
      resourceType: "project",
      resourceId: project.id,
      after: { domain },
    });
  }
  const fresh = await requireProject(s, id);
  return json({ ...r, item: await getCompetitorsView(s.organizationId, fresh) });
});
