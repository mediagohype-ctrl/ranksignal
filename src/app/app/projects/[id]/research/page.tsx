import { Telescope } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { DFS_NOT_CONFIGURED } from "@/lib/dataforseo/client";
import { researchOverview } from "@/lib/research/service";
import { cleanDomain, projectCompetitors } from "@/lib/research/serp";
import { ResearchWorkbench } from "@/components/app/research/research-workbench";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Keyword research" };
export const dynamic = "force-dynamic";

function hostOf(url: string): string | null {
  try {
    return cleanDomain(new URL(url).hostname);
  } catch {
    return cleanDomain(url);
  }
}

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [keywords, serp] = await Promise.all([
    researchOverview(session.organizationId, project.id, "keywords"),
    researchOverview(session.organizationId, project.id, "serp"),
  ]);
  const configured = keywords.configured;
  const canSearch = configured && hasRole(session, "member") && !session.readOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Google Search"
        icon={<Telescope />}
        title="Keyword research"
        description="Find what your customers type into Google, how many search each month and how hard it is to rank — and see exactly who is on Google's first page today."
      />
      {!configured && (
        <Notice tone="info" title="Live Google data isn't switched on yet">
          {DFS_NOT_CONFIGURED} Searches saved earlier still open below.
        </Notice>
      )}
      <ResearchWorkbench
        projectId={project.id}
        keywords={keywords}
        serp={serp}
        canSearch={canSearch}
        ownDomain={hostOf(project.websiteUrl)}
        competitorCount={projectCompetitors(project.competitors).length}
      />
    </div>
  );
}
