import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { questionsPerCheck } from "@/lib/billing/plans";
import { PromptsManager } from "@/components/app/prompts-manager";
import { Callout, PageHeader } from "@/components/ui";

export const metadata = { title: "Customer questions" };

export default async function PromptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [rows, org] = await Promise.all([
    db.trackedPrompt.findMany({
      where: { organizationId: session.organizationId, projectId: project.id },
      // Same order the AI check uses to pick its questions: Important first, then oldest (paused ones last).
      orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
      select: { id: true, text: true, intent: true, topic: true, locale: true, priority: true, active: true, promptSetVersion: true, createdAt: true },
    }),
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true } }),
  ]);
  const prompts = rows.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }));
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer questions"
        description="The questions your customers ask. We put them to AI tools to see if they name you."
      />
      <Callout tone="tip" title="Good questions sound like your customers">
        Write what a customer would type before they know you: &ldquo;best accounting software for freelancers&rdquo;. Add your city or
        area (&ldquo;digital marketing agency in South Delhi&rdquo;) and your speciality (&ldquo;Framer website agency in India&rdquo;) —
        a small business has a better chance of being named for these than for broad, country-wide questions. Leave your business name out, so we can
        see whether AI names you by itself. Mark your most important questions with the star.
      </Callout>
      <PromptsManager
        projectId={project.id}
        prompts={prompts}
        canEdit={hasRole(session, "member")}
        perCheck={questionsPerCheck(org?.planId ?? "trial")}
      />
    </div>
  );
}
