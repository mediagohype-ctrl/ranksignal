// /app/prospect — Agency plan: type a client's website, get a branded one-page report to print or save as PDF.
import { Briefcase } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppSession } from "@/lib/dashboard/server";
import { resolveBranding, toPublicBranding } from "@/lib/branding";
import { EmptyState, PageHeader } from "@/components/ui";
import { ProspectClient } from "./prospect-client";

export const metadata = { title: "Prospect report" };
export const dynamic = "force-dynamic";

export default async function ProspectPage() {
  const s = await requireAppSession();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: s.organizationId },
    select: { name: true, planId: true, serviceTier: true, branding: true },
  });
  const agency = org.planId === "agency";

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
          title="Prospect reports come with the Agency plan."
          description="Win new clients with a branded report of their website in 30 seconds."
          actionLabel="See the Agency plan"
          actionHref="/app/settings/billing"
        />
      )}
    </div>
  );
}
