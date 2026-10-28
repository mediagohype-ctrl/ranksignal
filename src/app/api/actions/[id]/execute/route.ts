import { handler, json, requireSession } from "@/lib/api";
import { requestExecution } from "@/lib/actions/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const run = await requestExecution(id, s);
  return json({ item: { workflowRunId: run.id, state: run.state } }, { status: 202 });
});
