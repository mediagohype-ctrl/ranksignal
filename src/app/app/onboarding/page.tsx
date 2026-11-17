import { db } from "@/lib/db";
import { getPlanWithAiLimits } from "@/lib/billing/plans";
import { hasRole, requireAppSession } from "@/lib/dashboard/server";
import { setupQuestionCount } from "@/lib/setup/facts";
import { assistantNamesForPlan } from "@/lib/setup/assistants";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { dfsConfigured } from "@/lib/dataforseo/status";
import { canConnectWebsite } from "@/lib/billing/offer";
import { bookCallHref } from "@/lib/brand";

export const metadata = { title: "Set up your website" };

/** Only a plain http(s) URL from the free check (?website=) is used to prefill the form. */
function safeWebsite(v: string | string[] | undefined): string {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw || raw.length > 2048) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ website?: string | string[] }> }) {
  const { website } = await searchParams;
  const s = await requireAppSession();
  const [org, projects] = await Promise.all([
    db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true, serviceTier: true } }),
    db.project.findMany({
      where: { organizationId: s.organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, websiteUrl: true },
    }),
  ]);
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  // Checked BEFORE screen 1 so nobody fills in setup only to hit the limit at the end.
  const limitReached = projects.length >= plan.maxProjects;
  return (
    <OnboardingWizard
      initialWebsite={safeWebsite(website)}
      firstWebsite={projects.length === 0}
      questionCount={setupQuestionCount(plan.maxPromptsPerRun)}
      assistants={assistantNamesForPlan(org?.planId ?? "trial", org?.serviceTier)}
      // SEO keywords feed Google rank tracking: ask for them only while that is switched on.
      showKeywords={dfsConfigured()}
      // Do it myself has no website connection: setup never talks about approving or publishing changes.
      canConnect={canConnectWebsite(org)}
      limit={
        limitReached
          ? {
              planName: plan.name,
              maxProjects: plan.maxProjects,
              projects,
              canManage: hasRole(s, "admin"),
              // "Book a free call" in the "Your plan is full" card (the calendar link is a server env value).
              bookCallHref: bookCallHref(),
            }
          : null
      }
    />
  );
}
