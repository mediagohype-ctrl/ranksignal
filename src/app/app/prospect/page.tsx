// /app/prospect — Custom plans (staff-set plan "agency"): type a client's website, get a branded one-page report to print or save as PDF.
import { Briefcase } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppSession } from "@/lib/dashboard/server";
import { resolveBranding, toPublicBranding } from "@/lib/branding";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { CUSTOM_CONTACT_HREF } from "@/components/marketing/plans";
import { bookCallHref } from "@/lib/brand";
import { isExternalHref } from "@/components/marketing/plans";
import { ProspectClient } from "./prospect-client";

export const metadata = { title: "Prospect report" };
export const dynamic = "force-dynamic";

export default async function ProspectPage() {
  const s = await requireAppSession();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: s.organizationId },
    select: { name: true, planId: true, serviceTier: true, branding: true },
  });
  // Unchanged: available where it was (the staff-set "agency" plan, sold as Custom). Only the wording and the dead
  // "See the Agency plan" link changed — that plan is no longer sold.
  const agency = org.planId === "agency";
  const bookHref = bookCallHref();

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          icon={<Briefcase />}
          title="Prospect report"
          description="Type a client's website. Get a one-page report with your logo to print or send as a PDF."
        />
      </div>
      {agency ? (
        <ProspectClient branding={toPublicBranding(resolveBranding(org))} orgName={org.name} canRun={s.role !== "viewer"} />
      ) : (
        <EmptyState
          picture="website"
          title="Prospect reports are available on Custom plans."
          description="For agencies: a one-page report of a client's website, with your logo, in 30 seconds. Talk to us to turn it on."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href={CUSTOM_CONTACT_HREF} external>
                Talk to us
              </LinkButton>
              <LinkButton href={bookHref} variant="secondary" external={isExternalHref(bookHref)}>
                Book a free call
              </LinkButton>
            </div>
          }
        />
      )}
    </div>
  );
}
