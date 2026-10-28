import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { readNotificationPrefs, readSchedule, readSettings } from "@/lib/dashboard/project-schema";
import { ProjectSettingsForm, type CompetitorRow } from "@/components/app/project-settings/project-settings-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Project settings" };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function competitors(v: unknown): CompetitorRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
    .map((c) => ({
      name: typeof c.name === "string" ? c.name : "",
      domain: typeof c.domain === "string" ? c.domain : "",
      aliases: strings(c.aliases).join(", "),
    }))
    .filter((c) => c.name);
}

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const where = { organizationId: session.organizationId, projectId: project.id };
  const [org, lastCrawl, lastVisibility] = await Promise.all([
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true } }),
    db.crawlRun.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.visibilityRun.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const plan = getPlan(org?.planId ?? "trial");
  const settings = readSettings(project.settings);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project"
        title="Settings"
        description={`How we scan ${project.name}, who hears about results, and what we're allowed to change on your behalf.`}
      />
      <ProjectSettingsForm
        projectId={project.id}
        initial={{
          name: project.name,
          websiteUrl: project.websiteUrl,
          brandNames: strings(project.brandNames),
          competitors: competitors(project.competitors),
          countries: strings(project.countries),
          languages: strings(project.languages),
          schedule: readSchedule(project.settings),
          allowClassB: settings.automation?.allowClassB ?? [],
          emailNotifications: readNotificationPrefs(project.settings).email,
        }}
        lastRuns={{
          crawl: lastCrawl?.createdAt.toISOString() ?? null,
          visibility: lastVisibility?.createdAt.toISOString() ?? null,
        }}
        plan={{ name: plan.name, minScanIntervalDays: plan.minScanIntervalDays }}
        canEdit={hasRole(session, "member")}
        isAdmin={hasRole(session, "admin")}
      />
    </div>
  );
}
