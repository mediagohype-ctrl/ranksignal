import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDateTime } from "@/lib/dashboard/format";
import { isGoogleConfigured } from "@/lib/google/config";
import { gscKeywordStatus } from "@/lib/keywords/data";
import { keywordStarLimit } from "@/lib/keywords/limits";
import { KeywordsExplorer } from "@/components/app/keywords/keywords-explorer";
import { EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Keywords" };
export const dynamic = "force-dynamic";

export default async function KeywordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [status, org] = await Promise.all([
    gscKeywordStatus(session.organizationId, project.id),
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true } }),
  ]);
  const connectHref = `/app/projects/${project.id}/integrations`;
  const canConnect = hasRole(session, "admin");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Google Search"
        icon={<Search />}
        title="Keywords"
        description="The Google searches your website shows up for, how many people clicked, and where you can win more — straight from your Google Search Console."
        meta={
          status.connected && status.siteUrl ? (
            <span>
              {status.siteUrl} · last synced {status.lastSyncAt ? fmtDateTime(status.lastSyncAt) : "not yet"}
            </span>
          ) : undefined
        }
      />

      {!status.connected && !status.lastDataDate ? (
        <EmptyState
          bordered
          picture="search"
          title="Connect Google Search Console to see your keywords."
          description={
            isGoogleConfigured()
              ? "It's free and read-only. We fetch the searches you appear for once a day — nothing on your site changes."
              : "Google connections aren't set up on this server yet — the site owner needs to add the Google OAuth keys first."
          }
          action={
            canConnect ? (
              <LinkButton href={connectHref}>Connect Search Console</LinkButton>
            ) : (
              <p className="text-small text-muted">Ask an Owner or Admin of this workspace to connect it.</p>
            )
          }
        />
      ) : (
        <>
          {status.needsSelection && (
            <Notice tone="warning" title="Pick your website in Search Console" actions={<LinkButton href={connectHref} size="sm">Choose property</LinkButton>}>
              Google is connected, but we don&apos;t know which Search Console property is this website yet.
            </Notice>
          )}
          {status.connected && status.lastError && (
            <Notice tone="warning" title="Search Console data is paused" actions={<LinkButton href={connectHref} size="sm" variant="secondary">Check connection</LinkButton>}>
              {status.lastError}
            </Notice>
          )}
          {!status.connected && status.lastDataDate && (
            <Notice tone="info" title="Search Console is disconnected">
              You&apos;re seeing the history we stored before. Reconnect to keep it up to date.
            </Notice>
          )}
          {!status.lastDataDate ? (
            <EmptyState
              bordered
              picture="chart"
              title="Your first keywords are on the way."
              description="We sync Search Console once a day and fetch the last 90 days on the first run. Google's data runs 2–3 days behind, so check back tomorrow."
            />
          ) : (
            <KeywordsExplorer
              projectId={project.id}
              canEdit={hasRole(session, "member") && !session.readOnly}
              lastDataDate={status.lastDataDate}
              queriesPerDayCap={status.queriesPerDayCap}
              starLimit={keywordStarLimit(org?.planId)}
            />
          )}
        </>
      )}

      <Notice tone="neutral" title="What these numbers are (and aren't)">
        Search Console reports your own website only, so you won&apos;t see competitors here. Positions are averages across every search,
        device and location — your real ranking for one person in one city may differ. Google hides very rare searches for privacy, and
        data arrives 2–3 days late.
      </Notice>
    </div>
  );
}
