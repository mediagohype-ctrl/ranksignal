import { Swords } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { getCompetitorsView } from "@/lib/competitors/service";
import { DFS_NOT_CONFIGURED } from "@/lib/dataforseo/client";
import { CompetitorsWorkspace } from "@/components/app/competitors/competitors-workspace";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Competitors" };
export const dynamic = "force-dynamic";

export default async function CompetitorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const view = await getCompetitorsView(session.organizationId, project);
  const hasData = view.overviews.length + view.gaps.length + view.batches.length + view.topKeywords.length + view.suggestions.length > 0 || view.compare !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Google Search"
        icon={<Swords />}
        title="Competitors"
        description="How much Google traffic your competitors get, which searches bring it, and the keywords they win that you don't."
      />
      {!view.configured && !hasData ? (
        <EmptyState
          bordered
          picture="chart"
          title="Competitor data isn't switched on yet."
          description={`${DFS_NOT_CONFIGURED} Nothing else is needed from you.`}
        />
      ) : (
        <CompetitorsWorkspace projectId={project.id} initial={view} canSpend={!session.readOnly && hasRole(session, "member")} />
      )}
    </div>
  );
}
