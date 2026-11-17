import Link from "next/link";
import clsx from "clsx";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { isAutoFixOn, isPaused, readFacts, readNotificationPrefs, readSchedule } from "@/lib/dashboard/project-schema";
import { getUserPrefs } from "@/lib/expert";
import { MembersPanel } from "@/components/app/members-panel";
import { PlanSection } from "@/components/app/project-settings/plan-section";
import { PreferencesPanel } from "@/components/app/project-settings/preferences-panel";
import { WhatsAppOptIn } from "@/components/app/whatsapp-optin";
import { ReferralCard } from "@/components/app/referral-card";
import { ProjectSettingsForm, type CompetitorRow } from "@/components/app/project-settings/project-settings-form";
import { settingsTabFrom, type SettingsTab } from "@/components/app/project-settings/tabs";
import { expertModeHelp } from "@/components/app/nav";
import { sessionCanConnect } from "@/lib/dashboard/menu";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

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

// Settings (brief 5.8), opened from the profile menu: My business, Connect website, Automatic checks, Auto-fix,
// Pause all changes, Emails, Team, Plan, Expert mode.
const TABS: { id: SettingsTab; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "schedules", label: "Schedules" },
  { id: "notifications", label: "Notifications" },
  { id: "team", label: "Team" },
];

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab = settingsTabFrom(sp.tab);
  const { session, project } = await requireAppProject(id);
  const where = { organizationId: session.organizationId, projectId: project.id };
  const [org, lastCrawl, lastVisibility, prefs] = await Promise.all([
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true, serviceTier: true } }),
    db.crawlRun.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.visibilityRun.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    getUserPrefs(session),
  ]);
  const plan = getPlan(org?.planId ?? "trial");
  const emails = readNotificationPrefs(project.settings);
  const isAdmin = hasRole(session, "admin");
  // Do it myself: no connections, no automatic fixes, nothing to pause (owner decision 1). Staff see everything.
  const canConnect = sessionCanConnect(org, session);
  const base = `/app/projects/${project.id}/settings`;

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Your business details, automatic checks, emails and your team." />
      <nav aria-label="Settings sections" className="no-print -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={t.id === "business" ? base : `${base}?tab=${t.id}`}
                aria-current={tab === t.id ? "page" : undefined}
                className={clsx(
                  "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-small font-medium transition-colors",
                  tab === t.id
                    ? "border-primary bg-primary-soft text-primary-soft-fg"
                    : "border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ProjectSettingsForm
        projectId={project.id}
        initial={{
          name: project.name,
          websiteUrl: project.websiteUrl,
          facts: readFacts(project.facts),
          brandNames: strings(project.brandNames),
          competitors: competitors(project.competitors),
          countries: strings(project.countries),
          languages: strings(project.languages),
          schedule: readSchedule(project.settings, org), // AI: weekly by default when the plan covers it
          autoFix: isAutoFixOn(project.settings),
          paused: isPaused(project.settings),
          // The old all-emails switch, when off, turns every email off.
          emails: {
            monthlyReport: emails.email && emails.monthlyReport,
            fixesWaiting: emails.email && emails.fixesWaiting,
            checkFailed: emails.email && emails.checkFailed,
          },
        }}
        lastRuns={{
          crawl: lastCrawl?.createdAt.toISOString() ?? null,
          visibility: lastVisibility?.createdAt.toISOString() ?? null,
        }}
        plan={{ name: plan.name, minScanIntervalDays: plan.minScanIntervalDays }}
        canEdit={hasRole(session, "member")}
        isAdmin={isAdmin}
        expert={prefs.expertMode}
        integrationsHref={`/app/projects/${project.id}/integrations`}
        tab={tab}
        canConnect={canConnect}
        notificationsExtra={<WhatsAppOptIn canManage={isAdmin} />}
        team={<MembersPanel canManage={isAdmin} currentUserId={session.userId} seatLimit={plan.seats} />}
        planSection={
          <div className="space-y-4">
            <PlanSection organizationId={session.organizationId} timeZone={prefs.timeZone} />
            <ReferralCard />
          </div>
        }
        preferences={
          <PreferencesPanel expertMode={prefs.expertMode} timeZone={prefs.timeZone} expertHelp={expertModeHelp(canConnect)} />
        }
      />
    </div>
  );
}
