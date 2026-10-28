import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError, handler, json, parseBody, requireSession } from "@/lib/api";
import { editDraft } from "@/lib/actions/service";
import { hashOf, changeOf, targetOf } from "@/lib/actions/gate";
import { buildManualInstructions, simpleDiff } from "@/lib/connectors/manual";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const action = await db.action.findFirst({
    where: { id, organizationId: s.organizationId },
    include: {
      approvals: { orderBy: { createdAt: "desc" } },
      executions: { orderBy: { startedAt: "desc" } },
    },
  });
  if (!action) throw new HttpError(404, "not_found", "Action not found");
  const change = changeOf(action);
  const currentHash = hashOf(action);
  return json({
    item: {
      ...action,
      currentDraftHash: currentHash,
      diff: change ? simpleDiff(change.before, change.after) : null,
      manualInstructions: !action.integrationId && change
        ? buildManualInstructions({ type: action.type, target: targetOf(action), proposedChange: change, rationale: action.rationale })
        : null,
    },
  });
});

const patchSchema = z.object({ after: z.string().min(1).max(20_000) });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const body = await parseBody(req, patchSchema);
  const item = await editDraft(id, body.after, s);
  return json({ item });
});
