import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { requireAppSession } from "@/lib/dashboard/server";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New project" };

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
      <OnboardingWizard maxPagesLimit={plan.maxPagesPerCrawl} initialWebsite={safeWebsite(website)} />
    </>
  );
}
