import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { PromptsManager } from "@/components/app/prompts-manager";
import { Callout, PageHeader } from "@/components/ui";

export const metadata = { title: "Prompts" };

export default async function PromptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const prompts = await db.trackedPrompt.findMany({
    where: { organizationId: session.organizationId, projectId: project.id },
    orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, text: true, intent: true, topic: true, locale: true, priority: true, active: true, promptSetVersion: true },
  });
  const version = prompts.reduce((v, p) => Math.max(v, p.promptSetVersion), 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompts"
        description={`The questions we put to AI assistants on your behalf${version ? ` · question set v${version}` : ""}.`}
      />
      <Callout tone="tip" title="Good questions sound like your customers">
        Mix questions people ask before they know you (&ldquo;best accounting software for freelancers&rdquo;) with ones that compare
        you to others (&ldquo;{project.name} vs …&rdquo;). Around 10–30 questions gives a steady picture without using too many credits.
      </Callout>
      <PromptsManager projectId={project.id} prompts={prompts} canEdit={hasRole(session, "member")} />
    </div>
  );
}
