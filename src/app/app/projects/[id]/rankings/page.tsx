import { TrendingUp } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { DFS_NOT_CONFIGURED } from "@/lib/dataforseo/client";
import { DFS_LOCATIONS } from "@/lib/dataforseo/locations";
import { getRankTrackerView } from "@/lib/rank-tracker/service";
import { RankTracker } from "@/components/app/rank-tracker/rank-tracker";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Rank tracker" };
export const dynamic = "force-dynamic";

export default async function RankingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const view = await getRankTrackerView(session.organizationId, project.id, project.websiteUrl);
  const canEdit = !session.readOnly && hasRole(session, "member");
  const locations = DFS_LOCATIONS.map((l) => ({ id: l.id, label: l.label }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Google Search"
        icon={<TrendingUp />}
        title="Rank tracker"
        description="Where your website shows up on Google for the searches you care about — by city and on mobile or desktop — checked automatically on a schedule."
      />
      {!view.configured && view.rows.length === 0 ? (
        <EmptyState bordered picture="chart" title="Rank tracking isn't switched on yet." description={DFS_NOT_CONFIGURED} />
      ) : (
        <RankTracker projectId={project.id} initial={view} canEdit={canEdit} locations={locations} />
      )}
      <Notice tone="neutral" title="How positions are measured">
        We look at Google&apos;s first 100 results for each keyword, as someone in the chosen location would see them, and find your website
        (including www and subdomains). Positions count normal (organic) results only — ads, maps and other boxes are listed separately under
        “On the results page”. Your Search Console average position can differ because it averages every search over many days.
      </Notice>
    </div>
  );
}
