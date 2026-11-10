// POST /api/projects/[id]/rankings/check — "Check now": queue a rank check of every tracked keyword (member+, once a
// day per project, needs monthly allowance left; rate-limited per organization). Tenant-scoped.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { AllowanceError, allowanceResponse, requestCheckNow } from "@/lib/rank-tracker/service";

export const dynamic = "force-dynamic";

export const POST = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  try {
    return json({ ok: true, ...(await requestCheckNow(s.organizationId, project.id)) }, { status: 202 });
  } catch (e) {
    if (e instanceof AllowanceError) return allowanceResponse(e);
    throw e;
  }
});
