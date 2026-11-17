// GET → what the next AI check of this website will ask and use, for the "Check AI" confirmation:
// { item: { answers, questions, engines, left, fullQuestions, fullAnswers, partial, monthly, confirm } }.
// `confirm` is the ready sentence ("This uses 75 of your 225 AI answers left this month. Continue?"); null when the
// check is free (sample answers) or can't start. Read-only, tenant-scoped.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { aiCheckConfirmText, getAiCheckEstimate } from "@/lib/billing/ai-limits";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const estimate = await getAiCheckEstimate(s.organizationId, project.id);
  return json({ item: { ...estimate, confirm: aiCheckConfirmText(estimate) } }, { headers: { "Cache-Control": "no-store" } });
});
