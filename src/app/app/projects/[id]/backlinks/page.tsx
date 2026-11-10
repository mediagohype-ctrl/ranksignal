import { Link2 } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { getBacklinksView } from "@/lib/backlinks/service";
import { BACKLINKS_LABEL } from "@/lib/backlinks/errors";
import { BacklinksExplorer } from "@/components/app/backlinks/backlinks-explorer";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Backlinks" };
export const dynamic = "force-dynamic";

export default async function BacklinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const view = await getBacklinksView(session.organizationId, project.id, project.websiteUrl, project.competitors);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Links"
        icon={<Link2 />}
        title="Backlinks"
        description="A backlink is a link from another website to yours. Google treats it like a recommendation. See who links to you, what changed, and which sites link to your competitors but not to you."
      />
      <BacklinksExplorer projectId={project.id} initial={view} canRefresh={!session.readOnly && hasRole(session, "member")} />
      <Notice tone="neutral" title="Where this data comes from">
        {BACKLINKS_LABEL} Numbers are updated when you press Refresh or on your plan&apos;s automatic schedule — looking at this page never
        uses your allowance.
      </Notice>
    </div>
  );
}
