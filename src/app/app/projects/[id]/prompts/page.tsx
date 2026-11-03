import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { PromptsManager } from "@/components/app/prompts-manager";
import { Callout, PageHeader } from "@/components/ui";

export const metadata = { title: "Customer questions" };

export default async function PromptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const prompts = await db.trackedPrompt.findMany({
    where: { organizationId: session.organizationId, projectId: project.id },
    orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, text: true, intent: true, topic: true, locale: true, priority: true, active: true, promptSetVersion: true },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer questions"
        description="The questions your customers ask. We put them to AI tools to see if they name you."
      />
      <Callout tone="tip" title="Good questions sound like your customers">
        Mix questions people ask before they know you (&ldquo;best accounting software for freelancers&rdquo;) with ones that compare
        you to others (&ldquo;{project.name} vs …&rdquo;). Around 10–30 questions gives a steady picture without using up your monthly AI checks.
      </Callout>
      <PromptsManager projectId={project.id} prompts={prompts} canEdit={hasRole(session, "member")} />
    </div>
  );
}
