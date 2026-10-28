import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { requireAppSession } from "@/lib/dashboard/server";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New project" };

export default async function OnboardingPage() {
  const s = await requireAppSession();
  const [org, projectCount] = await Promise.all([
    db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } }),
    db.project.count({ where: { organizationId: s.organizationId } }),
  ]);
  const plan = getPlan(org?.planId ?? "trial");
  return (
    <>
      <PageHeader
        className="mx-auto max-w-3xl"
        breadcrumbs={projectCount > 0 ? [{ label: "Projects", href: "/app" }, { label: "New project" }] : undefined}
        eyebrow={projectCount === 0 ? "Welcome" : "New project"}
        title={projectCount === 0 ? "Let's set up your first project" : "Set up a project"}
        description="Answer a few quick questions. We'll scan your website, ask AI assistants what your buyers ask, and build a plain-English report."
      />
      <OnboardingWizard maxPagesLimit={plan.maxPagesPerCrawl} />
    </>
  );
}
