import { db } from "@/lib/db";
import { getPlanWithAiLimits } from "@/lib/billing/plans";
import { hasRole, requireAppSession } from "@/lib/dashboard/server";
import { setupQuestionCount } from "@/lib/setup/facts";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";

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
    db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } }),
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
      limit={
        limitReached
          ? {
              planName: plan.name,
              maxProjects: plan.maxProjects,
              projects,
              canManage: hasRole(s, "admin"),
            }
          : null
      }
    />
  );
}
