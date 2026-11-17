// Home banner for websites whose setup was never finished (old accounts): "Finish setting up: 3 details missing",
// linking to the Business part of Settings. When the saved business name is only a guess from the web address and
// the site itself shows a better one, it asks "Is your business called 'Go Hype Media'? Yes / Change".
// Renders nothing when setup is complete. Server component (reads the home page of the last website check).
import { ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { suggestedBusinessName, type NameSignalPage } from "@/lib/setup/brand-names";
import { businessSettingsHref, setupBannerTitle, setupGapList, setupGaps, setupIncomplete, type SetupProjectInput } from "@/lib/setup/completeness";
import { LinkButton, Notice } from "@/components/ui";
import { ConfirmNameButtons } from "./confirm-name";

async function homePageSignals(organizationId: string, projectId: string): Promise<NameSignalPage | null> {
  try {
    const crawl = await db.crawlRun.findFirst({
      where: { organizationId, projectId, pagesCrawled: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!crawl) return null;
    // The home page is always the first page a website check reads.
    const home = await db.crawlPage.findFirst({
      where: { organizationId, crawlRunId: crawl.id, statusCode: 200 },
      orderBy: { crawledAt: "asc" },
      select: { extracted: true },
    });
    return (home?.extracted as NameSignalPage | null) ?? null;
  } catch {
    return null; // the suggestion is a nicety; the banner still shows without it
  }
}

export async function SetupBanner({
  project,
  organizationId,
  canEdit,
}: {
  project: SetupProjectInput & { id: string };
  organizationId: string;
  canEdit: boolean;
}) {
  const gaps = setupGaps(project);
  if (!setupIncomplete(gaps)) return null;
  const href = businessSettingsHref(project.id);
  const nameGap = gaps.some((g) => g.key === "name");
  const brand = (Array.isArray(project.brandNames) ? project.brandNames : []).find((b): b is string => typeof b === "string" && !!b.trim()) ?? project.name;
  const suggestion = nameGap ? suggestedBusinessName(brand, project.websiteUrl, await homePageSignals(organizationId, project.id)) : null;

  return (
    <Notice
      tone="warning"
      icon={<ClipboardList />}
      title={setupBannerTitle(gaps)}
      actions={
        <LinkButton href={href} size="sm">
          Finish setting up
        </LinkButton>
      }
    >
      <p>
        We still need {setupGapList(gaps)}. Without them we may look for the wrong name and ask AI tools the wrong questions.
      </p>
      {suggestion && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-medium text-fg">Is your business called &ldquo;{suggestion}&rdquo;?</span>
          <ConfirmNameButtons
            projectId={project.id}
            suggestion={suggestion}
            previousNames={[brand, project.name]}
            facts={project.facts && typeof project.facts === "object" && !Array.isArray(project.facts) ? (project.facts as Record<string, unknown>) : {}}
            changeHref={href}
            canEdit={canEdit}
          />
        </div>
      )}
    </Notice>
  );
}
