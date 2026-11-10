import { Link2, ScanSearch } from "lucide-react";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDate, hostOf } from "@/lib/dashboard/format";
import { loadLinkData } from "@/lib/links/server";
import { log } from "@/lib/log";
import { RunButtons } from "@/components/app/run-buttons";
import { LinkSuggestions } from "@/components/app/links/link-suggestions";
import { WeakPagesList } from "@/components/app/links/weak-pages";
import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Internal links" };
export const dynamic = "force-dynamic";

export default async function LinksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, project } = await requireAppProject(id);
  const canRun = hasRole(session, "member");
  const host = hostOf(project.websiteUrl);

  const header = (
    <PageHeader
      icon={<Link2 />}
      eyebrow="Internal links"
      title="Link your pages together"
      description="Pages that few of your other pages link to are hard for Google and AI tools to find. Here is where to add links, using words that are already on your pages."
    />
  );

  let data: Awaited<ReturnType<typeof loadLinkData>> | null = null;
  try {
    data = await loadLinkData(session, project);
  } catch (e) {
    log.error("links.load_failed", { projectId: project.id, error: e instanceof Error ? e.message : String(e) });
  }

  if (!data) {
    return (
      <>
        {header}
        <Notice tone="danger" title="We couldn't load link suggestions">
          Please refresh the page in a minute.
        </Notice>
      </>
    );
  }

  if (!data.crawl || !data.report) {
    return (
      <>
        {header}
        <EmptyState
          size="lg"
          icon={<ScanSearch />}
          title="Link suggestions start with a website check"
          description="We read your pages, see which pages link to which, and suggest new links using words already on your pages."
          action={
            <RunButtons
              projectId={project.id}
              crawlActive={false}
              visibilityActive={false}
              canRun={canRun}
              show={["audit"]}
              labels={{ audit: "Check my website" }}
              size="lg"
            />
          }
        />
      </>
    );
  }

  const r = data.report;
  const checkedAt = data.crawl.finishedAt ?? data.crawl.createdAt;
  const target = typeof sp.target === "string" ? sp.target : undefined;

  return (
    <>
      <PageHeader
        icon={<Link2 />}
        eyebrow="Internal links"
        title="Link your pages together"
        description="Pages that few of your other pages link to are hard for Google and AI tools to find. Here is where to add links, using words that are already on your pages."
        meta={<span>From your website check on {fmtDate(checkedAt)} · {r.pagesAnalysed} pages looked at</span>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Pages with no links in" value={r.orphanCount} hint="No other page on your site links to them" />
        <Stat label="Pages with only 1 link in" value={r.weakCount} />
        <Stat label="Links to add" value={r.suggestions.length} hint={`Helps ${r.targetsWithSuggestions} page${r.targetsWithSuggestions === 1 ? "" : "s"}`} />
        <Stat label="Pages to edit" value={r.sourcesUsed} hint="Where the new links go" />
      </div>

      <Notice tone="info" title="Nothing changes on your website automatically" className="mb-6">
        These are suggestions. Open the page in your website editor, select the highlighted words and turn them into a link
        to the page shown. Add them to your to-do list to keep track.
      </Notice>

      {r.pagesAnalysed < 3 ? (
        <EmptyState
          bordered
          picture="website"
          title="We found too few pages to suggest links."
          description="Your last website check read fewer than 3 normal pages. If your site has more pages, check that they are linked from your menu or listed in your sitemap, then check your website again."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Suggested links"
              description="Best first: pages that need links the most, linked from your strongest related pages."
            />
            <CardBody>
              {r.suggestions.length ? (
                <LinkSuggestions
                  key={target ?? "all"}
                  projectId={project.id}
                  host={host}
                  suggestions={r.suggestions}
                  existingTaskTitles={data.existingTaskTitles}
                  canEdit={canRun}
                  initialTarget={target}
                />
              ) : (
                <EmptyState
                  size="sm"
                  picture="done"
                  title="No new links to suggest right now."
                  description="Either your pages are already well linked, or none of your pages mention another page's topic yet. Writing a sentence about a related service on a page gives us words to link."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Pages that need more links"
              description="Pages with 0 or 1 links from your other pages. Contact, legal, login and hidden (noindex) pages are left out."
            />
            <CardBody>
              <WeakPagesList projectId={project.id} pages={r.weakPages} />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
